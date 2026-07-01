/**
 * Controller for useAnalyticsReports — Phase 2 bridge layer.
 *
 * Contract preserved (byte-identical to the React hook):
 *   - 10-minute staleTime / refetchInterval (reports are agent-written
 *     via UPSERT, so they don't change often)
 *   - 20-minute gcTime
 *   - retry: 3 attempts, exponential backoff capped at 30s
 *   - refetchOnWindowFocus: false
 *   - Enabled only when businessAccountId is truthy
 *   - reportType is local UI state ('all' | 'daily' | 'weekly'):
 *       - 'all' → getAnalyticsReports(id, undefined, limit)
 *       - 'daily' | 'weekly' → getAnalyticsReports(id, reportType, limit)
 *   - Derived values: latestDaily, latestWeekly are first matches by report_type
 *     in the fetched list (already ordered by report_date DESC)
 *   - refetch() calls fetchReports again
 *
 * Framework-agnostic: no React, no TanStack Query.
 * Manual setInterval polling + fetchWithRetry for retries.
 *
 * The React hook (useAnalyticsReports.ts) is refactored to consume this
 * controller via useSyncExternalStore. Public exports unchanged:
 *   - UseAnalyticsReportsResult interface
 */

import { getAnalyticsReports } from '../../domains/agent/analytics-reports.service';
import type { AnalyticsReport, ReportType } from '../../contracts/agent/agent-tables.contract';
import { recordAnalyticsReportsCall } from './reports.emissions';

export interface UseAnalyticsReportsResult {
  reports: AnalyticsReport[];
  latestDaily: AnalyticsReport | null;
  latestWeekly: AnalyticsReport | null;
  isLoading: boolean;
  error: string | null;
  reportType: ReportType | 'all';
  setReportType: (t: ReportType | 'all') => void;
  refetch: () => void;
}


import type { ControllerSlot } from '../primitives/controller';
import { createControllerSlot, DisposeScope } from '../primitives/controller';
import { retryWithBackoff } from '../../substrates/http/retry';

// ─────────────────────────────────────────────────────────────────────────────
// Constants — preserved verbatim from useAnalyticsReports.ts
// ─────────────────────────────────────────────────────────────────────────────

/** Polling interval — 10 minutes (reports are agent-written via UPSERT) */
export const POLL_INTERVAL_MS = 10 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// Internal state
// ─────────────────────────────────────────────────────────────────────────────

interface AnalyticsInternalState {
  reports: AnalyticsReport[];
  isLoading: boolean;
  error: string | null;
  reportType: ReportType | 'all';
}

const INITIAL_STATE: AnalyticsInternalState = {
  reports: [],
  isLoading: true,
  error: null,
  reportType: 'all',
};

// ─────────────────────────────────────────────────────────────────────────────
// Controller factory
// ─────────────────────────────────────────────────────────────────────────────

export function createAnalyticsReportsController(
  businessAccountId: string | null,
  limit: number = 30,
): {
  state(): UseAnalyticsReportsResult;
  subscribe(listener: (state: UseAnalyticsReportsResult) => void): () => void;
  setReportType(t: ReportType | 'all'): void;
  refetch(): void;
  dispose(): void;
} {
  const slot: ControllerSlot<AnalyticsInternalState> = createControllerSlot(INITIAL_STATE);
  const dispose = new DisposeScope();

  const pollAbortRef: { current: AbortController | null } = { current: null };

  function errorFrom(e: unknown): string {
    if (e instanceof Error) return e.message;
    return String(e);
  }

  async function fetchReports(): Promise<void> {
    if (!businessAccountId) {
      slot.setState({ reports: [], isLoading: false, error: null });
      return;
    }

    try {
      const currentType = slot.state().reportType;
      const data = await retryWithBackoff<AnalyticsReport[]>(
        () =>
          getAnalyticsReports(
            businessAccountId,
            currentType === 'all' ? undefined : currentType,
            limit,
          ),
        pollAbortRef.current?.signal,
      );
      slot.setState({ reports: data, isLoading: false, error: null });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      slot.setState({ isLoading: false, error: errorFrom(err) });
    }
  }

  function startPolling(): void {
    pollAbortRef.current?.abort();
    const ctrl = new AbortController();
    pollAbortRef.current = ctrl;
    const signal = ctrl.signal;

    void (async () => {
      try {
        await fetchReports();
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          slot.setState({ isLoading: false, error: errorFrom(err) });
        }
      }
    })();

    const tick = setInterval(() => {
      if (signal.aborted) return;
      void fetchReports();
    }, POLL_INTERVAL_MS);
    dispose.add(() => clearInterval(tick));
  }

  function setReportType(t: ReportType | 'all'): void {
    const current = slot.state().reportType;
    if (current === t) return;
    slot.setState({ reportType: t, isLoading: true });
    void fetchReports();
  }

  function refetch(): void {
    const t0 = Date.now();
    try {
      void fetchReports();
      recordAnalyticsReportsCall({ op: 'refetch', success: true, latency_ms: Date.now() - t0 });
    } catch (e) {
      recordAnalyticsReportsCall({ op: 'refetch', success: false, latency_ms: Date.now() - t0, error_kind: String(e) });
      throw e;
    }
  }

  // Boot
  startPolling();

  // On disposal: cancel in-flight polling
  dispose.add(() => {
    pollAbortRef.current?.abort();
  });

  return {
    state: () => {
      const s = slot.state();
      // Derived values — same logic as the legacy hook's useMemo
      // Reports are already ordered by report_date DESC from the domain query
      const latestDaily = s.reports.find((r) => r.report_type === 'daily') ?? null;
      const latestWeekly = s.reports.find((r) => r.report_type === 'weekly') ?? null;
      return {
        reports: s.reports,
        latestDaily,
        latestWeekly,
        isLoading: s.isLoading,
        error: s.error,
        reportType: s.reportType,
        setReportType,
        refetch,
      };
    },
    subscribe: (listener) =>
      slot.subscribe((s) => listener(buildResult(s.reports, s.isLoading, s.error, s.reportType))),
    setReportType,
    refetch,
    dispose: () => dispose.dispose(),
  };

  function buildResult(
    reports: AnalyticsReport[],
    isLoading: boolean,
    error: string | null,
    reportType: ReportType | 'all',
  ): UseAnalyticsReportsResult {
    const latestDaily = reports.find((r) => r.report_type === 'daily') ?? null;
    const latestWeekly = reports.find((r) => r.report_type === 'weekly') ?? null;
    return {
      reports,
      latestDaily,
      latestWeekly,
      isLoading,
      error,
      reportType,
      setReportType,
      refetch,
    };
  }
}
