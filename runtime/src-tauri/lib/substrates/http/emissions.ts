/**
 * substrates/http/emissions.ts
 *
 * Fire-and-forget emission hooks for the HTTP substrate. Wraps
 * fetchWithRetry to record every outbound HTTP call on the local
 * telemetry plane.
 */

import { recordEmission } from '../../fsm/telemetry/emissions';

export function recordHttpCall(args: {
  url: string;
  method: string;
  attempt: number;
  success: boolean;
  status?: number;
  latency_ms?: number;
  error_kind?: string;
}): void {
  // Redact query string for the local plane — keep host + path only.
  let safeUrl = args.url;
  try {
    const u = new URL(args.url);
    safeUrl = `${u.protocol}//${u.host}${u.pathname}`;
  } catch {
    // Not a parseable URL — log as-is (likely relative path).
  }
  recordEmission({
    domain: 'health',
    fromState: 'IDLE',
    toState: args.success ? 'IDLE' : 'ERROR',
    event: 'http.call',
    payload: {
      url: safeUrl,
      method: args.method,
      attempt: args.attempt,
      success: args.success,
      status: args.status ?? null,
      latency_ms: args.latency_ms ?? 0,
      error_kind: args.error_kind ?? null,
    },
  });
}