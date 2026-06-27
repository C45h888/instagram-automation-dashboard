/**
 * useAgentHealth.ts — Phase 2 refactored.
 *
 * Public API is byte-identical to the legacy hook:
 *   - `UseAgentHealthResult` interface
 *   - `LIVENESS_THRESHOLD_MS = 25 * 60 * 1000`
 *   - `useAgentHealth(businessAccountId: string | null)`
 *
 * The implementation now delegates to
 * `createAgentHealthController` from `src/lib/bridge/agentHealth.ts`.
 * The controller owns the polling loop, Realtime subscription, and
 * resolveAlert mutation. The hook just exposes that controller state
 * to React via `useSyncExternalStore`.
 *
 * The legacy hook's contract (30s polling, 3 retries, Realtime INSERT
 * + UPDATE on `system_alerts`, optimistic cache updates, combined
 * error from status → alerts) is preserved inside the controller.
 * Consumers (`AgentTerminalDashboard`) see no change.
 */

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { createAgentHealthController } from '../lib/bridge/agentHealth';
import type { AgentHeartbeat, AgentHeartbeatStatus, SystemAlert } from '../../runtime/web/src/lib/contracts/agent/agent-tables.contract';

// ─────────────────────────────────────────────────────────────────────────────
// Result interface — unchanged from the legacy hook
// ─────────────────────────────────────────────────────────────────────────────

export interface UseAgentHealthResult {
  heartbeats: AgentHeartbeat[];
  alerts: SystemAlert[];
  /** 'alive' if newest heartbeat is ≤ 25min ago, otherwise 'down' — computed by backend */
  agentStatus: AgentHeartbeatStatus;
  isLoading: boolean;
  error: string | null;
  resolveAlert: (alertId: string) => Promise<void>;
  refetch: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants — unchanged from the legacy hook
// ─────────────────────────────────────────────────────────────────────────────

/** @deprecated No longer used — backend owns LIVENESS_THRESHOLD_MS. kept for backward compat */
export const LIVENESS_THRESHOLD_MS = 25 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// Hook — body delegates to the controller
// ─────────────────────────────────────────────────────────────────────────────

export function useAgentHealth(businessAccountId: string | null): UseAgentHealthResult {
  // Memoize the controller per businessAccountId. Re-creating the
  // controller when businessAccountId changes ensures polling and
  // Realtime filters target the new account.
  const controller = useMemo(
    () => createAgentHealthController(businessAccountId),
    [businessAccountId],
  );

  // Dispose the controller on unmount or when businessAccountId changes
  // (which produces a new controller via useMemo above).
  useEffect(() => {
    return () => {
      controller.dispose();
    };
  }, [controller]);

  // Subscribe to controller state via React's external-store hook.
  // This gives us the same render-on-change semantics as the legacy
  // hook's combined useQuery + useState + useEffect chain.
  return useSyncExternalStore(
    controller.subscribe,
    controller.state,
    controller.state,
  );
}
