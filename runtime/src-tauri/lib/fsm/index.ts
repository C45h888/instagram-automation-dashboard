/**
 * fsm/index.ts — public surface barrel for the WebView FSM.
 *
 * Consumers import from this file. Internal paths under fsm/ are
 * not part of the public API and may move.
 */

export * from './contracts';
export {
  createRingBuffer,
  type RingBuffer,
} from './telemetry/ring-buffer';
export {
  LocalTelemetryPlane,
  DEFAULT_RING_BUFFER_CAPACITY,
} from './telemetry/plane';
export {
  createWorkerPool,
  DEFAULT_POOL_SIZE,
  DEFAULT_QUEUE_CAPACITY,
  type WorkerPool,
  type WorkerExecutor,
  type CreateWorkerPoolOptions,
} from './workers/pool';
export type { WorkerIntent, WorkerCompletion, WorkerLease } from './contracts/worker';
export {
  createFsmTransport,
  fsmTransport,
  type FsmTransport,
} from './transport/redis';
export {
  createHeartbeatMonitor,
  DEFAULT_HEARTBEAT_INTERVAL_MS,
  type HeartbeatMonitor,
  type HealthListener,
  type CreateHeartbeatMonitorOptions,
} from './transport/reconnect';
export { rehydrateDomain, findLatestValidState } from './transport/rehydrate';
export {
  BaseStateMachine,
  type TransitionRule,
  type TransitionAttempt,
  type TransitionAttemptResult,
} from './state/base';
export {
  GovernanceEnvelopeImpl,
  type GovernanceEnvelopeOptions,
} from './state/governance-envelope';
export {
  createAnalyticsReportsMachine,
  ANALYTICS_REPORTS_TRANSITIONS,
  type AnalyticsReportsState,
  type AnalyticsReportsEvent,
} from './state/analytics-reports';
export {
  createScheduledPostsMachine,
  SCHEDULED_POSTS_TRANSITIONS,
  type ScheduledPostsState,
  type ScheduledPostsEvent,
} from './state/scheduled-posts';
export {
  createFsmKernel,
  type FsmKernel,
  type FsmKernelOptions,
  type AnalyticsReportsEnvelope,
  type ScheduledPostsEnvelope,
} from './state/wiring';