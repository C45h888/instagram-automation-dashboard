/**
 * controllers/analytics/content.emissions.ts
 */
import { recordEmission } from '../../fsm/telemetry/emissions';

export function recordAnalyticsContentCall(args: {
  op: 'mount' | 'unmount' | 'refetch' | 'fetch';
  success: boolean;
  latency_ms?: number;
  error_kind?: string;
}): void {
  recordEmission({
    domain: 'analytics-reports',
    fromState: 'IDLE',
    toState: args.success ? 'IDLE' : 'ERROR',
    event: `controller.analytics.content.${args.op}`,
    payload: {
      op: args.op,
      success: args.success,
      latency_ms: args.latency_ms ?? 0,
      error_kind: args.error_kind ?? null,
    },
  });
}