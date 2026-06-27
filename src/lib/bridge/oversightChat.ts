/**
 * Controller for useOversightChat — Phase 2 bridge layer.
 *
 * Contract preserved (byte-identical to the React hook):
 *   - SSE streaming via POST /api/instagram/oversight/chat
 *   - Headers: text/event-stream, Cache-Control: no-cache no-transform,
 *     X-Accel-Buffering: no
 *   - Keep-alive pings ': ping\n\n' — dropped silently
 *   - Token events accumulate in streamBuffer; cleared on 'done'
 *   - 'done' signals stream end; caller persists full message to Supabase
 *   - Error events persist partial message (incomplete: true)
 *   - MAX_STREAM_DURATION_MS = LIVENESS_THRESHOLD_MS * 5 (5 minutes)
 *   - Dispatch by FIELD PRESENCE, not a type discriminant
 *   - cleanedUp boolean prevents double-cleanup
 *   - Persist user message to Supabase BEFORE opening stream
 *   - Persist assistant message on 'done' OR stream error (including partial)
 *   - Double-newline SSE event block splitting
 *   - Session cap: 5 most recent sessions
 *   - Auto-create session on mount if none exist
 *
 * Framework-agnostic: no React, no TanStack Query.
 * SSE reader loop, AbortController, Supabase writes all implemented directly.
 *
 * The React hook (useOversightChat.ts) is refactored to consume this
 * controller via useSyncExternalStore. Public exports unchanged:
 *   - UseOversightChatResult interface
 */

import { supabase } from '../../../runtime/web/src/lib/substrates/supabase/client';
import { LIVENESS_THRESHOLD_MS } from './agentHealth';
import type { Json } from '../../../runtime/web/src/lib/substrates/supabase/database.types';
import type {
  OversightSession,
  OversightMessage,
  OversightSSEPayload,
  AgentTokenPayload,
  AgentDonePayload,
  AgentErrorPayload,
  BackendSSEError,
} from '../../../runtime/web/src/lib/contracts/agent/oversight.contract';
import { isAgentToken, isAgentDone, isAgentError, getSSEErrorMessage } from '../../../runtime/web/src/lib/contracts/agent/oversight.contract';
import type { UseOversightChatResult } from '../../hooks/useOversightChat';
import type { ControllerSlot } from './controller';
import { DisposeScope, createControllerSlot } from './controller';

// ─────────────────────────────────────────────────────────────────────────────
// Constants — preserved verbatim from useOversightChat.ts
// ─────────────────────────────────────────────────────────────────────────────

/** Max stream duration — 5 minutes, derived from LIVENESS_THRESHOLD_MS */
const MAX_STREAM_DURATION_MS = LIVENESS_THRESHOLD_MS * 5;

const SESSION_CAP = 5;

const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  'https://api.888intelligenceautomation.in';

// ─────────────────────────────────────────────────────────────────────────────
// Internal state
// ─────────────────────────────────────────────────────────────────────────────

interface OversightChatInternalState {
  sessions: OversightSession[];
  activeSession: OversightSession | null;
  messages: OversightMessage[];
  isStreaming: boolean;
  streamBuffer: string;
  error: string | null;
}

