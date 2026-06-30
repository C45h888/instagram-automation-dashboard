/**
 * fsm/state/wiring.ts
 *
 * Wire the FSM state machines for the Pass 1 governance-placed
 * domains (analytics-reports, scheduled-posts) into a single
 * construct used at app startup. This is the FSM "kernel" — it owns
 * the local telemetry plane, the per-domain envelopes, and the
 * heartbeat monitors.
 *
 * Direction: substrates → fsm never happens. The FSM consumes
 * substrates; the FSM owns governance.
 */

import type { DomainId } from '../contracts/domain';
import { LocalTelemetryPlane } from '../telemetry/plane';
import { createFsmTransport, type FsmTransport } from '../transport/redis';
import { GovernanceEnvelopeImpl } from './governance-envelope';
import { createAnalyticsReportsMachine, type AnalyticsReportsState, type AnalyticsReportsEvent } from './analytics-reports';
import { createScheduledPostsMachine, type ScheduledPostsState, type ScheduledPostsEvent } from './scheduled-posts';

export interface FsmKernelOptions {
  readonly correlationId: string;
  readonly transport?: FsmTransport;
  readonly planeCapacity?: number;
}

export interface AnalyticsReportsEnvelope {
  readonly domain: 'analytics-reports';
  currentState(): AnalyticsReportsState;
  history(): ReadonlyArray<import('../contracts/lineage-entry').LineageEntry>;
  isDegraded(): boolean;
  degradedReason(): string | undefined;
  submit(input: { toState: AnalyticsReportsState; event: AnalyticsReportsEvent; payload?: Record<string, unknown> }): Promise<unknown>;
  subscribe(listener: (snapshot: import('../contracts/governance').EnvelopeSnapshot<AnalyticsReportsState>) => void): () => void;
  dispose(): void;
}

export interface ScheduledPostsEnvelope {
  readonly domain: 'scheduled-posts';
  currentState(): ScheduledPostsState;
  history(): ReadonlyArray<import('../contracts/lineage-entry').LineageEntry>;
  isDegraded(): boolean;
  degradedReason(): string | undefined;
  submit(input: { toState: ScheduledPostsState; event: ScheduledPostsEvent; payload?: Record<string, unknown> }): Promise<unknown>;
  subscribe(listener: (snapshot: import('../contracts/governance').EnvelopeSnapshot<ScheduledPostsState>) => void): () => void;
  dispose(): void;
}

export interface FsmKernel {
  readonly plane: LocalTelemetryPlane;
  readonly analyticsReports: AnalyticsReportsEnvelope;
  readonly scheduledPosts: ScheduledPostsEnvelope;
  start(): void;
  dispose(): void;
}

/** Construct the FSM kernel for Pass 1 governance domains. */
export function createFsmKernel(opts: FsmKernelOptions): FsmKernel {
  const transport = opts.transport ?? createFsmTransport();
  const plane = new LocalTelemetryPlane(opts.planeCapacity);

  const analyticsMachine = createAnalyticsReportsMachine('IDLE');
  const analytics = new GovernanceEnvelopeImpl<AnalyticsReportsState, never>({
    domain: 'analytics-reports' as DomainId,
    machine: analyticsMachine,
    transport,
    plane,
    correlationId: opts.correlationId,
    initialState: 'IDLE',
  });

  const scheduledMachine = createScheduledPostsMachine('IDLE');
  const scheduled = new GovernanceEnvelopeImpl<ScheduledPostsState, never>({
    domain: 'scheduled-posts' as DomainId,
    machine: scheduledMachine,
    transport,
    plane,
    correlationId: opts.correlationId,
    initialState: 'IDLE',
  });

  return {
    plane,
    analyticsReports: analytics as unknown as AnalyticsReportsEnvelope,
    scheduledPosts: scheduled as unknown as ScheduledPostsEnvelope,
    start(): void {
      analytics.startHeartbeat();
      scheduled.startHeartbeat();
    },
    dispose(): void {
      analytics.dispose();
      scheduled.dispose();
    },
  };
}