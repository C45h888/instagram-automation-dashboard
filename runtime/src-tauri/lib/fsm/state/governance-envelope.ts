/**
 * fsm/state/governance-envelope.ts
 *
 * Generic GovernanceEnvelope wrapper. Applies the cross-cutting FSM
 * concerns to a domain's BaseStateMachine:
 *   - correlation-id propagation (per-boot, from runtime_get_correlation_id)
 *   - lineage emission via transport (RPUSH + XADD)
 *   - local ring buffer write
 *   - DEGRADED observation (heartbeat-driven)
 *   - projection emission to subscribers
 *
 * This is the file the per-domain state machines consume.
 */

import type { DomainId } from '../contracts/domain';
import type {
  GovernanceEnvelope,
  EnvelopeSnapshot,
  TransitionResult,
} from '../contracts/governance';
import type {
  Transition,
  TransitionInput,
  TransitionOutput,
} from '../contracts/transition';
import type { LineageEntry } from '../contracts/lineage-entry';
import { BaseStateMachine } from './base';
import { buildTransition } from '../contracts/transition';
import { LocalTelemetryPlane } from '../telemetry/plane';
import type { FsmTransport } from '../transport/redis';
import { createHeartbeatMonitor, type HeartbeatMonitor } from '../transport/reconnect';

export interface GovernanceEnvelopeOptions<S extends string> {
  readonly domain: DomainId;
  readonly machine: BaseStateMachine<S, string>;
  readonly transport: FsmTransport;
  readonly plane: LocalTelemetryPlane;
  readonly correlationId: string;
  /** Optional — defaults to FSM spec value (4). */
  readonly heartbeatIntervalMs?: number;
  /** Optional hook called after a successful transition lands. */
  readonly onTransition?: (entry: LineageEntry) => void;
  /** Optional hook called when DEGRADED state changes. */
  readonly onDegradedChange?: (degraded: boolean, reason?: string) => void;
  /** Initial state used when rehydrate is not called. */
  readonly initialState: S;
  /** Rehydrated state (from transport). If omitted, the envelope
   *  starts in `initialState`. */
  readonly rehydratedState?: S;
}

export class GovernanceEnvelopeImpl<S extends string, O extends TransitionOutput>
  implements GovernanceEnvelope<S, TransitionInput, O>
{
  public readonly domain: DomainId;
  private readonly machine: BaseStateMachine<S, string>;
  private readonly transport: FsmTransport;
  private readonly plane: LocalTelemetryPlane;
  private readonly correlationId: string;
  private readonly heartbeat: HeartbeatMonitor;
  private readonly listeners: Set<(snapshot: EnvelopeSnapshot<S>) => void> = new Set();
  private readonly onTransitionHook?: (entry: LineageEntry) => void;
  private readonly onDegradedChangeHook?: (degraded: boolean, reason?: string) => void;
  private disposed = false;

  constructor(opts: GovernanceEnvelopeOptions<S>) {
    this.domain = opts.domain;
    this.machine = opts.machine;
    this.transport = opts.transport;
    this.plane = opts.plane;
    this.correlationId = opts.correlationId;
    this.onTransitionHook = opts.onTransition;
    this.onDegradedChangeHook = opts.onDegradedChange;
    if (opts.rehydratedState) {
      this.machine.forceState(opts.rehydratedState);
    }
    this.heartbeat = createHeartbeatMonitor(opts.transport, {
      intervalMs: opts.heartbeatIntervalMs,
    });
    this.heartbeat.subscribe((healthy, reason) => {
      this.onDegradedChangeHook?.(!healthy, reason);
      this.emit();
    });
  }

  startHeartbeat(): void {
    this.heartbeat.start(this.domain, this.correlationId);
  }

  currentState(): S {
    return this.machine.current;
  }

  history(): ReadonlyArray<LineageEntry> {
    return this.plane.getRecentTransitions(this.domain, this.plane.sizeFor(this.domain));
  }

  isDegraded(): boolean {
    return !this.heartbeat.isHealthy();
  }

  degradedReason(): string | undefined {
    return this.heartbeat.lastFailureReason();
  }

  async submit(input: TransitionInput): Promise<TransitionResult<O>> {
    if (this.disposed) {
      return {
        kind: 'rejected',
        reason: 'envelope disposed',
        fromState: this.machine.current,
        attemptedState: input.toState,
      };
    }

    const fromState = this.machine.current;
    const attempt = this.machine.attempt({
      from: fromState,
      event: input.event,
      payload: input.payload,
    });

    if (attempt.kind === 'rejected') {
      return {
        kind: 'rejected',
        reason: attempt.reason,
        fromState,
        attemptedState: input.toState,
      };
    }

    const transition = buildTransition({
      correlationId: this.correlationId,
      domain: this.domain,
      fromState,
      input,
    });

    const entryId = this.plane.nextEntryId(this.domain);
    const entry: LineageEntry = {
      entryId,
      transition,
      bufferedAtEpochMs: Date.now(),
    };
    this.plane.recordTransition(entry);

    this.onTransitionHook?.(entry);
    this.emit();

    // Best-effort: emit to backend lineage via transport. Failures
    // are observed by the heartbeat (separate timer); we don't block
    // the submit() promise on the transport.
    void this.transport.publishTransition(transition).catch(() => {
      // Heartbeat will surface the failure as DEGRADED. We don't
      // double-log here.
    });

    return {
      kind: 'ok',
      output: this.buildOutput(transition),
      transition,
    };
  }

  subscribe(listener: (snapshot: EnvelopeSnapshot<S>) => void): () => void {
    this.listeners.add(listener);
    // Push an initial snapshot so consumers don't need to special-case.
    listener(this.snapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.heartbeat.stop();
    this.listeners.clear();
  }

  snapshot(): EnvelopeSnapshot<S> {
    return {
      domain: this.domain,
      currentState: this.machine.current,
      history: this.history(),
      degraded: this.isDegraded(),
      degradedReason: this.degradedReason(),
    };
  }

  private buildOutput(transition: Transition): O {
    // The default O shape is built from the transition record. Domain
    // envelopes may override by passing a custom builder — kept
    // simple here.
    return {
      transitionId: transition.transition_id,
      ledgerIndex: 0, // updated async by transport; placeholder until ack
      streamId: '',   // ditto
      occurredAtEpochMs: transition.occurred_at_epoch_ms,
    } as unknown as O;
  }

  private emit(): void {
    const snap = this.snapshot();
    for (const l of this.listeners) l(snap);
  }
}