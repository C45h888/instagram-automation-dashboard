/**
 * fsm/contracts/governance.ts
 *
 * GovernanceEnvelope — the FSM primitive that wraps every domain's
 * state machine. Carries the cross-cutting concerns: correlation-id
 * propagation, lineage emission, ring buffer write, projection
 * emission, and DEGRADED observation.
 */

import type { DomainId } from './domain';
import type { Transition, TransitionInput, TransitionOutput } from './transition';
import type { LineageEntry } from './lineage-entry';

export interface EnvelopeSnapshot<S> {
  readonly domain: DomainId;
  readonly currentState: S;
  readonly history: ReadonlyArray<LineageEntry>;
  readonly degraded: boolean;
  readonly degradedReason?: string;
}

export type TransitionResult<O> =
  | { kind: 'ok'; output: O; transition: Transition }
  | { kind: 'rejected'; reason: string; fromState: string; attemptedState: string }
  | { kind: 'degraded'; reason: string };

/** Generic GovernanceEnvelope interface — every domain's state
 *  machine conforms to this. */
export interface GovernanceEnvelope<S, I extends TransitionInput, O extends TransitionOutput> {
  readonly domain: DomainId;
  currentState(): S;
  history(): ReadonlyArray<LineageEntry>;
  isDegraded(): boolean;
  degradedReason(): string | undefined;
  submit(input: I): Promise<TransitionResult<O>>;
  subscribe(listener: (snapshot: EnvelopeSnapshot<S>) => void): () => void;
  dispose(): void;
}