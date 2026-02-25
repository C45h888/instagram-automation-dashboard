/**
 * useOversightChat.ts
 *
 * Manages conversation with the Oversight Brain agent via SSE streaming.
 * NOT TanStack Query — SSE requires manual stream management.
 *
 * SSE contract (matches backend MEMORY.md implementation):
 *  • POST /api/instagram/oversight/chat
 *  • Headers: text/event-stream; charset=utf-8, Cache-Control: no-cache,no-transform,
 *    X-Accel-Buffering: no
 *  • Keep-alive pings arrive as ': ping\n\n' — dropped silently
 *  • 'token' events accumulate in streamBuffer; cleared on 'done'
 *  • 'done' signals end of stream; caller persists full message to Supabase
 *  • cleanedUp boolean prevents double-cleanup on req.close + stream.end
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { OversightMessagesArraySchema } from '../types/oversight'
import type { Json } from '../lib/database.types'
import type {
  OversightSession,
  OversightMessage,
  OversightSSEPayload,
} from '@/types'
import { isAgentToken, isAgentDone, isAgentError, getSSEErrorMessage } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Result interface
// ─────────────────────────────────────────────────────────────────────────────

export interface UseOversightChatResult {
  sessions:      OversightSession[]
  activeSession: OversightSession | null
  messages:      OversightMessage[]
  isStreaming:   boolean
  streamBuffer:  string
  error:         string | null
  startSession:  () => Promise<void>
  sendMessage:   (question: string) => void
  selectSession: (sessionId: string) => void
  closeStream:   () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useOversightChat(businessAccountId: string | null): UseOversightChatResult {
  const { user } = useAuthStore()

  const [sessions,      setSessions]      = useState<OversightSession[]>([])
  const [activeSession, setActiveSession] = useState<OversightSession | null>(null)
  const [messages,      setMessages]      = useState<OversightMessage[]>([])
  const [isStreaming,   setIsStreaming]   = useState(false)
  const [streamBuffer,  setStreamBuffer]  = useState('')
  const [error,         setError]         = useState<string | null>(null)

  // Abort controller for the active fetch
  const abortRef    = useRef<AbortController | null>(null)
  // Reader for the active SSE stream
  const readerRef   = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)
  // Buffer for incomplete SSE lines across chunks
  const lineBuffer  = useRef('')
  // Prevent double-cleanup (matches backend cleanedUp pattern)
  const cleanedUp   = useRef(false)

  // ── API base URL ───────────────────────────────────────────────────────────
  const apiBase = import.meta.env.VITE_API_BASE_URL || 'https://api.888intelligenceautomation.in'

  // ── Load sessions on mount / businessAccountId change ─────────────────────
  useEffect(() => {
    if (!businessAccountId) {
      setSessions([])
      setActiveSession(null)
      setMessages([])
      return
    }

    let mounted = true

    ;(async () => {
      const { data, error: dbErr } = await supabase
        .from('oversight_chat_sessions')
        .select('*')
        .eq('business_account_id', businessAccountId)
        .order('created_at', { ascending: false })
        .limit(20)

      if (dbErr || !mounted) return
      setSessions((data ?? []) as OversightSession[])
    })()

    return () => { mounted = false }
  }, [businessAccountId])

  // ── Parse messages from active session ────────────────────────────────────
  useEffect(() => {
    if (!activeSession) {
      setMessages([])
      return
    }

    const parsed = OversightMessagesArraySchema.safeParse(activeSession.messages)
    setMessages(parsed.success ? parsed.data : [])
  }, [activeSession])

  // ── Cleanup helper ─────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    if (cleanedUp.current) return
    cleanedUp.current = true

    readerRef.current?.cancel().catch(() => {})
    readerRef.current = null
    abortRef.current?.abort()
    abortRef.current = null
    lineBuffer.current = ''
    setIsStreaming(false)
  }, [])

  // ── Parse a single SSE event string into the raw agent payload ────────────
  const parseSSEEvent = (raw: string): OversightSSEPayload | null => {
    const lines = raw.split('\n')
    let dataStr = ''

    for (const line of lines) {
      if (line.startsWith('data:')) {
        dataStr = line.slice(5).trim()
      }
    }

    if (!dataStr) return null

    try {
      return JSON.parse(dataStr) as OversightSSEPayload
    } catch {
      // Malformed JSON — ignore
      return null
    }
  }

  // ── Persist completed message to Supabase ─────────────────────────────────
  const persistMessage = useCallback(
    async (sessionId: string, fullContent: string): Promise<void> => {
      if (!fullContent) return

      const assistantMessage: OversightMessage = {
        role:      'assistant',
        content:   fullContent,
        timestamp: new Date().toISOString(),
      }

      setMessages((prev) => {
        const updated = [...prev, assistantMessage]

        // Fire-and-forget Supabase update
        supabase
          .from('oversight_chat_sessions')
          .update({ messages: updated as unknown as Json })
          .eq('id', sessionId)
          .then(({ error: dbErr }) => {
            if (dbErr) console.error('useOversightChat: persist failed', dbErr.message)
          })

        return updated
      })
      // setActiveSession intentionally omitted — it would trigger the [activeSession]
      // useEffect which calls setMessages([]) and wipes the message just appended.
    },
    []
  )

  // ── Stream reader loop ─────────────────────────────────────────────────────
  const readStream = useCallback(
    async (reader: ReadableStreamDefaultReader<Uint8Array>, sessionId: string) => {
      const decoder = new TextDecoder()
      let accumulated = ''  // accumulates token events for the current response

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          // Append chunk to line buffer
          lineBuffer.current += decoder.decode(value, { stream: true })

          // Process complete SSE events (double-newline separated)
          const eventBlocks = lineBuffer.current.split('\n\n')
          // Last element may be incomplete — keep it in the buffer
          lineBuffer.current = eventBlocks.pop() ?? ''

          for (const block of eventBlocks) {
            const trimmed = block.trim()
            if (!trimmed) continue

            // Keep-alive ping — drop silently (matches ': ping\n\n' format)
            if (trimmed.startsWith(':')) continue

            const event = parseSSEEvent(trimmed)
            if (!event) continue

            if (isAgentToken(event)) {
              accumulated += event.token
              setStreamBuffer(accumulated)
            } else if (isAgentDone(event)) {
              await persistMessage(sessionId, accumulated)
              setStreamBuffer('')
              accumulated = ''
              cleanup()
              return
            } else if (isAgentError(event)) {
              setError(getSSEErrorMessage(event))
              cleanup()
              return
            }
            // Unknown payload shape — ignore silently
          }
        }
      } catch (err: unknown) {
        if (!cleanedUp.current) {
          const isAbort = err instanceof DOMException && err.name === 'AbortError'
          if (!isAbort) setError(err instanceof Error ? err.message : String(err))
        }
      } finally {
        cleanup()
      }
    },
    [cleanup, persistMessage]
  )

  // ── Start a new session ────────────────────────────────────────────────────
  const startSession = useCallback(async (): Promise<void> => {
    if (!businessAccountId || !user?.id) return

    setError(null)

    const { data, error: dbErr } = await supabase
      .from('oversight_chat_sessions')
      .insert({
        business_account_id: businessAccountId,
        user_id:             user.id,
        messages:            [],
      })
      .select()
      .single()

    if (dbErr) { setError(dbErr.message); return }

    const session = data as OversightSession
    setSessions((prev) => [session, ...prev])
    setActiveSession(session)
    setMessages([])
  }, [businessAccountId, user])

  // ── Select an existing session ─────────────────────────────────────────────
  const selectSession = useCallback((sessionId: string): void => {
    const session = sessions.find((s) => s.id === sessionId) ?? null
    setActiveSession(session)
    setStreamBuffer('')
    setError(null)
  }, [sessions])

  // ── Send a message and open SSE stream ────────────────────────────────────
  const sendMessage = useCallback(
    (question: string): void => {
      if (!activeSession || !businessAccountId || !user?.id || isStreaming) return
      if (!question.trim()) return

      // Append user message to UI immediately
      const userMessage: OversightMessage = {
        role:      'user',
        content:   question.trim(),
        timestamp: new Date().toISOString(),
      }
      const updatedMessages = [...messages, userMessage]
      setMessages(updatedMessages)

      // Persist user message to Supabase
      supabase
        .from('oversight_chat_sessions')
        .update({ messages: updatedMessages as unknown as Json })
        .eq('id', activeSession.id)
        .then(({ error: dbErr }) => {
          if (dbErr) console.error('useOversightChat: user message persist failed', dbErr.message)
        })

      // Open SSE stream
      setIsStreaming(true)
      setStreamBuffer('')
      setError(null)
      cleanedUp.current = false
      lineBuffer.current = ''

      const abort = new AbortController()
      abortRef.current = abort

      fetch(`${apiBase}/api/instagram/oversight/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          business_account_id: businessAccountId,
          user_id:             user.id,
          question:            question.trim(),
          chat_history:        updatedMessages,
          stream:              true,
        }),
        signal: abort.signal,
      })
        .then((res) => {
          if (!res.ok || !res.body) {
            throw new Error(`Oversight chat returned ${res.status}`)
          }
          const reader = res.body.getReader()
          readerRef.current = reader
          return readStream(reader, activeSession.id)
        })
        .catch((err: unknown) => {
          if (!cleanedUp.current) {
            const isAbort = err instanceof DOMException && err.name === 'AbortError'
            if (!isAbort) setError(err instanceof Error ? err.message : String(err))
          }
          cleanup()
        })
    },
    [activeSession, businessAccountId, user, isStreaming, messages, apiBase, readStream, cleanup]
  )

  // ── Manual close ──────────────────────────────────────────────────────────
  const closeStream = useCallback((): void => {
    cleanup()
  }, [cleanup])

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => () => { cleanup() }, [cleanup])

  return {
    sessions,
    activeSession,
    messages,
    isStreaming,
    streamBuffer,
    error,
    startSession,
    sendMessage,
    selectSession,
    closeStream,
  }
}
