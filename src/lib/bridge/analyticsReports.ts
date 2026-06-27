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
 *       - 'all' → AgentService.getAnalyticsReports(id, undefined, limit)
 *       - 'daily' | 'weekly' → AgentService.getAnalyticsReports(id, reportType, limit)
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

import { AgentService } from '../../services/agentService';
import type { AnalyticsReport, ReportType } from '../../../runtime/src-tauri/lib/contracts/agent/agent-tables.contract';
import type { UseAnalyticsReportsResult } from '../../hooks/useAnalyticsReports';
import type { ControllerSlot } from './controller';
import { createControllerSlot, DisposeScope } from './controller';

// ─────────────────────────────────────────────────────────────────────────────
// Constants — preserved verbatim from useAnalyticsReports.ts
// ─────────────────────────────────────────────────────────────────────────────

/** Polling interval — 10 minutes (reports are agent-written via UPSERT) */
export const POLL_INTERVAL_MS = 10 * 60 * 1000;

/** Retry config */
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;
const RETRY_CAP_MS = 30_000;

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
// Fetch primitive — wraps service call with retry + exponential backoff
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
      const data = await fetchWithRetry<AnalyticsReport[]>(
        () =>
          AgentService.getAnalyticsReports(
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
    void fetchReports();
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
      // Reports are already ordered by report_date DESC from AgentService
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
