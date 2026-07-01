/**
 * controllers/primitives/controller.emissions.ts
 *
 * Emissions for the primitive ControllerSlot / DisposeScope. Only
 * setState is instrumented (NOT state() — that fires on every
 * reactivity tick and would flood the ring buffer).
 */
import { recordEmission } from '../../fsm/telemetry/emissions';

export function recordControllerPrimitiveCall(args: {
  op: 'set_state' | 'subscribe' | 'dispose_scope';
  success: boolean;
  latency_ms?: number;
  error_kind?: string;
}): void {
  recordEmission({
    domain: 'health',
    fromState: 'IDLE',
    toState: args.success ? 'IDLE' : 'ERROR',
    event: `controller.primitive.${args.op}`,
    payload: {
      op: args.op,
      success: args.success,
      latency_ms: args.latency_ms ?? 0,
      error_kind: args.error_kind ?? null,
    },
  });
}