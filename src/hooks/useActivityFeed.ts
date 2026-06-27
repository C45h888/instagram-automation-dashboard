/**
 * useActivityFeed.ts — Phase 2 refactored.
 *
 * Public API is byte-identical to the legacy hook:
 *   - UseActivityFeedResult interface
 *
 * The implementation now delegates to
 * createActivityFeedController from src/lib/bridge/activityFeed.ts.
 * The controller owns the initial fetch, Realtime subscription, and refetch.
 * The hook just exposes that controller state to React via useSyncExternalStore.
 *
 * The legacy hook's contract (Realtime on audit_log INSERT, client-side
 * JSONB filter on business_account_id, 50-event cap) is preserved inside
 * the controller. Consumers see no change.
 */

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { createActivityFeedController } from '../lib/bridge/activityFeed';
import type { AuditLogEntry } from '../../runtime/src-tauri/lib/contracts/agent/agent-tables.contract';

// ─────────────────────────────────────────────────────────────────────────────
// Result interface — unchanged from the legacy hook
// ─────────────────────────────────────────────────────────────────────────────

export interface UseActivityFeedResult {
  events: AuditLogEntry[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook — body delegates to the controller
// ─────────────────────────────────────────────────────────────────────────────

export function useActivityFeed(
  businessAccountId: string | null,
): UseActivityFeedResult {
  // Recreate controller when businessAccountId changes — this disposes the
  // old controller (cancelling its Realtime subscription) and boots a new one
  // targeting the correct account filter.
  const controller = useMemo(
    () => createActivityFeedController(businessAccountId),
    [businessAccountId],
  );

  // Dispose the controller on unmount or when businessAccountId changes
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
