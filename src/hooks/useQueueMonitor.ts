/**
 * useQueueMonitor.ts — Phase 2 refactored.
 *
 * Public API is byte-identical to the legacy hook:
 *   - UseQueueMonitorResult interface
 *   - POLL_INTERVAL_MS = 15_000
 *
 * The implementation now delegates to
 * createQueueMonitorController from src/lib/bridge/queueMonitor.ts.
 * The controller owns the polling loop and retry mutation.
 * The hook just exposes that controller state to React via
 * useSyncExternalStore.
 *
 * The legacy hook's contract (15s polling, 200-row scan, optimistic
 * retry cache, derived summary/dlqItems) is preserved inside the
 * controller. Consumers see no change.
 */

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { createQueueMonitorController } from '../lib/bridge/queueMonitor';
import type { QueueStatusSummary, QueueDLQItem } from '../../runtime/src-tauri/lib/contracts/agent/agent-tables.contract';

// ─────────────────────────────────────────────────────────────────────────────
// Result interface — unchanged from the legacy hook
// ─────────────────────────────────────────────────────────────────────────────

export interface UseQueueMonitorResult {
  summary: QueueStatusSummary;
  dlqItems: QueueDLQItem[];
  totalQueued: number;
  totalDLQ: number;
  isLoading: boolean;
  error: string | null;
  retryItem: (queueId: string) => Promise<void>;
  isRetrying: boolean;
  refetch: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants — unchanged from the legacy hook
// ─────────────────────────────────────────────────────────────────────────────

/** Polling interval — 15s, one clock, one table scan */
export const POLL_INTERVAL_MS = 15_000;

// ─────────────────────────────────────────────────────────────────────────────
// Hook — body delegates to the controller
// ─────────────────────────────────────────────────────────────────────────────

export function useQueueMonitor(): UseQueueMonitorResult {
  const controller = useMemo(() => createQueueMonitorController(), []);

  // Dispose the controller on unmount
  useEffect(() => {
    return () => {
      controller.dispose();
    };
  }, [controller]);

  return useSyncExternalStore(
    controller.subscribe,
    controller.state,
    controller.state,
  );
}
