/**
 * substrates/platform/emissions.ts
 *
 * Fire-and-forget emission hooks for the platform substrate
 * (browser metadata, viewport, OS detection).
 */

import { recordEmission } from '../../fsm/telemetry/emissions';

export function recordPlatformCall(args: {
  op: 'get_browser_metadata';
  success: boolean;
  latency_ms?: number;
  error_kind?: string;
}): void {
  recordEmission({
    domain: 'health',
    fromState: 'IDLE',
    toState: args.success ? 'IDLE' : 'ERROR',
    event: `platform.${args.op}`,
    payload: {
      op: args.op,
      success: args.success,
      latency_ms: args.latency_ms ?? 0,
      error_kind: args.error_kind ?? null,
    },
  });
}