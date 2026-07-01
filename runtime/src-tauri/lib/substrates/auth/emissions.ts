/**
 * substrates/auth/emissions.ts
 *
 * Fire-and-forget emission hooks for the auth substrate. Each
 * public call into auth/login, auth/logout, auth/refresh,
 * auth/getSession, etc. records a SUBSTRATE_AUTH emission on the
 * local telemetry plane.
 *
 * Direction: auth.ts → ./emissions.ts → fsm/telemetry/emissions.ts.
 * The substrate's public surface is unchanged (IP3). The emission
 * is fire-and-forget and never throws.
 *
 * IP4 note: this file IS the wrapper — callers don't need to call
 * the recorder explicitly. Instead, store.ts calls it inline at
 * the top of each public method.
 */

import { recordEmission } from '../../fsm/telemetry/emissions';

/** Record an auth-substrate call. */
export function recordAuthCall(args: {
  op: 'login' | 'admin_login' | 'logout' | 'refresh_token' | 'update_user'
    | 'check_admin_access' | 'sign_in_with_email' | 'get_dev_admin_env'
    | 'set_dev_admin_env' | 'start_listener' | 'stop_listener';
  success: boolean;
  latency_ms?: number;
  error_kind?: string;
}): void {
  recordEmission({
    domain: 'health', // Auth touches the health/agent domain; closest mapped DomainId.
    fromState: 'IDLE',
    toState: args.success ? 'IDLE' : 'ERROR',
    event: `auth.${args.op}`,
    payload: {
      op: args.op,
      success: args.success,
      latency_ms: args.latency_ms ?? 0,
      error_kind: args.error_kind ?? null,
    },
  });
}