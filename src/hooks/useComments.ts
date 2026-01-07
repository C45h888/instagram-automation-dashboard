// =====================================
// USE COMMENTS HOOK - PRODUCTION
// Fetches REAL Instagram comment data from Meta Graph API v23.0
// NO MOCK DATA, NO FALLBACKS
// Handles filtering, reply submission, and data refresh
//
// ✅ UPDATED: Uses useInstagramAccount hook
// ✅ UPDATED: Passes userId + businessAccountId query params
// ✅ UPDATED: No Authorization header (backend handles tokens)
// ✅ UPDATED: Uses VITE_API_BASE_URL
// =====================================

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useInstagramAccount } from './useInstagramAccount';
import type { CommentData } from '../types/permissions';
import type { CommentFilterState } from '../components/permissions/CommentManagement';

interface UseCommentsResult {
  comments: CommentData[];
  isLoading: boolean;
  error: string | null;
  filters: CommentFilterState;
  setFilters: (filters: CommentFilterState) => void;
  replyToComment: (commentId: string, replyText: string) => Promise<void>;
  refetch: () => void;
}

/**
 * Hook to fetch and manage Instagram comments
 * ✅ UPDATED: No longer takes businessAccountId parameter (gets from useInstagramAccount)
 * @param mediaId - Specific media ID to filter comments (optional)
 */
export const useComments = (mediaId?: string): UseCommentsResult => {
  // ✅ NEW: Get user ID from auth store (no token needed)
  const { user } = useAuthStore();

  // ✅ NEW: Get Instagram account IDs from useInstagramAccount hook
  const { businessAccountId, instagramBusinessId } = useInstagramAccount();

  const [comments, setComments] = useState<CommentData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<CommentFilterState>({
    sentiment: 'all',
    priority: 'all',
    status: 'all',
    search: ''
  });

  const fetchComments = useCallback(async () => {
    // ✅ UPDATED: Validate user ID and business account ID
    if (!user?.id || !businessAccountId || !instagramBusinessId) {
      setError('No Instagram Business Account connected.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // ✅ UPDATED: Use VITE_API_BASE_URL from environment
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://api.888intelligenceautomation.in';

      // ✅ UPDATED: Build endpoint with full URL and required query parameters
      const endpoint = mediaId
        ? `${apiBaseUrl}/api/instagram/comments/${mediaId}?userId=${user.id}&businessAccountId=${businessAccountId}`
        : `${apiBaseUrl}/api/instagram/comments/${instagramBusinessId}?userId=${user.id}&businessAccountId=${businessAccountId}`;

      const response = await fetch(endpoint, {
        headers: {
          // ✅ REMOVED: Authorization header (backend retrieves token internally)
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API Error: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch comments');
      }

      setComments(result.data || []);
      console.log('✅ Comments fetched:', result.data?.length || 0, 'comments');

    } catch (err: any) {
      console.error('❌ Comments fetch failed:', err);
      setError(err.message || 'Failed to fetch comments');
      setComments([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, businessAccountId, instagramBusinessId, mediaId]); // ✅ UPDATED: Removed token, added user.id and instagramBusinessId

  const replyToComment = async (commentId: string, replyText: string): Promise<void> => {
    // Validate authentication
    if (!user?.id || !businessAccountId) {
      throw new Error('No Instagram Business Account connected');
    }

    // Validate reply
    if (!replyText.trim()) {
      throw new Error('Reply cannot be empty');
    }

    if (replyText.length > 2200) {
      throw new Error('Reply exceeds 2,200 character limit');
    }

    try {
      // ✅ UPDATED: Use VITE_API_BASE_URL and add required query parameters
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://api.888intelligenceautomation.in';
      const response = await fetch(
        `${apiBaseUrl}/api/instagram/comments/${commentId}/reply?userId=${user.id}&businessAccountId=${businessAccountId}`,
        {
          method: 'POST',
          headers: {
            // ✅ REMOVED: Authorization header (backend retrieves token internally)
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ message: replyText })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send reply');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Reply failed');
      }

      // Refetch comments to show the new reply
      await fetchComments();

      console.log('✅ Reply sent successfully:', result.data?.replyId);
    } catch (err: any) {
      throw new Error(err.message || 'Failed to send reply');
    }
  };

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  return {
    comments,
    isLoading,
    error,
    filters,
    setFilters,
    replyToComment,
    refetch: fetchComments
  };
};

export default useComments;
