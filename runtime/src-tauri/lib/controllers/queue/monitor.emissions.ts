/**
 * controllers/queue/monitor.emissions.ts
 */
import { recordEmission } from '../../fsm/telemetry/emissions';

export function recordQueueMonitorCall(args: {
  op: 'mount' | 'unmount' | 'refetch';
  success: boolean;
  latency_ms?: number;
  error_kind?: string;
}): void {
  recordEmission({
    domain: 'queue-monitor',
    fromState: 'IDLE',
    toState: args.success ? 'IDLE' : 'ERROR',
    event: `controller.queue.monitor.${args.op}`,
    payload: {
      op: args.op,
      success: args.success,
      latency_ms: args.latency_ms ?? 0,
      error_kind: args.error_kind ?? null,
    },
  });
}