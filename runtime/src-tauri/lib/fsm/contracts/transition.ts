/**
 * fsm/contracts/transition.ts
 *
 * Transition / TransitionInput / TransitionOutput — the canonical
 * shapes the FSM uses internally. These wrap the IPC DTOs from
 * `substrates/redis/types.ts` (which mirror the Rust types) and add
 * FSM-level fields like `domain` as a typed enum.
 */

import type { DomainId } from './domain';
import type { Transition as IpcTransition } from '../../substrates/redis/types';

/** FSM-side Transition. snake_case mirrors the wire shape. */
export interface Transition extends IpcTransition {
  /** Strongly-typed domain. The wire DTO carries this as a string;
   *  after the substrate deserialises, the FSM narrows it. */
  domain: DomainId;
}

/** Input submitted to an FSM state machine. Carries the candidate
 *  `to_state` and the event that triggered it. */
export interface TransitionInput {
  /** The state the FSM is being asked to enter. */
  readonly toState: string;
  /** Event name — e.g. "mount", "fetch", "error", "recover". */
  readonly event: string;
  /** Optional free-form payload attached to the transition. */
  readonly payload?: Record<string, unknown>;
}

/** Output from a successful transition. Carries the receipt the
 *  substrate returned (ledger index, stream id) for observability. */
export interface TransitionOutput {
  readonly transitionId: string;
  readonly ledgerIndex: number;
  readonly streamId: string;
  readonly occurredAtEpochMs: number;
}

/** Build a Transition record from a domain, from/to states, event,
 *  and optional payload. Generates the transition_id and
 *  occurred_at_epoch_ms at call time. */
export function buildTransition(args: {
  correlationId: string;
  domain: DomainId;
  fromState: string;
  input: TransitionInput;
  correlationIdForCid?: string; // unused; kept for clarity
}): Transition {
  const transitionId = crypto.randomUUID();
  const occurredAtEpochMs = Date.now();
  return {
    transition_id: transitionId,
    correlation_id: args.correlationId,
    domain: args.domain,
    from_state: args.fromState,
    to_state: args.input.toState,
    event: args.input.event,
    payload: args.input.payload ?? null,
    occurred_at_epoch_ms: occurredAtEpochMs,
  };
}