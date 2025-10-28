// =====================================
// USE CONTENT ANALYTICS HOOK
// Fetches and manages Instagram media/content data
// Calculates engagement rates and performance tiers
// =====================================

import { useState, useEffect } from 'react';
import { usePermissionDemoStore } from '../stores/permissionDemoStore';
import PermissionDemoService from '../services/permissionDemoService';
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

export const useContentAnalytics = (): UseContentAnalyticsResult => {
  const { demoMode } = usePermissionDemoStore();
  const [media, setMedia] = useState<MediaData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMedia = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (demoMode) {
        // Use demo data generator
        await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate API delay
        const demoData = PermissionDemoService.generateDemoData({
          realistic: true,
          volume: 'medium',
          includeEdgeCases: true,
          timeRange: 'month'
        });
        setMedia(demoData.media);
      } else {
        // Fetch real data from Supabase
        // TODO: Implement real data fetching from instagram_media table
        // const { data, error } = await supabase
        //   .from('instagram_media')
        //   .select('*')
        //   .order('published_at', { ascending: false });

        // For now, fallback to demo data
        const demoData = PermissionDemoService.generateDemoData({
          realistic: true,
          volume: 'medium',
          includeEdgeCases: true,
          timeRange: 'month'
        });
        setMedia(demoData.media);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch content analytics');
    } finally {
      setIsLoading(false);
    }
  };

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
  }, [demoMode]);

  return {
    media,
    analytics,
    isLoading,
    error,
    refetch: fetchMedia
  };
};

export default useContentAnalytics;
