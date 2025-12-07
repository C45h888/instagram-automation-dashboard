// =====================================
// USE VISITOR POSTS HOOK - PRODUCTION
// Fetches REAL UGC/tagged posts from Meta Graph API v23.0
// NO MOCK DATA, NO FALLBACKS
// Manages UGC data fetching, filtering, and mutations
// =====================================

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useInstagramAccount } from './useInstagramAccount';
import type { VisitorPost, UGCStats, UGCFilterState, PermissionRequestForm } from '../types/ugc';
import { DEFAULT_UGC_FILTERS } from '../types/ugc';

interface UseVisitorPostsResult {
  visitorPosts: VisitorPost[];
  stats: UGCStats | null;
  isLoading: boolean;
  error: string | null;
  filters: UGCFilterState;
  setFilters: (filters: UGCFilterState) => void;
  toggleFeatured: (postId: string, featured: boolean) => Promise<void>;
  requestPermission: (form: PermissionRequestForm) => Promise<void>;
  refetch: () => void;
}

/**
 * Hook to fetch and manage visitor posts (UGC)
 * Uses Meta Graph API v23.0 with proper authentication
 */
export const useVisitorPosts = (): UseVisitorPostsResult => {
  const { user } = useAuthStore();
  const { businessAccountId } = useInstagramAccount();
  const [visitorPosts, setVisitorPosts] = useState<VisitorPost[]>([]);
  const [stats, setStats] = useState<UGCStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<UGCFilterState>(DEFAULT_UGC_FILTERS);

  const fetchVisitorPosts = useCallback(async () => {
    if (!user?.id) {
      setError('User not authenticated.');
      setIsLoading(false);
      return;
    }

    if (!businessAccountId) {
      setError('No Instagram Business Account connected.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // ✅ REAL API CALL - Meta Graph API v23.0
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
      const response = await fetch(
        `${apiBaseUrl}/api/instagram/visitor-posts?businessAccountId=${businessAccountId}&limit=50`,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API Error: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch visitor posts');
      }

      // ✅ Set REAL data
      setVisitorPosts(result.data || []);
      setStats(result.stats || null);

      console.log('✅ Visitor posts fetched:', result.data?.length || 0, 'posts');

    } catch (err: any) {
      console.error('❌ Visitor posts fetch failed:', err);
      // ✅ FAIL LOUDLY
      setError(err.message || 'Failed to fetch visitor posts');
      setVisitorPosts([]);
      setStats(null);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, businessAccountId]);

  const toggleFeatured = async (postId: string, featured: boolean): Promise<void> => {
    try {
      // ✅ REAL API CALL to update featured status
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
      const response = await fetch(`${apiBaseUrl}/api/instagram/ugc/${postId}/feature`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ featured })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update featured status');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to update featured status');
      }

      // Update local state
      setVisitorPosts(prev =>
        prev.map(post =>
          post.id === postId
            ? {
                ...post,
                featured,
                featured_at: featured ? new Date().toISOString() : null,
                updated_at: new Date().toISOString()
              }
            : post
        )
      );

      // Update stats if needed
      if (stats) {
        setStats({
          ...stats,
          featuredCount: featured
            ? stats.featuredCount + 1
            : Math.max(0, stats.featuredCount - 1)
        });
      }

      console.log('✅ Featured status updated:', postId, featured);
    } catch (err: any) {
      throw new Error(err.message || 'Failed to update featured status');
    }
  };

  const requestPermission = async (form: PermissionRequestForm): Promise<void> => {
    // Validate form
    if (!form.requestMessage.trim()) {
      throw new Error('Request message cannot be empty');
    }

    try {
      // ✅ REAL API CALL to request permission
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
      const response = await fetch(`${apiBaseUrl}/api/instagram/ugc/request-permission`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(form)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to request permission');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to request permission');
      }

      // Update post in local state
      setVisitorPosts(prev =>
        prev.map(post =>
          post.id === form.ugcContentId
            ? {
                ...post,
                repost_permission_requested: true,
                updated_at: new Date().toISOString()
              }
            : post
        )
      );

      // Update stats if needed
      if (stats) {
        setStats({
          ...stats,
          permissionsPending: stats.permissionsPending + 1
        });
      }

      console.log('✅ Permission requested for:', form.ugcContentId);
    } catch (err: any) {
      throw new Error(err.message || 'Failed to request permission');
    }
  };

  useEffect(() => {
    fetchVisitorPosts();
  }, [fetchVisitorPosts]);

  return {
    visitorPosts,
    stats,
    isLoading,
    error,
    filters,
    setFilters,
    toggleFeatured,
    requestPermission,
    refetch: fetchVisitorPosts
  };
};

export default useVisitorPosts;
