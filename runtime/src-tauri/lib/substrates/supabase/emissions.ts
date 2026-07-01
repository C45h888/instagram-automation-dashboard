/**
 * substrates/supabase/emissions.ts
 *
 * Fire-and-forget emission hooks for the Supabase substrate.
 * Wraps client init, connection-test, query, realtime subscribe,
 * and rpc calls.
 */

import { recordEmission } from '../../fsm/telemetry/emissions';

export function recordSupabaseCall(args: {
  op: 'client_init' | 'connection_test' | 'query' | 'realtime_subscribe'
    | 'realtime_unsubscribe' | 'rpc' | 'audit_log' | 'api_usage';
  table?: string;
  channel?: string;
  success: boolean;
  latency_ms?: number;
  error_kind?: string;
}): void {
  recordEmission({
    domain: 'health',
    fromState: 'IDLE',
    toState: args.success ? 'IDLE' : 'ERROR',
    event: `supabase.${args.op}`,
    payload: {
      op: args.op,
      table: args.table ?? null,
      channel: args.channel ?? null,
      success: args.success,
      latency_ms: args.latency_ms ?? 0,
      error_kind: args.error_kind ?? null,
    },
  });
}