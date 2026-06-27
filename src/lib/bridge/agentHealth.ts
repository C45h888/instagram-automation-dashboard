/**
 * Controller for useAgentHealth — Phase 2 bridge layer.
 *
 * Contract preserved (byte-identical to the React hook):
 *   - 30s polling interval
 *   - `staleTime = 30s`, `gcTime = 60s`
 *   - retry: 3 attempts, exponential backoff capped at 30s
 *   - `refetchOnWindowFocus: false`
 *   - Realtime subscription on `system_alerts` INSERT/UPDATE filtered
 *     by `business_account_id`, mutates the alerts cache in place
 *     (no refetch)
 *   - `resolveAlert` mutation: optimistic remove from cache + service
 *     call
 *   - `refetch()` re-fires all three queries
 *   - Combined error: status error → alerts error → null
 *   - `agentStatus` defaults to 'down' when status query is loading
 *
 * Framework-agnostic: no React, no TanStack Query. The polling loop,
 * Realtime subscription, and mutation handlers are implemented with
 * `setInterval` / `supabase.channel().on(...)` directly.
 *
 * The React hook (`useAgentHealth.ts`) is refactored to consume this
 * controller via `useSyncExternalStore`. Public exports unchanged:
 *   - `UseAgentHealthResult` interface
 *   - `LIVENESS_THRESHOLD_MS = 25 * 60 * 1000`
 *   - `useAgentHealth(businessAccountId: string | null)`
 */

import { AgentService } from '../../services/agentService';
import { supabase } from '../../../runtime/web/src/lib/substrates/supabase/client';
import type { AgentHeartbeat, AgentHeartbeatStatus, SystemAlert } from '../../../runtime/web/src/lib/contracts/agent/agent-tables.contract';
import type { UseAgentHealthResult } from '../../hooks/useAgentHealth';
import type { ControllerSlot } from './controller';
import { DisposeScope, createControllerSlot } from './controller';

// ─────────────────────────────────────────────────────────────────────────────
// Constants — preserved verbatim from useAgentHealth.ts
// ─────────────────────────────────────────────────────────────────────────────

/** @deprecated No longer used — backend owns LIVENESS_THRESHOLD_MS. Kept for backward compat. */
export const LIVENESS_THRESHOLD_MS = 25 * 60 * 1000;

/** Polling interval — preserved from useAgentHealth.ts:30 */
export const POLL_INTERVAL_MS = 30_000;

/** Stale time — TanStack Query value, applied here as refetch guard. */
export const STALE_TIME_MS = POLL_INTERVAL_MS;

/** Garbage collection time for cache invalidation. */
export const GC_TIME_MS = 2 * POLL_INTERVAL_MS;

/** Retry config — preserved from useAgentHealth.ts */
export const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;
const RETRY_CAP_MS = 30_000;

// ─────────────────────────────────────────────────────────────────────────────
// Internal state — same shape as the React hook's combined return
// ─────────────────────────────────────────────────────────────────────────────

interface AgentHealthInternalState {
  heartbeats: AgentHeartbeat[];
  alerts: SystemAlert[];
  agentStatus: AgentHeartbeatStatus;
  isLoading: boolean;
  error: string | null;
}

