/**
 * Controller for useQueueMonitor — Phase 2 bridge layer.
 *
 * Contract preserved (byte-identical to the React hook):
 *   - 15s polling interval (one clock, one table scan — replaced the
 *     previous dual-poller pattern that was double-firing every 30s)
 *   - staleTime = POLL_INTERVAL_MS
 *   - Single 200-row fetch of post_queue derives both histogram (byKey)
 *     and DLQ items from the same result
 *   - retryQueueItem mutation: optimistic cache removal of the retried
 *     item from dlqItems, then single invalidation
 *   - Combined retry logic: 3 attempts, exponential backoff capped at 30s
 *
 * Framework-agnostic: no React, no TanStack Query. The polling loop and
 * mutation handlers are implemented with setInterval / direct fetch directly.
 *
 * The React hook (useQueueMonitor.ts) is refactored to consume this
 * controller via useSyncExternalStore. Public exports unchanged:
 *   - UseQueueMonitorResult interface
 *   - POLL_INTERVAL_MS = 15_000
 */

import { AgentService } from '../../services/agentService';
import type { QueueStatusSummary, QueueDLQItem, QueueOverview } from '../../types';
import type { UseQueueMonitorResult } from '../../hooks/useQueueMonitor';
import type { ControllerSlot } from './controller';
import { DisposeScope, createControllerSlot } from './controller';

// ─────────────────────────────────────────────────────────────────────────────
// Constants — preserved verbatim from useQueueMonitor.ts
// ─────────────────────────────────────────────────────────────────────────────

/** Polling interval — 15s, one clock, one table scan */
export const POLL_INTERVAL_MS = 15_000;

/** Retry config */
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;
const RETRY_CAP_MS = 30_000;

// ─────────────────────────────────────────────────────────────────────────────
// Internal state — same shape as the React hook's combined return
// ─────────────────────────────────────────────────────────────────────────────

interface QueueMonitorInternalState {
  summary: QueueStatusSummary;
  dlqItems: QueueDLQItem[];
  totalQueued: number;
  totalDLQ: number;
  isLoading: boolean;
  error: string | null;
  isRetrying: boolean;
}

const EMPTY_SUMMARY: QueueStatusSummary = {
  byKey: {},
  total: 0,
  timestamp: new Date().toISOString(),
};

const INITIAL_STATE: QueueMonitorInternalState = {
  summary: EMPTY_SUMMARY,
  dlqItems: [],
  totalQueued: 0,
  totalDLQ: 0,
  isLoading: true,
  error: null,
  isRetrying: false,
};

// ─────────────────────────────────────────────────────────────────────────────
// Fetch primitive — wraps the service call with retry + exponential backoff
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

export function createQueueMonitorController(): {
  state(): UseQueueMonitorResult;
  subscribe(listener: (state: UseQueueMonitorResult) => void): () => void;
  retryItem(queueId: string): Promise<void>;
  refetch(): void;
  dispose(): void;
} {
  const slot: ControllerSlot<QueueMonitorInternalState> = createControllerSlot(INITIAL_STATE);
  const dispose = new DisposeScope();

  const pollAbortRef: { current: AbortController | null } = { current: null };

  function errorFrom(e: unknown): string {
    if (e instanceof Error) return e.message;
    return String(e);
  }

  async function fetchOverview(): Promise<void> {
    try {
      const data = await fetchWithRetry<QueueOverview>(
        () => AgentService.getQueueOverview(),
        pollAbortRef.current?.signal,
      );
      const dlqItems = data.dlqItems ?? [];
      slot.setState({
        summary: {
          byKey: data.byKey ?? {},
          total: data.total ?? 0,
          timestamp: data.timestamp ?? new Date().toISOString(),
        },
        dlqItems,
        totalQueued: data.total ?? 0,
        totalDLQ: dlqItems.length,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      slot.setState({ isLoading: false, error: errorFrom(err) });
    }
  }

  function startPolling(): void {
    pollAbortRef.current?.abort();
    const ctrl = new AbortController();
    pollAbortRef.current = ctrl;

    void (async () => {
      try {
        await fetchOverview();
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          slot.setState({ isLoading: false, error: errorFrom(err) });
        }
      }
    })();

    const tick = setInterval(() => {
      if (ctrl.signal.aborted) return;
      void fetchOverview();
    }, POLL_INTERVAL_MS);
    dispose.add(() => clearInterval(tick));
  }

  // Retry mutation — preserved semantics: optimistic cache remove + re-fetch
  async function retryItem(queueId: string): Promise<void> {
    // Optimistic update: remove the retried item from dlqItems immediately
    // On failure, throw and let the next poll restore the correct state
    slot.setState((s) => ({
      dlqItems: s.dlqItems.filter((item) => item.id !== queueId),
      totalDLQ: s.totalDLQ - (s.dlqItems.some((item) => item.id === queueId) ? 1 : 0),
      isRetrying: true,
    }));

    try {
      const result = await AgentService.retryQueueItem(queueId);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to retry item');
      }
      // Re-fetch to sync with authoritative backend state
      await fetchOverview();
    } finally {
      slot.setState({ isRetrying: false });
    }
  }

  function refetch(): void {
    void fetchOverview();
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
      return {
        summary: s.summary,
        dlqItems: s.dlqItems,
        totalQueued: s.totalQueued,
        totalDLQ: s.totalDLQ,
        isLoading: s.isLoading,
        error: s.error,
        retryItem,
        isRetrying: s.isRetrying,
        refetch,
      };
    },
    subscribe: (listener) => slot.subscribe((s) => listener(buildResult(s))),
    retryItem,
    refetch,
    dispose: () => dispose.dispose(),
  };

  function buildResult(s: QueueMonitorInternalState): UseQueueMonitorResult {
    return {
      summary: s.summary,
      dlqItems: s.dlqItems,
      totalQueued: s.totalQueued,
      totalDLQ: s.totalDLQ,
      isLoading: s.isLoading,
      error: s.error,
      retryItem,
      isRetrying: s.isRetrying,
      refetch,
    };
  }
}
