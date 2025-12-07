// =====================================
// USE CONTENT ANALYTICS HOOK - PRODUCTION
// Fetches REAL Instagram media/content data from Meta Graph API v23.0
// NO MOCK DATA, NO FALLBACKS
// Calculates engagement rates and performance tiers
// =====================================

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useInstagramAccount } from './useInstagramAccount';
import type { MediaData } from '../types/permissions';

interface ContentAnalytics {
  totalPosts: number;
  totalLikes: number;
  totalComments: number;
  totalReach: number;
  avgEngagementRate: number;
  topPerformer: MediaData | null;
}

interface UseContentAnalyticsResult {
  media: MediaData[];
  analytics: ContentAnalytics;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook to fetch and analyze Instagram media content
 * Uses Meta Graph API v23.0 with proper authentication
 */
export const useContentAnalytics = (): UseContentAnalyticsResult => {
  const { user } = useAuthStore();
  const { businessAccountId, instagramBusinessId } = useInstagramAccount();
  const [media, setMedia] = useState<MediaData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMedia = useCallback(async () => {
    // ❌ NO DEMO MODE CHECK - Always fetch real data

    if (!user?.id) {
      setError('User not authenticated. Please log in.');
      setIsLoading(false);
      return;
    }

    if (!businessAccountId || !instagramBusinessId) {
      setError('No Instagram Business Account connected. Please reconnect your account.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // ✅ REAL API CALL - Meta Graph API v23.0
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
      const response = await fetch(
        `${apiBaseUrl}/api/instagram/media/${instagramBusinessId}?userId=${user.id}&businessAccountId=${businessAccountId}&limit=50`,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        // ✅ FAIL LOUDLY - Show the actual error
        throw new Error(errorData.error || `API Error: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch media');
      }

      setMedia(result.data || []);

      console.log('✅ Media fetched successfully:', result.data?.length || 0, 'items');

    } catch (err: any) {
      console.error('❌ Media fetch failed:', err);
      // ✅ FAIL LOUDLY - Display error, don't fallback to mock data
      setError(err.message || 'Failed to fetch media. Check console for details.');
      setMedia([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, businessAccountId, instagramBusinessId]);

  // Calculate analytics from media data
  const calculateAnalytics = (mediaData: MediaData[]): ContentAnalytics => {
    const totalPosts = mediaData.length;
    const totalLikes = mediaData.reduce((sum, m) => sum + (m.like_count || 0), 0);
    const totalComments = mediaData.reduce((sum, m) => sum + (m.comments_count || 0), 0);
    const totalReach = mediaData.reduce((sum, m) => sum + (m.reach || 0), 0);
    const avgEngagementRate =
      totalPosts > 0 ? mediaData.reduce((sum, m) => sum + m.engagement_rate, 0) / totalPosts : 0;

    // Find top performer
    const topPerformer =
      mediaData.length > 0
        ? mediaData.reduce((top, current) =>
            current.engagement_rate > top.engagement_rate ? current : top
          )
        : null;

    return {
      totalPosts,
      totalLikes,
      totalComments,
      totalReach,
      avgEngagementRate,
      topPerformer
    };
  };

  const analytics = calculateAnalytics(media);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  return {
    media,
    analytics,
    isLoading,
    error,
    refetch: fetchMedia
  };
};

export default useContentAnalytics;
