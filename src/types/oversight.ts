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
  /** Marks interrupted/incomplete responses (e.g., stream error mid-response) */
  incomplete?: boolean
}

export const OversightMessageSchema = z.object({
  role:       z.enum(['user', 'assistant']),
  content:    z.string(),
  timestamp:  z.string(),
  tools_used: z.array(z.string()).optional(),
  latency_ms: z.number().int().optional(),
  incomplete: z.boolean().optional(),
})

export const OversightMessagesArraySchema = z.array(OversightMessageSchema)

// ─────────────────────────────────────────────────────────────────────────────
// SSE Protocol Types — POST /api/instagram/oversight/chat
//
// Key SSE rules (from MEMORY.md + backend implementation):
//  • Headers: text/event-stream; charset=utf-8, Cache-Control: no-cache no-transform,
//    X-Accel-Buffering: no
//  • Keep-alive pings arrive as ': ping\n\n' — drop silently (SSE comment, no data: line)
//  • 'done' signals end of stream; caller saves final message to Supabase
//  • 'token' events accumulate in streamBuffer; cleared on 'done'
//
// IMPORTANT — dispatch is by FIELD PRESENCE, not a 'type' discriminant.
// The agent never sets an 'event:' SSE named-event header on the wire.
// Each data: line is a JSON object identified by which key it carries:
//
//  | Agent payload shape                          | Identifying key          |
//  |----------------------------------------------|--------------------------|
//  | {"token": "..."}                             | 'token' in payload       |
//  | {"done": true, "latency_ms": ..., ...}       | 'done' in payload        |
//  | {"error": "..."}                             | 'error' in payload       |
//  | {"type": "error", "content": "..."}          | payload.type === 'error' |
// ─────────────────────────────────────────────────────────────────────────────

/** Partial response token from the agent LLM */
export interface AgentTokenPayload {
  token:        string
}

/** Stream-complete signal, optionally carrying latency metadata */
export interface AgentDonePayload {
  done:         true
  latency_ms?:  number
  request_id?:  string
}

/** Unrecoverable error emitted by the agent pipeline */
export interface AgentErrorPayload {
  error:    string
  message?: string
}

/** Error wrapper injected by the backend (not the agent); uses a 'type' key */
export interface BackendSSEError {
  type:    'error'
  content: string
}

/** Union of all raw SSE payloads from POST /api/instagram/oversight/chat */
export type OversightSSEPayload =
  | AgentTokenPayload
  | AgentDonePayload
  | AgentErrorPayload
  | BackendSSEError

// ── Type guards — use these in readStream, not a switch on .type ───────────

export const isAgentToken = (p: OversightSSEPayload): p is AgentTokenPayload =>
  'token' in p

export const isAgentDone  = (p: OversightSSEPayload): p is AgentDonePayload =>
  'done' in p && (p as AgentDonePayload).done === true

export const isAgentError = (p: OversightSSEPayload): p is AgentErrorPayload | BackendSSEError =>
  'error' in p || ('type' in p && (p as BackendSSEError).type === 'error')

/** Extract the error string from either error shape */
export const getSSEErrorMessage = (p: AgentErrorPayload | BackendSSEError): string =>
  'error' in p ? p.error : p.content

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
