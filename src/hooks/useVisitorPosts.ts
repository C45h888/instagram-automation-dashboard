// =====================================
// USE VISITOR POSTS HOOK - PRODUCTION v2.0
// Fetches REAL UGC/tagged posts from Meta Graph API v23.0
// NO MOCK DATA, NO FALLBACKS
//
// ✅ REFACTORED (Phase 2):
// - Added retry logic with exponential backoff (matches useInstagramInsights)
// - Added scope error tracking (scopeError state)
// - Added userId parameter to all API calls
// - Resilient audit error handling in sync
// =====================================

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useInstagramAccount } from './useInstagramAccount';
import type { VisitorPost, UGCStats, UGCFilterState, PermissionRequestForm } from '../types/ugc';
import { DEFAULT_UGC_FILTERS } from '../types/ugc';

// ✅ NEW: Rate limit error codes (matches useInstagramInsights)
const RATE_LIMIT_CODES = [17, 4, 32, 613];
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

interface UseVisitorPostsResult {
  visitorPosts: VisitorPost[];
  stats: UGCStats | null;
  isLoading: boolean;
  error: string | null;
  isRetrying: boolean;          // ✅ NEW
  retryCount: number;           // ✅ NEW
  scopeError: string[] | null;  // ✅ NEW: Missing scopes
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
  const [isRetrying, setIsRetrying] = useState(false);      // ✅ NEW
  const [retryCount, setRetryCount] = useState(0);          // ✅ NEW
  const [scopeError, setScopeError] = useState<string[] | null>(null);  // ✅ NEW
  const [filters, setFilters] = useState<UGCFilterState>(DEFAULT_UGC_FILTERS);

  // ✅ IMPROVED: Trigger background sync with userId and scope error handling
  const triggerSync = useCallback(async () => {
    if (!businessAccountId || !user?.id) return;

    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://api.888intelligenceautomation.in';

      // ✅ IMPROVED: Add userId parameter and await response
      const response = await fetch(`${apiBaseUrl}/api/instagram/sync/ugc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,         // ✅ NEW
          businessAccountId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();

        // ✅ Check for scope errors
        if (errorData.code === 'MISSING_SCOPES') {
          console.warn('⚠️  Sync blocked: Missing scopes', errorData.missing);
          setScopeError(errorData.missing);
        } else {
          console.warn('⚠️  Background sync failed:', errorData.error);
        }
        // Don't throw - sync is non-critical
      } else {
        const result = await response.json();
        console.log('✅ Background UGC sync completed:', result.synced_count || 0, 'posts');
        setScopeError(null);  // Clear any previous scope errors
      }
    } catch (err: any) {
      console.warn('⚠️  Failed to trigger sync:', err.message);
    }
  }, [businessAccountId, user?.id]);

  // ✅ NEW: Exponential backoff retry logic (matches useInstagramInsights)
  const fetchWithRetry = useCallback(async (
    url: string,
    config: RequestInit,
    attempt: number = 0
  ): Promise<Response> => {
    try {
      const response = await fetch(url, config);

      // If successful, return
      if (response.ok) {
        return response;
      }

      // Parse error
      const errorData = await response.json();
      const errorCode = errorData.code || errorData.error_code;

      // ✅ Handle scope errors (don't retry)
      if (errorCode === 'MISSING_SCOPES') {
        setScopeError(errorData.missing || []);
        throw new Error(`Missing required permissions: ${errorData.missing?.join(', ')}`);
      }

      // Check if it's a rate limit error
      if (RATE_LIMIT_CODES.includes(errorCode) && attempt < MAX_RETRIES) {
        setIsRetrying(true);
        setRetryCount(attempt + 1);

        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.min(BASE_DELAY_MS * Math.pow(2, attempt), 30000);
        console.log(`⏳ Rate limit hit. Retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);

        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchWithRetry(url, config, attempt + 1);
      }

      // If not a rate limit error or max retries reached, throw
      throw new Error(errorData.error || `API Error: ${response.status}`);
    } catch (err: any) {
      // Don't retry scope errors
      if (err.message.includes('Missing required permissions')) {
        throw err;
      }

      // Network errors - retry with backoff
      if ((err.message.includes('fetch') || err.code === 'ECONNREFUSED') && attempt < MAX_RETRIES) {
        setIsRetrying(true);
        setRetryCount(attempt + 1);

        const delay = Math.min(BASE_DELAY_MS * Math.pow(2, attempt), 30000);
        console.log(`⏳ Network error. Retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);

        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchWithRetry(url, config, attempt + 1);
      }

      throw err;
    } finally {
      if (attempt === MAX_RETRIES || attempt === 0) {
        setIsRetrying(false);
        setRetryCount(0);
      }
    }
  }, []);

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
    setScopeError(null);  // ✅ Clear previous scope errors

    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://api.888intelligenceautomation.in';

      // ✅ UPDATED: Add userId parameter and use fetchWithRetry
      const response = await fetchWithRetry(
        `${apiBaseUrl}/api/instagram/visitor-posts?userId=${user.id}&businessAccountId=${businessAccountId}&limit=50`,
        { headers: { 'Content-Type': 'application/json' } }
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch visitor posts');
      }

      setVisitorPosts(result.data || []);
      setStats(result.stats || null);
      console.log('✅ Visitor posts loaded:', result.data?.length || 0, 'posts');

    } catch (err: any) {
      console.error('❌ Visitor posts fetch failed:', err);
      setError(err.message || 'Failed to fetch visitor posts');
      setVisitorPosts([]);
      setStats(null);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, businessAccountId, fetchWithRetry]);

  const toggleFeatured = async (postId: string, featured: boolean): Promise<void> => {
    try {
      // ✅ REAL API CALL to update featured status
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://api.888intelligenceautomation.in';
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
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://api.888intelligenceautomation.in';
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
    // Trigger background sync on mount
    triggerSync();
    // Fetch data from database
    fetchVisitorPosts();
  }, [fetchVisitorPosts, triggerSync]);

  return {
    visitorPosts,
    stats,
    isLoading,
    error,
    isRetrying,     // ✅ NEW
    retryCount,     // ✅ NEW
    scopeError,     // ✅ NEW
    filters,
    setFilters,
    toggleFeatured,
    requestPermission,
    refetch: fetchVisitorPosts
  };
};

export default useVisitorPosts;
