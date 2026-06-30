/**
 * substrates/redis/substrate.ts
 *
 * RedisSubstrate — the canonical substrate the FSM uses to talk to
 * the kernel's Redis socket. Wraps the typed IPC wrappers in
 * `ipc/commands.ts` with substrate-level error mapping.
 *
 * Substrate contract:
 *   - One method per Redis op intent.
 *   - All methods throw `RedisSubstrateError` on failure.
 *   - The substrate is semantically blind — no FSM logic, no domain
 *     vocabulary.
 *   - The substrate never opens a Redis socket. It calls `invoke()`.
 */

import {
  fsmPublishTransition,
  fsmReadLineage,
  fsmRehydrateState,
  fsmAcquireWorker,
  fsmReleaseWorker,
  fsmEmitHeartbeat,
} from '../../ipc/commands';
import type {
  Transition,
  PublishReceipt,
  HeartbeatPayload,
  WorkerLease,
  DomainSnapshot,
} from '../../ipc/types';
import { RedisSubstrateError } from './errors';

export class RedisSubstrate {
  /** Publish a transition to the lineage ledger + WebView stream. */
  async publishTransition(transition: Transition): Promise<PublishReceipt> {
    try {
      return await fsmPublishTransition(transition);
    } catch (err) {
      throw RedisSubstrateError.fromUnknown(err);
    }
  }

  /** Read up to `count` most-recent transitions for a domain. */
  async readLineage(domain: string, count: number): Promise<Transition[]> {
    try {
      return await fsmReadLineage(domain, count);
    } catch (err) {
      throw RedisSubstrateError.fromUnknown(err);
    }
  }

  /** Snapshot of a domain — current state + recent transitions. */
  async rehydrateState(domain: string): Promise<DomainSnapshot> {
    try {
      return await fsmRehydrateState(domain);
    } catch (err) {
      throw RedisSubstrateError.fromUnknown(err);
    }
  }

  /** Try to acquire a bounded worker lease. Returns `null` when the
   *  pool is exhausted (not an error — the FSM treats this as a
   *  signal to emit DEGRADED). */
  async acquireWorker(): Promise<WorkerLease | null> {
    try {
      return await fsmAcquireWorker();
    } catch (err) {
      throw RedisSubstrateError.fromUnknown(err);
    }
  }

  /** Release a previously acquired lease. */
  async releaseWorker(lease: WorkerLease): Promise<void> {
    try {
      await fsmReleaseWorker(lease);
    } catch (err) {
      throw RedisSubstrateError.fromUnknown(err);
    }
  }

  /** Emit a liveness heartbeat observation for a domain. */
  async emitHeartbeat(payload: HeartbeatPayload): Promise<void> {
    try {
      await fsmEmitHeartbeat(payload);
    } catch (err) {
      throw RedisSubstrateError.fromUnknown(err);
    }
  }
}

/** Singleton instance — the FSM uses this directly. Tests may
 *  construct their own with a mocked transport. */
export const redisSubstrate = new RedisSubstrate();