/**
 * useOversightChat.ts — Phase 2 refactored.
 *
 * Public API is byte-identical to the legacy hook:
 *   - UseOversightChatResult interface
 *
 * The implementation now delegates to
 * createOversightChatController from src/lib/bridge/oversightChat.ts.
 * The controller owns the SSE stream lifecycle, session management, and Supabase writes.
 * The hook just wires businessAccountId + auth state and exposes controller state.
 *
 * The legacy hook's contract (SSE reader loop, double-cleanup guard,
 * session cap, auto-create, MAX_STREAM_DURATION_MS, field-presence type guards)
 * is preserved inside the controller. Consumers see no change.
 */

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useAuthStore } from '../stores/authStore';
import { createOversightChatController } from '../lib/bridge/oversightChat';
import type {
  OversightSession,
  OversightMessage,
} from '../types/oversight';

// ─────────────────────────────────────────────────────────────────────────────
// Result interface — unchanged from the legacy hook
// ─────────────────────────────────────────────────────────────────────────────

export interface UseOversightChatResult {
  sessions: OversightSession[];
  activeSession: OversightSession | null;
  messages: OversightMessage[];
  isStreaming: boolean;
  streamBuffer: string;
  error: string | null;
  startSession: () => Promise<void>;
  sendMessage: (question: string) => void;
  selectSession: (sessionId: string) => void;
  closeStream: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook — body delegates to the controller
// ─────────────────────────────────────────────────────────────────────────────

export function useOversightChat(
  businessAccountId: string | null,
): UseOversightChatResult {
  // userId is read from the auth store at call time — it is not a prop,
  // so we pass a getter so the controller always has a fresh value.
  const getUserId = () => useAuthStore((s) => s.user?.id ?? null);

  // Recreate controller when businessAccountId changes — disposes the old
  // controller and boots a new one with the correct session scope.
  const controller = useMemo(
    () => createOversightChatController(businessAccountId, getUserId),
    [businessAccountId],
  );

  // Dispose the controller on unmount or when businessAccountId changes
  useEffect(() => {
    return () => {
      controller.dispose();
    };
  }, [controller]);

  return useSyncExternalStore(
    controller.subscribe,
    controller.state,
    controller.state,
  );
}
