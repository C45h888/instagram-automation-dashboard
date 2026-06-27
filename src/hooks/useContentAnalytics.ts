/**
 * useContentAnalytics.ts — Phase 2 refactored.
 *
 * Public API is byte-identical to the legacy hook:
 *   - `UseContentAnalyticsResult` interface
 *   - `ContentAnalytics` interface
 *   - `useContentAnalytics()` (no parameters — reads from authStore + useInstagramAccount)
 *
 * The implementation now delegates to
 * `createContentAnalyticsController` from `src/lib/bridge/contentAnalytics.ts`.
 * The controller owns the fetch, auth guard, business-account guard, and
 * analytics computation. The hook exposes that controller state to React
 * via `useSyncExternalStore`.
 *
 * The legacy hook's contract (fail loudly, no mock data, no polling,
 * engagement rate + top performer derivation) is preserved inside the
 * controller. Consumers see no change.
 */

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { createContentAnalyticsController } from '../lib/bridge/contentAnalytics';
import { useAuthStore } from '../stores/authStore';
import { useInstagramAccount } from './useInstagramAccount';
import type { MediaData } from '../../runtime/web/src/lib/contracts/identity/permissions.contract';

// ─────────────────────────────────────────────────────────────────────────────
// Interfaces — unchanged from the legacy hook
// ─────────────────────────────────────────────────────────────────────────────

export interface ContentAnalytics {
  totalPosts: number;
  totalLikes: number;
  totalComments: number;
  totalReach: number;
  avgEngagementRate: number;
  topPerformer: MediaData | null;
}

export interface UseContentAnalyticsResult {
  media: MediaData[];
  analytics: ContentAnalytics;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook — body delegates to the controller
// ─────────────────────────────────────────────────────────────────────────────

export const useContentAnalytics = (): UseContentAnalyticsResult => {
  const { user } = useAuthStore();
  const { businessAccountId, instagramBusinessId } = useInstagramAccount();

  // Memoize the controller. Dependencies (userId, businessAccountId,
  // instagramBusinessId) are pulled from stores at render time; the
  // controller re-creates when any of them change.
  const controller = useMemo(
    () =>
      createContentAnalyticsController(
        user?.id ?? null,
        businessAccountId,
        instagramBusinessId,
      ),
    [user?.id, businessAccountId, instagramBusinessId],
  );

  // Dispose the controller on unmount or when dependencies change
  // (which produces a new controller via useMemo above).
  useEffect(() => {
    return () => {
      controller.dispose();
    };
  }, [controller]);

  // Subscribe to controller state via React's external-store hook.
  // This gives us the same render-on-change semantics as the legacy
  // hook's useState + useEffect + useCallback chain.
  return useSyncExternalStore(
    controller.subscribe,
    controller.state,
    controller.state,
  );
};

export default useContentAnalytics;
