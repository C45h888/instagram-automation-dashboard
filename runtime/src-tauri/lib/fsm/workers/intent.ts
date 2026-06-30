/**
 * fsm/workers/intent.ts
 *
 * Re-export of the intent/completion types from contracts/worker.ts
 * for ergonomic imports from inside the workers/ subtree.
 */

export type { WorkerIntent, WorkerCompletion, WorkerLease } from '../contracts/worker';