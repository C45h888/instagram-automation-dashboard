/**
 * fsm/contracts/worker.ts
 *
 * Worker types — bounded-worker substrate primitives. Matches the
 * shape of the Rust-side WorkerLease but adds FSM-side intent and
 * completion shapes.
 */

import type { WorkerLease as IpcWorkerLease } from '../../substrates/redis/types';

/** A lease returned by the kernel via the substrate. */
export type WorkerLease = IpcWorkerLease;

/** Intent — what a bounded worker is asked to execute. The FSM
 *  builds intents from a transition; the worker only knows how to
 *  run them and report completion. */
export type WorkerIntent =
  | { kind: 'noop' }
  | { kind: 'retry-fetch'; domain: string; payload?: Record<string, unknown> }
  | { kind: 'local-fallback'; domain: string; payload?: Record<string, unknown> };

/** Completion — what a worker reports back after running an intent. */
export type WorkerCompletion =
  | { kind: 'success'; intent: WorkerIntent; observedAtEpochMs: number }
  | { kind: 'failure'; intent: WorkerIntent; reason: string; observedAtEpochMs: number };