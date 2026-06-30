/**
 * fsm/contracts/lineage-entry.ts
 *
 * LineageEntry — the projection view of a transition as it appears in
 * the local telemetry ring buffer. Distinct from `Transition` only in
 * that LineageEntry is read-only and indexed by entry id.
 */

import type { Transition } from './transition';

export interface LineageEntry {
  /** Monotonically-increasing entry id assigned by the ring buffer. */
  readonly entryId: number;
  /** The transition this entry records. */
  readonly transition: Transition;
  /** Wall-clock time the local buffer accepted the entry. */
  readonly bufferedAtEpochMs: number;
}