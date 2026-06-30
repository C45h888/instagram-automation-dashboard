/**
 * fsm/telemetry/ring-buffer.ts
 *
 * Bounded append-only ring buffer. When the buffer is full, the
 * oldest entry is dropped. Entries are NEVER mutated after write.
 *
 * Capacity is fixed at construction. The default capacity (1024) is
 * the FSM spec value; tests construct smaller buffers to exercise
 * overflow.
 */

export interface RingBuffer<T> {
  /** Append a value. Returns the dropped value if overflow occurred. */
  push(value: T): T | undefined;
  /** Read the n most-recent values, newest first. */
  recent(n: number): ReadonlyArray<T>;
  /** All values in insertion order, oldest first. */
  toArray(): ReadonlyArray<T>;
  /** Index of the entry by its assigned id (0-based offset from the
   *  oldest currently-buffered entry). */
  getById(id: number): T | undefined;
  /** Total entries pushed (including dropped ones). Monotonic. */
  totalPushed(): number;
  /** Number of entries currently held. ≤ capacity. */
  size(): number;
  /** Capacity — max entries before drop-oldest kicks in. */
  capacity(): number;
  /** Drop everything. Used on rehydrate, NOT during normal operation. */
  clear(): void;
}

class RingBufferImpl<T> implements RingBuffer<T> {
  private readonly buffer: Array<T | undefined>;
  private head = 0; // index of oldest entry
  private count = 0; // current size
  private total = 0; // total pushed (monotonic)
  private nextId = 0; // monotonic entry id
  private readonly cap: number;

  constructor(cap: number) {
    if (cap <= 0) {
      throw new Error(`RingBuffer capacity must be > 0, got ${cap}`);
    }
    this.cap = cap;
    this.buffer = new Array<T | undefined>(cap);
  }

  push(value: T): T | undefined {
    let dropped: T | undefined;
    if (this.count === this.cap) {
      // Buffer full — drop the oldest at `head` and advance.
      dropped = this.buffer[this.head] as T;
      this.buffer[this.head] = value;
      this.head = (this.head + 1) % this.cap;
    } else {
      const tail = (this.head + this.count) % this.cap;
      this.buffer[tail] = value;
      this.count += 1;
    }
    this.total += 1;
    this.nextId += 1;
    return dropped;
  }

  recent(n: number): ReadonlyArray<T> {
    if (n <= 0) return [];
    const out: T[] = [];
    // Walk backwards from the newest entry.
    const start = (this.head + this.count - 1) % this.cap;
    let idx = start;
    for (let i = 0; i < Math.min(n, this.count); i += 1) {
      out.push(this.buffer[idx] as T);
      idx = (idx - 1 + this.cap) % this.cap;
    }
    return out;
  }

  toArray(): ReadonlyArray<T> {
    const out: T[] = [];
    for (let i = 0; i < this.count; i += 1) {
      out.push(this.buffer[(this.head + i) % this.cap] as T);
    }
    return out;
  }

  getById(id: number): T | undefined {
    // Entry ids are monotonic starting at 1. The oldest currently-
    // buffered entry has id = total - count + 1. Validate id is in
    // range, then compute offset.
    const oldestId = this.total - this.count + 1;
    const newestId = this.total;
    if (id < oldestId || id > newestId) return undefined;
    const offsetFromHead = id - oldestId;
    return this.buffer[(this.head + offsetFromHead) % this.cap];
  }

  totalPushed(): number {
    return this.total;
  }

  size(): number {
    return this.count;
  }

  capacity(): number {
    return this.cap;
  }

  clear(): void {
    this.head = 0;
    this.count = 0;
    // Don't reset total — entry ids remain monotonic across clears.
    this.buffer.fill(undefined);
  }
}

export function createRingBuffer<T>(capacity: number): RingBuffer<T> {
  return new RingBufferImpl<T>(capacity);
}