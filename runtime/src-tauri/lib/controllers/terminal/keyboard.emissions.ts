/**
 * controllers/terminal/keyboard.emissions.ts
 */
import { recordEmission } from '../../fsm/telemetry/emissions';

export function recordTerminalKeyboardCall(args: {
  op: 'register' | 'unregister' | 'history_up' | 'history_down' | 'add_to_history';
  success: boolean;
  latency_ms?: number;
  error_kind?: string;
}): void {
  recordEmission({
    domain: 'health',
    fromState: 'IDLE',
    toState: args.success ? 'IDLE' : 'ERROR',
    event: `controller.terminal.keyboard.${args.op}`,
    payload: {
      op: args.op,
      success: args.success,
      latency_ms: args.latency_ms ?? 0,
      error_kind: args.error_kind ?? null,
    },
  });
}