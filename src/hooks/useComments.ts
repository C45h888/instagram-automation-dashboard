// =====================================
// USE COMMENTS HOOK
// Fetches and manages Instagram comment data
// Handles filtering, reply submission, and data refresh
// =====================================

import { useState, useEffect } from 'react';
import { usePermissionDemoStore } from '../stores/permissionDemoStore';
import PermissionDemoService from '../services/permissionDemoService';
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

export const useComments = (): UseCommentsResult => {
  const { demoMode } = usePermissionDemoStore();
  const [comments, setComments] = useState<CommentData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<CommentFilterState>({
    sentiment: 'all',
    priority: 'all',
    status: 'all',
    search: ''
  });

  const fetchComments = async () => {
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
          timeRange: 'week'
        });
        setComments(demoData.comments);
      } else {
        // Fetch real data from Supabase
        // TODO: Implement real data fetching from instagram_comments table
        // const { data, error } = await supabase
        //   .from('instagram_comments')
        //   .select('*')
        //   .order('published_at', { ascending: false });

        // For now, fallback to demo data
        const demoData = PermissionDemoService.generateDemoData({
          realistic: true,
          volume: 'medium',
          includeEdgeCases: true,
          timeRange: 'week'
        });
        setComments(demoData.comments);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch comments');
    } finally {
      setIsLoading(false);
    }
  };

  const replyToComment = async (commentId: string, replyText: string): Promise<void> => {
    try {
      // Validate reply
      if (!replyText.trim()) {
        throw new Error('Reply cannot be empty');
      }

      if (replyText.length > 2200) {
        throw new Error('Reply exceeds 2,200 character limit');
      }

      if (demoMode) {
        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Update comment in local state to show reply was sent
        setComments((prevComments) =>
          prevComments.map((comment) =>
            comment.id === commentId
              ? {
                  ...comment,
                  reply_count: (comment.reply_count || 0) + 1,
                  processed_by_automation: false,
                  automated_response_sent: true,
                  response_text: replyText,
                  response_sent_at: new Date().toISOString()
                }
              : comment
          )
        );

        // Show success toast (handled by component)
      } else {
        // Send real reply to Instagram via Supabase function
        // TODO: Implement real reply submission
        // const { error } = await supabase.rpc('send_comment_reply', {
        //   comment_id: commentId,
        //   reply_text: replyText
        // });

        // For now, simulate success
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setComments((prevComments) =>
          prevComments.map((comment) =>
            comment.id === commentId
              ? {
                  ...comment,
                  reply_count: (comment.reply_count || 0) + 1,
                  automated_response_sent: true,
                  response_text: replyText,
                  response_sent_at: new Date().toISOString()
                }
              : comment
          )
        );
      }
    } catch (err: any) {
      throw new Error(err.message || 'Failed to send reply');
    }
  };

  useEffect(() => {
    fetchComments();
  }, [demoMode]);

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
