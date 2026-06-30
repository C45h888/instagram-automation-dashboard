/**
 * fsm/telemetry/plane.ts
 *
 * LocalTelemetryPlane — collection of ring buffers, one per domain.
 * This is the FSM's local mutable plane. It is NOT canonical truth
 * (the backend's Redis lineage ledger is); it is a projection the
 * FSM reads from to drive controllers.
 *
 * Invariants:
 *   - Local plane is a projection. If it disagrees with Redis
 *     lineage, Redis wins.
 *   - Writes are synchronous.
 *   - No entry is mutated after write. Append-only.
 */

import type { DomainId } from '../contracts/domain';
import type { LineageEntry } from '../contracts/lineage-entry';
import { createRingBuffer, type RingBuffer } from './ring-buffer';

/** Default per-domain ring buffer capacity. Spec value 1024. */
export const DEFAULT_RING_BUFFER_CAPACITY = 1024;

export class LocalTelemetryPlane {
  private readonly buffers: Map<DomainId, RingBuffer<LineageEntry>> = new Map();
  private nextEntryIdByDomain: Map<DomainId, number> = new Map();
  private readonly capacity: number;

  constructor(capacity: number = DEFAULT_RING_BUFFER_CAPACITY) {
    if (capacity <= 0) {
      throw new Error(`LocalTelemetryPlane capacity must be > 0, got ${capacity}`);
    }
    this.capacity = capacity;
  }

  /** Record a transition as a LineageEntry in the buffer for its domain. */
  recordTransition(entry: LineageEntry): void {
    const buf = this.bufferFor(entry.transition.domain);
    buf.push(entry);
  }

  /** Get the most-recent N transitions for a domain, newest first. */
  getRecentTransitions(domain: DomainId, n: number): ReadonlyArray<LineageEntry> {
    return this.bufferFor(domain).recent(n);
  }

  /** Get the most-recent transition's state for a domain. */
  getCurrentState(domain: DomainId): string | undefined {
    const recent = this.bufferFor(domain).recent(1);
    return recent[0]?.transition.to_state;
  }

  /** Look up an entry by its assigned entry id within a domain. */
  getTransitionById(domain: DomainId, entryId: number): LineageEntry | undefined {
    return this.bufferFor(domain).getById(entryId);
  }

  /** Total entries ever pushed for a domain (including dropped). */
  totalPushedFor(domain: DomainId): number {
    return this.bufferFor(domain).totalPushed();
  }

  /** Size of the buffer for a domain. */
  sizeFor(domain: DomainId): number {
    return this.bufferFor(domain).size();
  }

  /** Allocate the next entry id for a domain. Monotonic per domain. */
  nextEntryId(domain: DomainId): number {
    const current = this.nextEntryIdByDomain.get(domain) ?? 0;
    const next = current + 1;
    this.nextEntryIdByDomain.set(domain, next);
    return next;
  }

  /** Drop the buffer for a domain. Used on rehydrate. */
  clearDomain(domain: DomainId): void {
    this.buffers.delete(domain);
  }

  /** Drop everything. Used on rehydrate. */
  clearAll(): void {
    this.buffers.clear();
  }

  private bufferFor(domain: DomainId): RingBuffer<LineageEntry> {
    let buf = this.buffers.get(domain);
    if (!buf) {
      buf = createRingBuffer<LineageEntry>(this.capacity);
      this.buffers.set(domain, buf);
    }
    return buf;
  }
}