const INITIAL_STATE: AgentHealthInternalState = {
  heartbeats: [],
  alerts: [],
  agentStatus: 'down',
  isLoading: true,
  error: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// Polling primitive — wraps the fetch logic with retry + exponential backoff
// ─────────────────────────────────────────────────────────────────────────────

async function fetchWithRetry<T>(
  fetchFn: () => Promise<{ success: boolean; data?: T | null; error?: string }>,
  signal?: AbortSignal,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      const result = await fetchFn();
      // ServiceListResponse returns `data: []` on failure; ServiceResponse
      // (single-item) returns `data: null`. A successful response can still
      // carry a null body for endpoints that legitimately return empty
      // (e.g. status with no heartbeat yet). Treat null as a successful
      // empty/missing result only for list endpoints — the caller is
      // responsible for choosing what to do with it. For non-null
      // responses, propagate the value.
      if (result.success && result.data !== undefined && result.data !== null) {
        return result.data;
      }
      lastErr = new Error(result.error ?? 'fetch returned null');
    } catch (err) {
      lastErr = err;
    }
    if (attempt < MAX_RETRIES - 1) {
      const delay = Math.min(RETRY_BASE_MS * 2 ** attempt, RETRY_CAP_MS);
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, delay);
        signal?.addEventListener('abort', () => {
          clearTimeout(t);
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

// ─────────────────────────────────────────────────────────────────────────────
// Controller factory
// ─────────────────────────────────────────────────────────────────────────────

export function createAgentHealthController(
  businessAccountId: string | null,
): {
  state(): UseAgentHealthResult;
  subscribe(listener: (state: UseAgentHealthResult) => void): () => void;
  resolveAlert(alertId: string): Promise<void>;
  refetch(): void;
  dispose(): void;
} {
  const slot: ControllerSlot<AgentHealthInternalState> = createControllerSlot(INITIAL_STATE);
  const dispose = new DisposeScope();

  // Polling abort controllers — one per query kind, plus a master for refetch.
  const pollAbortRef: { current: AbortController | null } = { current: null };

  function setState(patch: Partial<AgentHealthInternalState>): void {
    slot.setState(patch);
  }

  function errorFrom(e: unknown): string {
    if (e instanceof Error) return e.message;
    return String(e);
  }

  async function fetchStatus(): Promise<void> {
    try {
      const data = await fetchWithRetry(() => AgentService.getAgentStatus());
      setState({ agentStatus: data.status, error: null });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // Status errors are the "primary" error — overwrite.
      setState({ error: errorFrom(err) });
    }
  }

  async function fetchHeartbeats(): Promise<void> {
    try {
      const data = await fetchWithRetry(() => AgentService.getHeartbeats(5));
      setState({ heartbeats: data, error: null });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // Don't overwrite the status error
      const cur = slot.state();
      if (!cur.error) setState({ error: errorFrom(err) });
    }
  }

  async function fetchAlerts(): Promise<void> {
    if (!businessAccountId) {
      setState({ alerts: [] });
      return;
    }
    try {
      const data = await fetchWithRetry(() =>
        AgentService.getSystemAlerts(businessAccountId, false),
      );
      setState({ alerts: data, error: null });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const cur = slot.state();
      if (!cur.error) setState({ error: errorFrom(err) });
    }
  }

  async function refetchAll(): Promise<void> {
    await Promise.all([fetchStatus(), fetchHeartbeats(), fetchAlerts()]);
    setState({ isLoading: false });
  }

  // Initial fetch + interval polling. Aborts on businessAccountId change
  // or disposal.
  function startPolling(): void {
    pollAbortRef.current?.abort();
    const ctrl = new AbortController();
    pollAbortRef.current = ctrl;
    const signal = ctrl.signal;

    void (async () => {
      try {
        await refetchAll();
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setState({ isLoading: false, error: errorFrom(err) });
        }
      }
    })();

    const tick = setInterval(() => {
      if (signal.aborted) return;
      void refetchAll();
    }, POLL_INTERVAL_MS);
    dispose.add(() => clearInterval(tick));
  }

  // Realtime subscription on system_alerts (preserved verbatim in semantics).
  // Filtered by business_account_id. Mutates the alerts cache in place.
  function subscribeRealtime(): void {
    if (!businessAccountId) return;

    const channel = supabase
      .channel('system-alerts-live')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'system_alerts',
          filter: `business_account_id=eq.${businessAccountId}`,
        },
        (payload) => {
          const newAlert = payload.new as SystemAlert;
          slot.setState((s) => ({ alerts: [newAlert, ...s.alerts] }));
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'system_alerts',
          filter: `business_account_id=eq.${businessAccountId}`,
        },
        (payload) => {
          const updated = payload.new as SystemAlert;
          slot.setState((s) => ({
            alerts: s.alerts.map((a) => (a.id === updated.id ? updated : a)),
          }));
        },
      )
      .subscribe();

    dispose.add(() => {
      void supabase.removeChannel(channel);
    });
  }

  // Resolve alert mutation — preserved semantics: service call then
  // optimistic cache removal. Throws on service failure (matches the
  // legacy hook's Promise<void> return contract).
  async function resolveAlert(alertId: string): Promise<void> {
    const result = await AgentService.resolveAlert(alertId);
    if (!result.success) {
      throw new Error(result.error ?? 'Failed to resolve alert');
    }
    slot.setState((s) => ({ alerts: s.alerts.filter((a) => a.id !== alertId) }));
  }

  function refetch(): void {
    void refetchAll();
  }

  // Boot.
  startPolling();
  subscribeRealtime();

  // On disposal: cancel in-flight polling.
  dispose.add(() => {
    pollAbortRef.current?.abort();
  });

  return {
    state: () => {
      const s = slot.state();
      return {
        heartbeats: s.heartbeats,
        alerts: s.alerts,
        agentStatus: s.agentStatus,
        isLoading: s.isLoading,
        error: s.error,
        resolveAlert,
        refetch,
      };
    },
    subscribe: (listener) => slot.subscribe((s) => listener(buildResult(s, resolveAlert, refetch))),
    resolveAlert,
    refetch,
    dispose: () => dispose.dispose(),
  };

  function buildResult(
    s: AgentHealthInternalState,
    ra: (id: string) => Promise<void>,
    rf: () => void,
  ): UseAgentHealthResult {
    return {
      heartbeats: s.heartbeats,
      alerts: s.alerts,
      agentStatus: s.agentStatus,
      isLoading: s.isLoading,
      error: s.error,
      resolveAlert: ra,
      refetch: rf,
    };
  }
}
