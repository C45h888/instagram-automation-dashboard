/**
 * controllers/agent/health.emissions.ts
 *
 * Fire-and-forget emission hooks for the agent health controller.
 * Per FSM-GSC-1 §6.3: every existing controller gains a paired
 * emissions.ts file. The controller's reactive surface is unchanged
 * for callers; emissions fire inline at every public method.
 */
import { recordEmission } from '../../fsm/telemetry/emissions';

export function recordAgentHealthCall(args: {
  op: 'mount' | 'unmount' | 'refetch' | 'poll';
  success: boolean;
  latency_ms?: number;
  error_kind?: string;
}): void {
  recordEmission({
    domain: 'health',
    fromState: 'IDLE',
    toState: args.success ? 'IDLE' : 'ERROR',
    event: `controller.agent.health.${args.op}`,
    payload: {
      op: args.op,
      success: args.success,
      latency_ms: args.latency_ms ?? 0,
      error_kind: args.error_kind ?? null,
    },
  });
}