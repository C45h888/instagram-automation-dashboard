/**
 * controllers/oversight/chat.emissions.ts
 */
import { recordEmission } from '../../fsm/telemetry/emissions';

export function recordOversightChatCall(args: {
  op: 'mount' | 'unmount' | 'refetch' | 'send' | 'regenerate';
  success: boolean;
  latency_ms?: number;
  error_kind?: string;
}): void {
  recordEmission({
    domain: 'activity-feed',
    fromState: 'IDLE',
    toState: args.success ? 'IDLE' : 'ERROR',
    event: `controller.oversight.chat.${args.op}`,
    payload: {
      op: args.op,
      success: args.success,
      latency_ms: args.latency_ms ?? 0,
      error_kind: args.error_kind ?? null,
    },
  });
}