// =====================================
// COMMENT MANAGEMENT PAGE
// Full page for managing Instagram comments
// Demonstrates instagram_manage_comments permission
// =====================================

import React from 'react';
import { useComments } from '../hooks/useComments';
import { CommentInbox } from '../components/permissions/CommentManagement';
import AsyncWrapper from '../components/ui/AsyncWrapper';
import { useToast } from '../hooks/useToast';

const CommentManagement: React.FC = () => {
  const { comments, isLoading, error, filters, setFilters, replyToComment } = useComments();
  const toast = useToast();

  const handleSendReply = async (commentId: string, replyText: string): Promise<void> => {
    try {
      await replyToComment(commentId, replyText);
      toast.success('Reply sent successfully!', {
        title: 'Success',
        duration: 3000
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to send reply', {
        title: 'Error',
        duration: 5000
      });
      throw err; // Re-throw to let ReplyInterface handle UI state
    }
  };

  return (
    <div className="space-y-6">
      {/* Demo Mode Toggle */}

      {/* Comment Inbox with Loading States */}
      <AsyncWrapper
        loading={isLoading}
        error={error ? new Error(error) : null}
        data={comments}
        skeleton={() => (
          <div className="glass-morphism-card p-6 rounded-xl animate-pulse">
            <div className="h-96 bg-white/5 rounded-lg"></div>
          </div>
        )}
      >
        {(data) => (
          <CommentInbox
            comments={data}
            filters={filters}
            onFiltersChange={setFilters}
            onSendReply={handleSendReply}
          />
        )}
      </AsyncWrapper>
    </div>
  );
};

export default CommentManagement;
