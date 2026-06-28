// =====================================
// SLOT CONTRACT — Phase 3c
// Framework-neutral primitive for the auth module's reactive state.
// NO zustand, NO svelte. Just a writable<T>/derived<T> shape that
// any framework adapter can implement.
//
// Why this exists: the auth module is migrating from zustand to
// svelte/store as part of the Svelte rewrite. The store logic itself
// (what state to hold, when to update, what to persist) is stable
// across both impls. This file is the stable interface between the
// auth state machine and whatever framework is hosting it.
//
// Today: substrates/auth/store.ts implements WritableSlot on top of
//        zustand. Pass 6.
// Later: when Svelte lands, a svelte/store impl replaces it. Phase 7.
// Both impls satisfy the same interface, so consumers don't change.
// =====================================

// =====================================
// READABLE — passive observation only
// =====================================

/**
 * A readable value with subscribe semantics. Mirrors svelte/store's
 * Readable<T> interface (get + subscribe), minus any framework import.
 *
 * `subscribe` is called immediately with the current value, then
 * again on every change. Returns an unsubscribe function.
 */
export interface ReadableSlot<T> {
  get(): T;
  subscribe(fn: (value: T) => void): () => void;
}

// =====================================
// WRITABLE — read + write
// =====================================

/**
 * A readable value that can also be written. Mirrors svelte/store's
 * Writable<T> interface (set + update), minus the framework import.
 *
 * `set` replaces the value entirely. `update` derives a new value
 * from the current one (atomic from the caller's perspective; the
 * impl decides whether to dedupe or batch).
 */
export interface WritableSlot<T> extends ReadableSlot<T> {
  set(value: T): void;
  update(fn: (current: T) => T): void;
}

// =====================================
// DERIVED — composed from other slots
// =====================================

/**
 * A read-only slot whose value is computed from one or more source
 * slots. Mirrors svelte/store's derived<T,S> shape.
 *
 * The concrete DerivedSlot type is created via createDerived() below
 * and does not extend WritableSlot — derived values are not directly
 * writable. To "write" a derived, write to one of its sources.
 */
export interface DerivedSlot<T> extends ReadableSlot<T> {
  // Read-only by contract. No set / update methods.
}

// =====================================
// FACTORY: createWritable
// =====================================

/**
 * Creates a fresh WritableSlot with the given initial value and a
 * set of subscriber callbacks. The slot is independent — multiple
 * createWritable calls produce independent slots with no shared state.
 *
 * This factory is the canonical impl. Framework-specific adapters
 * (zustand, svelte/store) wrap this same shape.
 */
export function createWritable<T>(initial: T): WritableSlot<T> {
  let value = initial;
  const subscribers = new Set<(value: T) => void>();

  return {
    get: () => value,
    set: (next: T) => {
      if (Object.is(value, next)) return;
      value = next;
      for (const fn of subscribers) fn(value);
    },
    update: (fn: (current: T) => T) => {
      const next = fn(value);
      if (Object.is(value, next)) return;
      value = next;
      for (const s of subscribers) s(value);
    },
    subscribe: (fn: (value: T) => void) => {
      subscribers.add(fn);
      // Emit current value immediately on subscribe (svelte semantics).
      fn(value);
      return () => {
        subscribers.delete(fn);
      };
    },
  };
}

// =====================================
// FACTORY: createDerived
// =====================================

/**
 * Creates a DerivedSlot whose value is the result of calling `derive`
 * with the current values of all source slots. The derived slot
 * updates automatically whenever any source changes.
 *
 * Edge case: if any source has no value (ReadableSlot with undefined
 * initial), `derive` receives undefined for that source. The derive
 * function decides how to handle it.
 *
 * Memory: the derived slot holds a reference to each source. The
 * source slots must outlive the derived slot, or the subscribe
 * callbacks become no-ops on dead references. Callers manage this
 * via module-level slot definitions (singleton scope).
 */
export function createDerived<T, S>(
  sources: ReadableSlot<S>[],
  derive: (values: S[]) => T,
): DerivedSlot<T> {
  // Initial computation — synchronously read all sources.
  let value: T = derive(sources.map((s) => s.get()));
  const subscribers = new Set<(value: T) => void>();

  // Subscribe to each source. On any source change, recompute and
  // notify derived subscribers. Cleanup is per-source.
  const unsubscribers = sources.map((source) =>
    source.subscribe(() => {
      const next = derive(sources.map((s) => s.get()));
      if (Object.is(value, next)) return;
      value = next;
      for (const fn of subscribers) fn(value);
    }),
  );

  return {
    get: () => value,
    subscribe: (fn: (value: T) => void) => {
      subscribers.add(fn);
      fn(value); // emit current value immediately (svelte semantics)
      return () => {
        subscribers.delete(fn);
        // When the last derived subscriber leaves, we leak the source
        // subscriptions. In a singleton-scope design (module-level
        // slots that outlive all components) this is fine. In a
        // dynamic-scope design the caller must add a teardown hook.
        if (subscribers.size === 0) {
          unsubscribers.forEach((u) => u());
        }
      };
    },
  };
}
