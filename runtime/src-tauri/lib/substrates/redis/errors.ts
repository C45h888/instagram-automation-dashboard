/**
 * substrates/redis/errors.ts
 *
 * Substrate-level error envelope. Maps IPC errors (and any other
 * substrate failures) to a typed shape the FSM can pattern-match on.
 *
 * The substrate is the boundary where `IpcError` from the kernel is
 * translated into `RedisSubstrateError`. FSM code never sees an
 * `IpcError`; it only sees `RedisSubstrateError`.
 */

import { IpcError } from '../../ipc/errors';

/** Substrate error variants. Each carries the underlying message
 *  for diagnostic purposes but the FSM should pattern-match on
 *  `kind`, not on the message string. */
export type RedisSubstrateErrorKind =
  | 'REDIS_UNREACHABLE'
  | 'REDIS_AUTH_FAILED'
  | 'REDIS_COMMAND_FAILED'
  | 'REDIS_TIMEOUT'
  | 'REDIS_SERIALIZATION_FAILED'
  | 'REDIS_WORKER_EXHAUSTED'
  | 'REDIS_UNKNOWN';

export class RedisSubstrateError extends Error {
  public readonly kind: RedisSubstrateErrorKind;
  public readonly source?: IpcError;

  constructor(kind: RedisSubstrateErrorKind, message: string, source?: IpcError) {
    super(message);
    this.name = 'RedisSubstrateError';
    this.kind = kind;
    this.source = source;
  }

  /** Map an IpcError (or any unknown error) to a RedisSubstrateError. */
  static fromUnknown(err: unknown): RedisSubstrateError {
    if (err instanceof RedisSubstrateError) return err;
    if (err instanceof IpcError) {
      // Map IpcError kinds to substrate kinds. The kernel returns
      // `kind: "RUNTIME_REDIS_ERROR"` for all Redis ops; we don't
      // yet have granularity for AUTH vs timeout vs unreachable,
      // so they all collapse to REDIS_UNREACHABLE. Future kernel
      // work can surface more specific kinds.
      const substrateKind: RedisSubstrateErrorKind =
        err.kind === 'RUNTIME_REDIS_ERROR'
          ? 'REDIS_UNREACHABLE'
          : 'REDIS_UNKNOWN';
      return new RedisSubstrateError(
        substrateKind,
        err.message,
        err,
      );
    }
    if (err instanceof Error) {
      return new RedisSubstrateError('REDIS_UNKNOWN', err.message);
    }
    return new RedisSubstrateError('REDIS_UNKNOWN', String(err));
  }
}