/**
 * fsm/state/scheduled-posts.ts
 *
 * scheduled-posts domain state machine (FSM-GSC-2 §4.2).
 *
 * Substates derived from scheduled-posts.service.ts operations:
 *   IDLE       — no operation requested
 *   FETCHING   — getScheduledPosts in flight
 *   READY      — fetch returned, awaiting user action
 *   APPROVING  — updateScheduledPostStatus(postId, 'approved') in flight
 *   REJECTING  — updateScheduledPostStatus(postId, 'rejected') in flight
 *   RESETTING  — updateScheduledPostStatus(postId, 'pending') in flight
 *   ERROR      — operation failed, retry exhausted
 *   DEGRADED   — Redis transport unreachable
 *
 * Note: the underlying `ScheduledPostStatus` ('pending'|'approved'|
 * 'rejected'|'published'|'failed') is a Supabase row-level enum; the
 * FSM substates are OPERATION-level, not row-level.
 */

import { BaseStateMachine, type TransitionRule } from './base';

export type ScheduledPostsState =
  | 'IDLE'
  | 'FETCHING'
  | 'READY'
  | 'APPROVING'
  | 'REJECTING'
  | 'RESETTING'
  | 'ERROR'
  | 'DEGRADED';

export type ScheduledPostsEvent =
  | 'mount'
  | 'fetch-success'
  | 'fetch-error'
  | 'approve-start'
  | 'approve-success'
  | 'approve-error'
  | 'reject-start'
  | 'reject-success'
  | 'reject-error'
  | 'reset-start'
  | 'reset-success'
  | 'reset-error'
  | 'heartbeat-down'
  | 'heartbeat-up';

const RULES: ReadonlyArray<TransitionRule<ScheduledPostsState, ScheduledPostsEvent>> = [
  { from: 'IDLE',      event: 'mount',           to: 'FETCHING' },
  { from: 'FETCHING',  event: 'fetch-success',   to: 'READY' },
  { from: 'FETCHING',  event: 'fetch-error',     to: 'ERROR' },
  { from: 'READY',     event: 'approve-start',   to: 'APPROVING' },
  { from: 'READY',     event: 'reject-start',    to: 'REJECTING' },
  { from: 'READY',     event: 'reset-start',     to: 'RESETTING' },
  { from: 'APPROVING', event: 'approve-success', to: 'READY' },
  { from: 'APPROVING', event: 'approve-error',   to: 'ERROR' },
  { from: 'REJECTING', event: 'reject-success',  to: 'READY' },
  { from: 'REJECTING', event: 'reject-error',    to: 'ERROR' },
  { from: 'RESETTING', event: 'reset-success',   to: 'READY' },
  { from: 'RESETTING', event: 'reset-error',     to: 'ERROR' },
  { from: 'ERROR',     event: 'fetch-success',   to: 'READY' },
  // DEGRADED can be entered from any operational state.
  { from: 'IDLE',      event: 'heartbeat-down',  to: 'DEGRADED' },
  { from: 'FETCHING',  event: 'heartbeat-down',  to: 'DEGRADED' },
  { from: 'READY',     event: 'heartbeat-down',  to: 'DEGRADED' },
  { from: 'APPROVING', event: 'heartbeat-down',  to: 'DEGRADED' },
  { from: 'REJECTING', event: 'heartbeat-down',  to: 'DEGRADED' },
  { from: 'RESETTING', event: 'heartbeat-down',  to: 'DEGRADED' },
  { from: 'ERROR',     event: 'heartbeat-down',  to: 'DEGRADED' },
  // Recovery — return to READY (the most common operational state).
  { from: 'DEGRADED',  event: 'heartbeat-up',    to: 'READY' },
];

export function createScheduledPostsMachine(
  initial: ScheduledPostsState = 'IDLE',
): BaseStateMachine<ScheduledPostsState, ScheduledPostsEvent> {
  return new (class extends BaseStateMachine<ScheduledPostsState, ScheduledPostsEvent> {})(
    initial,
    RULES,
  );
}

/** Stable list of the FSM's transitions — exported for tests and
 *  for documentation generators. */
export const SCHEDULED_POSTS_TRANSITIONS: ReadonlyArray<TransitionRule<ScheduledPostsState, ScheduledPostsEvent>> = RULES;