/**
 * fsm/contracts/errors.ts
 *
 * FSM-level error types. Distinct from substrate errors
 * (`RedisSubstrateError`) and IPC errors (`IpcError`). FSM errors
 * describe governance-level failures: invalid transitions, exhausted
 * worker pool, transport unreachable, etc.
 */

export type FsmErrorKind =
  | 'INVALID_TRANSITION'
  | 'WORKER_QUEUE_FULL'
  | 'TRANSPORT_UNREACHABLE'
  | 'CORRELATION_ID_MISMATCH'
  | 'UNKNOWN_DOMAIN';

export class FsmError extends Error {
  public readonly kind: FsmErrorKind;
  public readonly context?: Record<string, unknown>;

  constructor(kind: FsmErrorKind, message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = 'FsmError';
    this.kind = kind;
    this.context = context;
  }
}