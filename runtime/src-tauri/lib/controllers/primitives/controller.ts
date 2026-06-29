/**
 * Controller — UI-framework-agnostic reactive state container.
 *
 * Phase 2 contract: each T1 hook gets a Controller implementation
 * that exposes the same state + actions as the React hook, but does
 * NOT depend on React. Both the current React hook and the future
 * Svelte store consume the controller via `state()` / `subscribe()`.
 *
 * The Controller interface is intentionally minimal — a synchronous
 * read and a subscribe/unubscribe pair. Anything more complex belongs
 * in the controller implementation, not the interface.
 *
 * Why this exists:
 * - The T1 contracts (polling interval, SSE wire shapes, persistence
 *   keys, query keys) are owned by the business layer. They do NOT
 *   change when we migrate React → Svelte.
 * - Hook bodies are framework-bound (useState, useEffect, useRef,
 *   useQuery). Refactoring each one to delegate to a controller means
 *   the framework glue moves out and the contract logic stays put.
 * - Phase 7's Svelte adapters consume the same controllers, so the
 *   migration is "swap the binding layer, keep the contract".
 */

export interface Controller<State> {
  /** Synchronous read of current state. */
  state(): State;
  /**
   * Subscribe to state changes. The listener is invoked synchronously
   * with the current state on subscribe (so the consumer can render
   * the initial value without a separate read). Returns an
   * unsubscribe function.
   */
  subscribe(listener: (state: State) => void): () => void;
}

/**
 * Helper for building a Controller over an in-memory state slot with
 * a list of subscribers. Controllers own a single mutable state slot;
 * they call `setState` (a closure) whenever business logic produces a
 * new state value.
 *
 * `setState` accepts either:
 * - a partial patch (merged into the current state via spread), or
 * - a function `(prev) => Partial<State>` (also merged).
 *
 * This mirrors React's `setState` ergonomics so controllers can write
 * `slot.setState({ isLoading: true })` or
 * `slot.setState((prev) => ({ alerts: [...prev.alerts, newOne] }))`
 * without manually spreading the whole state.
 */
export interface ControllerSlot<State> {
  state(): State;
  setState(patch: Partial<State> | ((prev: State) => Partial<State>)): void;
  subscribe(listener: (state: State) => void): () => void;
}

export function createControllerSlot<State>(initial: State): ControllerSlot<State> {
  let current: State = initial;
  const listeners = new Set<(state: State) => void>();

  return {
    state: () => current,
    setState: (patch) => {
      const resolvedPatch =
        typeof patch === 'function'
          ? (patch as (prev: State) => Partial<State>)(current)
          : patch;
      const next = { ...current, ...resolvedPatch };
      // Skip notification when the new state is referentially equal
      // to the current state. Controllers that wrap immutable updates
      // can rely on this short-circuit.
      if (Object.is(next, current)) return;
      current = next;
      for (const l of listeners) l(current);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      // Fire once on subscribe so consumers don't need a separate
      // initial read.
      listener(current);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * Dispose scope — collects cleanup functions and runs them all when
 * the controller is disposed. Used for canceling in-flight fetches,
 * unsubscribing from Realtime channels, and clearing intervals.
 */
export class DisposeScope {
  private cleanups: Array<() => void> = [];

  add(cleanup: () => void): void {
    this.cleanups.push(cleanup);
  }

  dispose(): void {
    // Run cleanups in reverse order so dependencies unwind in the
    // natural teardown order.
    for (let i = this.cleanups.length - 1; i >= 0; i--) {
      try {
        this.cleanups[i]!();
      } catch (err) {
        // Cleanup errors are logged but never re-thrown — disposal
        // must always complete.
        // eslint-disable-next-line no-console
        console.error('dispose cleanup threw:', err);
      }
    }
    this.cleanups = [];
  }
}
