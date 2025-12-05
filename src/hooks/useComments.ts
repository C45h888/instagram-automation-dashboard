// =====================================
// USE COMMENTS HOOK - PRODUCTION
// Fetches REAL Instagram comment data from Meta Graph API
// NO MOCK DATA, NO FALLBACKS
// Handles filtering, reply submission, and data refresh
// =====================================

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
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
 * @param businessAccountId - Instagram Business Account ID (optional)
 * @param mediaId - Specific media ID to filter comments (optional)
 */
export const useComments = (businessAccountId?: string, mediaId?: string): UseCommentsResult => {
  const { user, token } = useAuthStore();
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
    if (!businessAccountId) {
      setError('No Instagram Business Account connected.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // ✅ REAL API CALL
      const endpoint = mediaId
        ? `/api/instagram/comments/${mediaId}`
        : `/api/instagram/comments?businessAccountId=${businessAccountId}`;

      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
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
  }, [businessAccountId, token, mediaId]);

  const replyToComment = async (commentId: string, replyText: string): Promise<void> => {
    // Validate reply
    if (!replyText.trim()) {
      throw new Error('Reply cannot be empty');
    }

    if (replyText.length > 2200) {
      throw new Error('Reply exceeds 2,200 character limit');
    }

    try {
      // ✅ REAL API CALL to send reply
      const response = await fetch(`/api/instagram/comments/${commentId}/reply`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: replyText })
      });

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
