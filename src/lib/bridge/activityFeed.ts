/**
 * Controller for useActivityFeed — Phase 2 bridge layer.
 *
 * Contract preserved (byte-identical to the React hook):
 *   - Initial fetch: AgentService.getAuditLog(50) — one-shot on boot
 *   - staleTime: Infinity — Realtime subscription handles all subsequent updates
 *   - Realtime subscription: INSERT on audit_log, channel 'audit-log-live'
 *   - Client-side filter on details.business_account_id (JSONB, not a column)
 *   - 50-event cap on prepend
 *   - refetch() calls AgentService.getAuditLog(50) directly, re-filters
 *
 * Framework-agnostic: no React, no TanStack Query.
 * Realtime subscription and manual fetch implemented directly.
 *
 * The React hook (useActivityFeed.ts) is refactored to consume this
 * controller via useSyncExternalStore. Public exports unchanged:
 *   - UseActivityFeedResult interface
 */

import { AgentService } from '../../services/agentService';
import { supabase } from '../../lib/supabase';
import type { AuditLogEntry } from '../../../runtime/web/src/lib/contracts/agent/agent-tables.contract';
import type { UseActivityFeedResult } from '../../hooks/useActivityFeed';
import type { ControllerSlot } from './controller';
import { DisposeScope, createControllerSlot } from './controller';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MAX_EVENTS = 50;

// ─────────────────────────────────────────────────────────────────────────────
// Internal state
// ─────────────────────────────────────────────────────────────────────────────

interface ActivityFeedInternalState {
  events: AuditLogEntry[];
  isLoading: boolean;
  error: string | null;
}

const INITIAL_STATE: ActivityFeedInternalState = {
  events: [],
  isLoading: true,
  error: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// Controller factory
// ─────────────────────────────────────────────────────────────────────────────

export function createActivityFeedController(
  businessAccountId: string | null,
): {
  state(): UseActivityFeedResult;
  subscribe(listener: (state: UseActivityFeedResult) => void): () => void;
  refetch(): Promise<void>;
  dispose(): void;
} {
  const slot: ControllerSlot<ActivityFeedInternalState> = createControllerSlot(INITIAL_STATE);
  const dispose = new DisposeScope();

  function setState(patch: Partial<ActivityFeedInternalState>): void {
    slot.setState(patch);
  }

  function errorFrom(e: unknown): string {
    if (e instanceof Error) return e.message;
    return String(e);
  }

  function filterEvents(all: AuditLogEntry[]): AuditLogEntry[] {
    if (!businessAccountId) return all;
    return all.filter(
      (e) => (e.details as Record<string, unknown> | null)?.business_account_id === businessAccountId,
    );
  }

  // Initial fetch
  async function fetchInitial(): Promise<void> {
    try {
      const result = await AgentService.getAuditLog(MAX_EVENTS);
      if (!result.success) throw new Error(result.error ?? 'Failed to fetch audit log');
      const filtered = filterEvents(result.data as AuditLogEntry[]);
      setState({ events: filtered, isLoading: false, error: null });
    } catch (err) {
      setState({ isLoading: false, error: errorFrom(err) });
    }
  }

  // Supabase Realtime subscription — INSERT on audit_log, filtered client-side
  function subscribeRealtime(): void {
    const channel = supabase
      .channel('audit-log-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'audit_log' },
        (payload) => {
          const newEntry = payload.new as AuditLogEntry;
          const details = newEntry.details as Record<string, unknown> | null;
          // Client-side JSONB filter (business_account_id is in details, not a column)
          if (details?.business_account_id !== businessAccountId) return;
          // Prepend and cap at MAX_EVENTS
          slot.setState((s) => ({
            events: [newEntry, ...s.events].slice(0, MAX_EVENTS),
          }));
        },
      )
      .subscribe();

    dispose.add(() => {
      void supabase.removeChannel(channel);
    });
  }

  // Refetch — calls AgentService directly, re-filters
  async function refetch(): Promise<void> {
    const result = await AgentService.getAuditLog(MAX_EVENTS);
    if (!result.success) throw new Error(result.error ?? 'Failed to fetch audit log');
    const filtered = filterEvents(result.data as AuditLogEntry[]);
    setState({ events: filtered, error: null });
  }

  // Boot
  void fetchInitial();
  subscribeRealtime();

  return {
    state: () => {
      const s = slot.state();
      return {
        events: s.events,
        isLoading: s.isLoading,
        error: s.error,
        refetch,
      };
    },
    subscribe: (listener) => slot.subscribe((s) => listener(buildResult(s))),
    refetch,
    dispose: () => dispose.dispose(),
  };

  function buildResult(s: ActivityFeedInternalState): UseActivityFeedResult {
    return {
      events: s.events,
      isLoading: s.isLoading,
      error: s.error,
      refetch,
    };
  }
}
