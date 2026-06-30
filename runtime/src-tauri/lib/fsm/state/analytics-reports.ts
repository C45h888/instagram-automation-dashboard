/**
 * fsm/state/analytics-reports.ts
 *
 * analytics-reports domain state machine (FSM-GSC-2 §4.2).
 *
 * Substates derived from controllers/analytics/reports.ts lifecycle:
 *   IDLE      — controller not mounted, no businessAccountId
 *   POLLING   — fetch in flight
 *   STALE     — last successful fetch older than 20 min
 *   ERROR     — fetch failed, retry exhausted
 *   DEGRADED  — Redis transport unreachable; reads continue but
 *               lineage writes fail
 *
 * Transitions:
 *   IDLE → POLLING       on controller mount with valid businessAccountId
 *   POLLING → IDLE       when businessAccountId becomes null
 *   POLLING → POLLING     on successful fetch (re-enters with fresh data)
 *   POLLING → ERROR      on fetch failure after retry exhaustion
 *   ERROR → POLLING      on user-triggered refetch
 *   POLLING → STALE      when last success age > 20 min (timer-based)
 *   STALE → POLLING      on next successful fetch
 *   any → DEGRADED       on REDIS_UNREACHABLE heartbeat
 *   DEGRADED → <prev>    on heartbeat recovery
 */

import { BaseStateMachine, type TransitionRule } from './base';

export type AnalyticsReportsState =
  | 'IDLE'
  | 'POLLING'
  | 'STALE'
  | 'ERROR'
  | 'DEGRADED';

export type AnalyticsReportsEvent =
  | 'mount'
  | 'unmount'
  | 'fetch-success'
  | 'fetch-error'
  | 'refetch'
  | 'tick-stale'
  | 'heartbeat-down'
  | 'heartbeat-up';

const RULES: ReadonlyArray<TransitionRule<AnalyticsReportsState, AnalyticsReportsEvent>> = [
  { from: 'IDLE',     event: 'mount',          to: 'POLLING' },
  { from: 'POLLING',  event: 'unmount',        to: 'IDLE' },
  { from: 'POLLING',  event: 'fetch-success',  to: 'POLLING' },
  { from: 'POLLING',  event: 'fetch-error',    to: 'ERROR' },
  { from: 'ERROR',    event: 'refetch',        to: 'POLLING' },
  { from: 'POLLING',  event: 'tick-stale',     to: 'STALE' },
  { from: 'STALE',    event: 'fetch-success',  to: 'POLLING' },
  // DEGRADED can be entered from any state; the envelope observes the
  // degraded change and submits this event.
  { from: 'IDLE',     event: 'heartbeat-down', to: 'DEGRADED' },
  { from: 'POLLING',  event: 'heartbeat-down', to: 'DEGRADED' },
  { from: 'STALE',    event: 'heartbeat-down', to: 'DEGRADED' },
  { from: 'ERROR',    event: 'heartbeat-down', to: 'DEGRADED' },
  // Recovery transitions — the FSM doesn't track `previous` so we
  // can only route back to POLLING (the most common entry point).
  // Tests can override the recovery target via custom rules.
  { from: 'DEGRADED', event: 'heartbeat-up',   to: 'POLLING' },
];

export function createAnalyticsReportsMachine(
  initial: AnalyticsReportsState = 'IDLE',
): BaseStateMachine<AnalyticsReportsState, AnalyticsReportsEvent> {
  return new (class extends BaseStateMachine<AnalyticsReportsState, AnalyticsReportsEvent> {})(
    initial,
    RULES,
  );
}

/** Stable list of the FSM's transitions — exported for tests and
 *  for documentation generators. */
export const ANALYTICS_REPORTS_TRANSITIONS: ReadonlyArray<TransitionRule<AnalyticsReportsState, AnalyticsReportsEvent>> = RULES;