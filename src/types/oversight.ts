/**
 * oversight.ts
 *
 * Types for the Oversight Brain — the agent explainability system.
 * Covers oversight_chat_sessions table plus the SSE streaming protocol
 * used by POST /api/instagram/oversight/chat.
 */

import type { Database } from '../lib/database.types'
import { z } from 'zod'

// ─────────────────────────────────────────────────────────────────────────────
// Row Type Alias
// ─────────────────────────────────────────────────────────────────────────────

/** One conversation thread between a dashboard user and the oversight agent.
 *  The agent is stateless — the dashboard loads messages from this row,
 *  passes them as chat_history, then saves the response back here. */
export type OversightSession = Database['public']['Tables']['oversight_chat_sessions']['Row']

// ─────────────────────────────────────────────────────────────────────────────
// JSONB Interface + Zod Schema — oversight_chat_sessions.messages
// ─────────────────────────────────────────────────────────────────────────────

/** Typed shape for a single entry in oversight_chat_sessions.messages JSONB array */
export interface OversightMessage {
  role:        'user' | 'assistant'
  content:     string
  timestamp:   string
  tools_used?: string[]
  latency_ms?: number
}

export const OversightMessageSchema = z.object({
  role:       z.enum(['user', 'assistant']),
  content:    z.string(),
  timestamp:  z.string(),
  tools_used: z.array(z.string()).optional(),
  latency_ms: z.number().int().optional(),
})

export const OversightMessagesArraySchema = z.array(OversightMessageSchema)

// ─────────────────────────────────────────────────────────────────────────────
// SSE Protocol Types — POST /api/instagram/oversight/chat
//
// Key SSE rules (from MEMORY.md + backend implementation):
//  • Headers: text/event-stream; charset=utf-8, Cache-Control: no-cache no-transform,
//    X-Accel-Buffering: no
//  • Keep-alive pings arrive as ': ping\n\n' — drop silently
//  • 'done' signals end of stream; caller saves final message to Supabase
//  • 'token' events accumulate in streamBuffer; cleared on 'done'
// ─────────────────────────────────────────────────────────────────────────────

/** Event type emitted by the oversight chat SSE stream */
export type OversightSSEEventType =
  | 'token'        // partial response token — append to streamBuffer
  | 'tool_call'    // agent invoking a tool
  | 'tool_result'  // tool execution result
  | 'done'         // stream complete — persist to DB, clear buffer
  | 'error'        // unrecoverable error from the agent
  | 'ping'         // keep-alive comment — drop silently

export interface OversightSSEEvent {
  type:     OversightSSEEventType
  content?: string                    // present on 'token' events
  tool?:    string                    // present on 'tool_call' / 'tool_result'
  input?:   Record<string, unknown>   // present on 'tool_call'
  output?:  unknown                   // present on 'tool_result'
  error?:   string                    // present on 'error'
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook State Interface
// ─────────────────────────────────────────────────────────────────────────────

/** Complete state shape managed by useOversightChat */
export interface OversightChatState {
  sessions:        OversightSession[]
  activeSessionId: string | null
  messages:        OversightMessage[]
  isStreaming:     boolean
  /** Accumulates partial 'token' events until 'done' is received */
  streamBuffer:    string
  error:           string | null
}
