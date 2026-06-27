/**
 * Controller for useContentAnalytics — Phase 2 bridge layer.
 *
 * Contract preserved (byte-identical to the React hook):
 *   - No polling interval — single fetch on mount + explicit refetch()
 *   - Auth guard: user.id must be truthy
 *   - Business account guard: businessAccountId + instagramBusinessId required
 *   - Engagement rate calculation: sum of per-media engagement_rate / count
 *   - Top performer: media item with highest engagement_rate
 *   - Derived analytics: totalPosts, totalLikes, totalComments, totalReach,
 *     avgEngagementRate, topPerformer
 *   - refetch() re-fires the single fetch
 *   - Fail loudly: errors are set, no mock data fallback
 *
 * Framework-agnostic: no React, no TanStack Query.
 * Raw fetch() + useEffect-equivalent via startFetch() / dispose.
 *
 * The React hook (useContentAnalytics.ts) is refactored to consume this
 * controller via useSyncExternalStore. Public exports unchanged:
 *   - UseContentAnalyticsResult interface
 *   - ContentAnalytics interface
 *   - useContentAnalytics()
 */

import type { MediaData } from '../../types/permissions';
import type { UseContentAnalyticsResult } from '../../hooks/useContentAnalytics';
import type { ControllerSlot } from './controller';
import { DisposeScope, createControllerSlot } from './controller';

// ─────────────────────────────────────────────────────────────────────────────
// Internal state
// ─────────────────────────────────────────────────────────────────────────────

interface ContentAnalyticsInternalState {
  media: MediaData[];
  isLoading: boolean;
  error: string | null;
}

const INITIAL_STATE: ContentAnalyticsInternalState = {
  media: [],
  isLoading: true,
  error: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// Analytics computation — preserved verbatim from useContentAnalytics.ts
// ─────────────────────────────────────────────────────────────────────────────

function calculateAnalytics(mediaData: MediaData[]): UseContentAnalyticsResult['analytics'] {
  const totalPosts = mediaData.length;
  const totalLikes = mediaData.reduce((sum, m) => sum + (m.like_count || 0), 0);
  const totalComments = mediaData.reduce((sum, m) => sum + (m.comments_count || 0), 0);
  const totalReach = mediaData.reduce((sum, m) => sum + (m.reach || 0), 0);
  const avgEngagementRate =
    totalPosts > 0
      ? mediaData.reduce((sum, m) => sum + m.engagement_rate, 0) / totalPosts
      : 0;

  // Find top performer — reduce over media comparing engagement_rate
  const topPerformer =
    mediaData.length > 0
      ? mediaData.reduce((top, current) =>
          current.engagement_rate > top.engagement_rate ? current : top,
        )
      : null;

  return {
    totalPosts,
    totalLikes,
    totalComments,
    totalReach,
    avgEngagementRate,
    topPerformer,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Controller factory
// ─────────────────────────────────────────────────────────────────────────────

export function createContentAnalyticsController(
  userId: string | null,
  businessAccountId: string | null,
  instagramBusinessId: string | null,
): {
  state(): UseContentAnalyticsResult;
  subscribe(listener: (state: UseContentAnalyticsResult) => void): () => void;
  refetch(): void;
  dispose(): void;
} {
  const slot: ControllerSlot<ContentAnalyticsInternalState> = createControllerSlot(INITIAL_STATE);
  const dispose = new DisposeScope();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apiBaseUrl = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL)
    || 'https://api.888intelligenceautomation.in';

  function errorFrom(e: unknown): string {
    if (e instanceof Error) return e.message;
    return String(e);
  }

  async function fetchMedia(): Promise<void> {
    // Auth guard — same as legacy hook
    if (!userId) {
      slot.setState({ media: [], isLoading: false, error: 'User not authenticated. Please log in.' });
      return;
    }

    // Business account guard — same as legacy hook
    if (!businessAccountId || !instagramBusinessId) {
      slot.setState({
        media: [],
        isLoading: false,
        error: 'No Instagram Business Account connected. Please reconnect your account.',
      });
      return;
    }

    slot.setState({ isLoading: true, error: null });

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/instagram/media/${instagramBusinessId}?userId=${userId}&business_account_id=${businessAccountId}&limit=50`,
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API Error: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch media');
      }

      slot.setState({ media: result.data || [], isLoading: false, error: null });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      slot.setState({ media: [], isLoading: false, error: errorFrom(err) });
    }
  }

  function refetch(): void {
    void fetchMedia();
  }

  // Boot — fetch immediately on construction (equivalent to useEffect mount)
  void fetchMedia();

  return {
    state: () => {
      const s = slot.state();
      const analytics = calculateAnalytics(s.media);
      return {
        media: s.media,
        analytics,
        isLoading: s.isLoading,
        error: s.error,
        refetch,
      };
    },
    subscribe: (listener) => slot.subscribe((s) => listener(buildResult(s, refetch))),
    refetch,
    dispose: () => dispose.dispose(),
  };

  function buildResult(
    s: ContentAnalyticsInternalState,
    rf: () => void,
  ): UseContentAnalyticsResult {
    const analytics = calculateAnalytics(s.media);
    return {
      media: s.media,
      analytics,
      isLoading: s.isLoading,
      error: s.error,
      refetch: rf,
    };
  }
}
