/**
 * useAnalyticsReports.ts — Phase 2 refactored.
 *
 * Public API is byte-identical to the legacy hook:
 *   - `UseAnalyticsReportsResult` interface
 *   - `useAnalyticsReports(businessAccountId: string | null, limit?: number)`
 *
 * The implementation now delegates to
 * `createAnalyticsReportsController` from `src/lib/bridge/analyticsReports.ts`.
 * The controller owns the polling loop, fetch-with-retry, and derived-value
 * computation. The hook exposes that controller state to React via
 * `useSyncExternalStore`.
 *
 * The legacy hook's contract (10-min polling, 20-min gcTime, 3 retries,
 * derived latestDaily/latestWeekly, reportType filter) is preserved inside
 * the controller. Consumers see no change.
 */

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { createAnalyticsReportsController } from '../lib/bridge/analyticsReports';
import type { AnalyticsReport, ReportType } from '../../runtime/src-tauri/lib/contracts/agent/agent-tables.contract';

// ─────────────────────────────────────────────────────────────────────────────
// Result interface — unchanged from the legacy hook
// ─────────────────────────────────────────────────────────────────────────────

export interface UseAnalyticsReportsResult {
  reports:       AnalyticsReport[]
  latestDaily:   AnalyticsReport | null
  latestWeekly:  AnalyticsReport | null
  isLoading:     boolean
  error:         string | null
  reportType:    ReportType | 'all'
  setReportType: (t: ReportType | 'all') => void
  refetch:       () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook — body delegates to the controller
// ─────────────────────────────────────────────────────────────────────────────

export function useAnalyticsReports(
  businessAccountId: string | null,
  limit = 30,
): UseAnalyticsReportsResult {
  // Memoize the controller per businessAccountId. Re-creating the
  // controller when businessAccountId changes ensures polling targets
  // the new account.
  const controller = useMemo(
    () => createAnalyticsReportsController(businessAccountId, limit),
    [businessAccountId, limit],
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
  // hook's useQuery + useState chain.
  return useSyncExternalStore(
    controller.subscribe,
    controller.state,
    controller.state,
  );
}