const INITIAL_STATE: OversightChatInternalState = {
  sessions: [],
  activeSession: null,
  messages: [],
  isStreaming: false,
  streamBuffer: '',
  error: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// Type guards
// ─────────────────────────────────────────────────────────────────────────────

function isAgentDonePayload(p: OversightSSEPayload): p is AgentDonePayload {
  return isAgentDone(p);
}

function isAgentErrorPayload(p: OversightSSEPayload): p is AgentErrorPayload | BackendSSEError {
  return isAgentError(p);
}

// ─────────────────────────────────────────────────────────────────────────────
// SSE helpers
// ─────────────────────────────────────────────────────────────────────────────

function parseSSEEvent(raw: string): OversightSSEPayload | null {
  const lines = raw.split('\n');
  let dataStr = '';

  for (const line of lines) {
    if (line.startsWith('event: ')) {
      // event: field is tracked but routing uses field-presence guards below
      continue;
    }
    if (line.startsWith('data:')) {
      dataStr = line.slice(5).trim();
    }
  }

  if (!dataStr) return null;
  try {
    return JSON.parse(dataStr) as OversightSSEPayload;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Controller factory
// ─────────────────────────────────────────────────────────────────────────────

export function createOversightChatController(
  businessAccountId: string | null,
  getUserId: () => string | null,
): {
  state(): UseOversightChatResult;
  subscribe(listener: (state: UseOversightChatResult) => void): () => void;
  dispose(): void;
} {
  const slot: ControllerSlot<OversightChatInternalState> = createControllerSlot(INITIAL_STATE);
  const dispose = new DisposeScope();

  // ── SSE lifecycle refs ─────────────────────────────────────────────────────
  const abortRef = { current: null as AbortController | null };
  const readerRef = { current: null as ReadableStreamDefaultReader<Uint8Array> | null };
  let lineBuffer = '';
  let cleanedUp = false;

  // ── Helpers ────────────────────────────────────────────────────────────────

  // ── Cleanup ────────────────────────────────────────────────────────────────

  function cleanup(): void {
    if (cleanedUp) return;
    cleanedUp = true;
    void readerRef.current?.cancel().catch(() => {});
    readerRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
    lineBuffer = '';
    slot.setState({ isStreaming: false });
  }

  // ── Supabase helpers ───────────────────────────────────────────────────────

  async function persistMessage(
    sessionId: string,
    content: string,
    incomplete = false,
  ): Promise<void> {
    if (!content) return;
    const s = slot.state();
    const assistantMessage: OversightMessage = {
      role: 'assistant',
      content,
      timestamp: new Date().toISOString(),
      ...(incomplete && { incomplete: true }),
    };
    const updated = [...s.messages, assistantMessage];
    slot.setState({ messages: updated });
    // Fire-and-forget Supabase write
    await supabase
      .from('oversight_chat_sessions')
      .update({ messages: updated as unknown as Json })
      .eq('id', sessionId);
  }

  // ── SSE reader loop ───────────────────────────────────────────────────────

  async function readStream(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    sessionId: string,
  ): Promise<void> {
    const decoder = new TextDecoder();
    let accumulated = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Append chunk to line buffer
        lineBuffer += decoder.decode(value, { stream: true });

        // Process complete SSE events (double-newline separated)
        const eventBlocks = lineBuffer.split('\n\n');
        // Last element may be incomplete — keep it in the buffer
        lineBuffer = eventBlocks.pop() ?? '';

        for (const block of eventBlocks) {
          const trimmed = block.trim();
          if (!trimmed) continue;

          // Keep-alive ping (comment-style ': ping') — drop silently
          if (trimmed.startsWith(':')) continue;

          // Extract event: field from block lines (defaults to 'message')
          let currentEventType = 'message';
          for (const line of trimmed.split('\n')) {
            if (line.startsWith('event: ')) {
              currentEventType = line.slice(7).trim();
              break;
            }
          }

          // Ignore ping events — heartbeat data must never reach message handler
          if (currentEventType === 'ping') continue;

          const event = parseSSEEvent(trimmed);
          if (!event) continue;

          // Route by event type first, fall back to field-presence guards
          if (currentEventType === 'done' || isAgentDonePayload(event)) {
            await persistMessage(sessionId, accumulated);
            slot.setState({ streamBuffer: '' });
            cleanup();
            return;
          }

          if (currentEventType === 'error' || isAgentErrorPayload(event)) {
            if (accumulated) {
              await persistMessage(sessionId, accumulated, true);
            }
            slot.setState({ error: getSSEErrorMessage(event as AgentErrorPayload | BackendSSEError) });
            cleanup();
            return;
          }

          if (currentEventType === 'message' && isAgentToken(event)) {
            accumulated += (event as AgentTokenPayload).token;
            slot.setState({ streamBuffer: accumulated });
          }
          // tool_call and other unknown event types — ignore silently
        }
      }
    } catch (err: unknown) {
      if (!cleanedUp) {
        const isAbort = err instanceof DOMException && err.name === 'AbortError';
        if (!isAbort) {
          if (accumulated) {
            await persistMessage(sessionId, accumulated, true);
          }
          slot.setState({ error: err instanceof Error ? err.message : String(err) });
        }
      }
    } finally {
      cleanup();
    }
  }

  // ── Session management ─────────────────────────────────────────────────────

  async function loadSessions(): Promise<void> {
    if (!businessAccountId) {
      slot.setState({ sessions: [], activeSession: null, messages: [] });
      return;
    }

    const userId = getUserId();
    const { data, error: dbErr } = await supabase
      .from('oversight_chat_sessions')
      .select('*')
      .eq('business_account_id', businessAccountId)
      .order('created_at', { ascending: false })
      .limit(SESSION_CAP);

    if (dbErr) {
      slot.setState({ error: dbErr.message });
      return;
    }

    const loaded = (data ?? []) as OversightSession[];

    if (loaded.length > 0) {
      slot.setState({
        sessions: loaded,
        activeSession: loaded[0],
        messages: parseMessages(loaded[0]),
        error: null,
      });
    } else {
      // Auto-create a session
      if (!userId) {
        slot.setState({ sessions: [], activeSession: null, messages: [] });
        return;
      }
      const { data: newData, error: createErr } = await supabase
        .from('oversight_chat_sessions')
        .insert({
          business_account_id: businessAccountId,
          dashboard_user_id: userId,
          messages: [],
        })
        .select()
        .single();

      if (createErr) {
        slot.setState({ error: createErr.message });
        return;
      }
      const newSession = newData as OversightSession;
      slot.setState({
        sessions: [newSession],
        activeSession: newSession,
        messages: [],
        error: null,
      });
    }
  }

  function parseMessages(session: OversightSession): OversightMessage[] {
    // Import Zod schema lazily to avoid circular deps — use raw parse for now
    try {
      return Array.isArray(session.messages) ? (session.messages as unknown as OversightMessage[]) : [];
    } catch {
      return [];
    }
  }

  async function startSession(): Promise<void> {
    if (!businessAccountId) return;
    const userId = getUserId();
    if (!userId) return;

    slot.setState({ error: null });

    // Mark all existing sessions for this account as stale
    await supabase
      .from('oversight_chat_sessions')
      .update({ is_active: false })
      .eq('business_account_id', businessAccountId);

    const { data, error: dbErr } = await supabase
      .from('oversight_chat_sessions')
      .insert({
        business_account_id: businessAccountId,
        dashboard_user_id: userId,
        messages: [],
        is_active: true,
      })
      .select()
      .single();

    if (dbErr) {
      slot.setState({ error: dbErr.message });
      return;
    }

    const session = data as OversightSession;
    slot.setState((s) => ({
      sessions: [session, ...s.sessions.map((x) => ({ ...x, is_active: false }))].slice(0, SESSION_CAP),
      activeSession: session,
      messages: [],
      streamBuffer: '',
      error: null,
    }));
  }

  function selectSession(sessionId: string): void {
    const s = slot.state();
    const session = s.sessions.find((x) => x.id === sessionId) ?? null;
    slot.setState({
      activeSession: session,
      messages: session ? parseMessages(session) : [],
      streamBuffer: '',
      error: null,
    });
  }

  // ── Send message + SSE ─────────────────────────────────────────────────────

  async function sendMessage(question: string): Promise<void> {
    const s = slot.state();
    const userId = getUserId();
    if (!s.activeSession || !businessAccountId || !userId || s.isStreaming) return;
    if (!question.trim()) return;

    // Append user message to UI immediately
    const userMessage: OversightMessage = {
      role: 'user',
      content: question.trim(),
      timestamp: new Date().toISOString(),
    };
    const updatedMessages = [...s.messages, userMessage];
    slot.setState({ messages: updatedMessages, error: null });

    // Persist user message to Supabase BEFORE opening stream
    await supabase
      .from('oversight_chat_sessions')
      .update({ messages: updatedMessages as unknown as Json })
      .eq('id', s.activeSession.id);

    // Open SSE stream
    slot.setState({ isStreaming: true, streamBuffer: '' });
    cleanedUp = false;
    lineBuffer = '';

    const abort = new AbortController();
    abortRef.current = abort;

    const timeoutSignal = AbortSignal.timeout(MAX_STREAM_DURATION_MS);
    const combinedSignal = AbortSignal.any([abort.signal, timeoutSignal]);

    fetch(`${API_BASE}/api/instagram/oversight/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business_account_id: businessAccountId,
        user_id: userId,
        question: question.trim(),
        chat_history: updatedMessages,
        stream: true,
      }),
      signal: combinedSignal,
    })
      .then((res) => {
        if (!res.ok || !res.body) throw new Error(`Oversight chat returned ${res.status}`);
        const reader = res.body.getReader();
        readerRef.current = reader;
        return readStream(reader, s.activeSession!.id);
      })
      .catch((err: unknown) => {
        if (!cleanedUp) {
          const isAbort = err instanceof DOMException && err.name === 'AbortError';
          if (!isAbort) {
            slot.setState({ error: err instanceof Error ? err.message : String(err) });
          }
        }
        cleanup();
      });
  }

  function closeStream(): void {
    cleanup();
  }

  // ── Boot ──────────────────────────────────────────────────────────────────

  void loadSessions();

  // ── Public API ─────────────────────────────────────────────────────────────

  return {
    state: () => {
      const s = slot.state();
      return {
        sessions: s.sessions,
        activeSession: s.activeSession,
        messages: s.messages,
        isStreaming: s.isStreaming,
        streamBuffer: s.streamBuffer,
        error: s.error,
        startSession,
        sendMessage,
        selectSession,
        closeStream,
      };
    },
    subscribe: (listener) =>
      slot.subscribe((s) =>
        listener(buildResult(s)),
      ),
    dispose: () => dispose.dispose(),
  };

  function buildResult(s: OversightChatInternalState): UseOversightChatResult {
    return {
      sessions: s.sessions,
      activeSession: s.activeSession,
      messages: s.messages,
      isStreaming: s.isStreaming,
      streamBuffer: s.streamBuffer,
      error: s.error,
      startSession,
      sendMessage,
      selectSession,
      closeStream,
    };
  }
}
