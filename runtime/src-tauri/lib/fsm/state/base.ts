/**
 * fsm/state/base.ts
 *
 * BaseStateMachine — abstract scaffolding every domain's FSM extends.
 * Holds the current state, transitions table, and guards.
 *
 * Subclasses supply:
 *   - The states enum (string union).
 *   - The transitions table: { from: state, event: string, to: state, guard? }.
 *   - An optional onTransition hook (logging, projection, side effects).
 *
 * The base class itself does no I/O. Persistence and emission live
 * in the GovernanceEnvelope wrapper.
 */

export interface TransitionRule<S extends string, E extends string> {
  readonly from: S;
  readonly event: E;
  readonly to: S;
  /** Optional guard. Return false to reject the transition. */
  readonly guard?: (payload: Record<string, unknown> | undefined) => boolean;
}

export interface TransitionAttempt<S extends string, E extends string> {
  readonly from: S;
  readonly event: E;
  readonly payload?: Record<string, unknown>;
}

export type TransitionAttemptResult<S extends string> =
  | { kind: 'ok'; to: S }
  | { kind: 'rejected'; reason: string };

export abstract class BaseStateMachine<S extends string, E extends string> {
  protected _current: S;
  private readonly _rules: ReadonlyArray<TransitionRule<S, E>>;

  constructor(initial: S, rules: ReadonlyArray<TransitionRule<S, E>>) {
    this._current = initial;
    this._rules = rules;
  }

  get current(): S {
    return this._current;
  }

  /** All rules — used by introspection and tests. */
  rules(): ReadonlyArray<TransitionRule<S, E>> {
    return this._rules;
  }

  /** Attempt a transition. Pure — does not call hooks. Callers
   *  (GovernanceEnvelope) drive hooks and persistence. */
  attempt(attempt: TransitionAttempt<S, E>): TransitionAttemptResult<S> {
    const candidate = this._rules.find(
      (r) => r.from === attempt.from && r.event === attempt.event,
    );
    if (!candidate) {
      return {
        kind: 'rejected',
        reason: `no rule for ${attempt.from} --${attempt.event}-->`,
      };
    }
    if (candidate.guard && !candidate.guard(attempt.payload)) {
      return {
        kind: 'rejected',
        reason: `guard rejected ${attempt.from} --${attempt.event}--> ${candidate.to}`,
      };
    }
    this._current = candidate.to;
    return { kind: 'ok', to: candidate.to };
  }

  /** Force-set the current state. Used by rehydrate. */
  forceState(state: S): void {
    this._current = state;
  }
}