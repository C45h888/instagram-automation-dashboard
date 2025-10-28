// =====================================
// COMMENT INBOX COMPONENT
// Main container for comment management
// Integrates all comment subcomponents
// =====================================

import React from 'react';
import { MessageSquare, AlertCircle } from 'lucide-react';
import { CommentCard } from './CommentCard';
import type {CommentFilterState} from './CommentFilters';
import { CommentFilters,  } from './CommentFilters';
import { PermissionBadge } from '../shared/PermissionBadge';
import { FeatureHighlight } from '../shared/FeatureHighlight';
import { Smile, Bot, Zap, Shield } from 'lucide-react';
import type { CommentData } from '../../../types/permissions';

interface CommentInboxProps {
  comments: CommentData[];
  filters: CommentFilterState;
  onFiltersChange: (filters: CommentFilterState) => void;
  onSendReply: (commentId: string, replyText: string) => Promise<void>;
  isLoading?: boolean;
  className?: string;
}

export const CommentInbox: React.FC<CommentInboxProps> = ({
  comments,
  filters,
  onFiltersChange,
  onSendReply,
  isLoading = false,
  className = ''
}) => {
  // Apply filters to comments
  const filteredComments = comments.filter((comment) => {
    // Sentiment filter
    if (filters.sentiment !== 'all' && comment.sentiment !== filters.sentiment) {
      return false;
    }

    // Priority filter
    if (filters.priority !== 'all' && comment.priority_level !== filters.priority) {
      return false;
    }

    // Status filter
    if (filters.status !== 'all') {
      if (filters.status === 'automated' && !comment.processed_by_automation) return false;
      if (filters.status === 'manual' && comment.processed_by_automation) return false;
      if (filters.status === 'requires_response' && !comment.requires_response) return false;
    }

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return (
        comment.text?.toLowerCase().includes(searchLower) ||
        comment.author_username?.toLowerCase().includes(searchLower) ||
        comment.author_name?.toLowerCase().includes(searchLower)
      );
    }

    return true;
  });

  // Calculate stats
  const totalCount = comments.length;
  const requiresResponseCount = filteredComments.filter((c) => c.requires_response).length;
  const automatedCount = filteredComments.filter((c) => c.processed_by_automation).length;

  return (
    <div className={className}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <MessageSquare className="w-8 h-8 text-blue-400" />
            <div>
              <h1 className="text-3xl font-bold text-white">Comment Management</h1>
              <p className="text-gray-400 text-sm">Manage and respond to Instagram comments</p>
            </div>
          </div>
          <PermissionBadge permission="instagram_manage_comments" status="granted" size="lg" />
        </div>

        {/* Feature Highlights */}
        <FeatureHighlight
          features={[
            {
              icon: Smile,
              title: 'Sentiment Analysis',
              description: 'AI-powered sentiment detection for every comment',
              color: 'purple'
            },
            {
              icon: Bot,
              title: 'Auto-Reply System',
              description: 'Automated responses for common inquiries',
              color: 'blue'
            },
            {
              icon: Zap,
              title: 'Priority Routing',
              description: 'Urgent comments flagged for immediate attention',
              color: 'yellow'
            },
            {
              icon: Shield,
              title: 'Policy Compliance',
              description: 'All responses follow Meta Platform Policies',
              color: 'green'
            }
          ]}
          columns={4}
          className="mb-6"
        />
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="glass-morphism-card p-4 rounded-xl border border-gray-700">
          <p className="text-gray-400 text-sm mb-1">Total Comments</p>
          <p className="text-white text-2xl font-bold">{totalCount}</p>
        </div>
        <div className="glass-morphism-card p-4 rounded-xl border border-yellow-500/30">
          <p className="text-gray-400 text-sm mb-1">Requires Response</p>
          <p className="text-yellow-400 text-2xl font-bold">{requiresResponseCount}</p>
        </div>
        <div className="glass-morphism-card p-4 rounded-xl border border-green-500/30">
          <p className="text-gray-400 text-sm mb-1">Automated</p>
          <p className="text-green-400 text-2xl font-bold">{automatedCount}</p>
        </div>
      </div>

      {/* Filters */}
      <CommentFilters
        filters={filters}
        onChange={onFiltersChange}
        totalCount={totalCount}
        filteredCount={filteredComments.length}
        className="mb-6"
      />

      {/* Comment List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
            <p className="text-gray-400 mt-4">Loading comments...</p>
          </div>
        ) : filteredComments.length === 0 ? (
          <div className="glass-morphism-card p-12 rounded-xl border border-gray-700 text-center">
            <AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400 text-lg mb-2">No comments found</p>
            <p className="text-gray-500 text-sm">
              {filters.search || filters.sentiment !== 'all' || filters.priority !== 'all' || filters.status !== 'all'
                ? 'Try adjusting your filters'
                : 'Comments will appear here once they are received'}
            </p>
          </div>
        ) : (
          filteredComments.map((comment) => (
            <CommentCard key={comment.id} comment={comment} onSendReply={onSendReply} />
          ))
        )}
      </div>

      {/* Meta Review Note */}
      <div className="mt-8 p-4 bg-blue-500/10 rounded-xl border border-blue-500/30">
        <p className="text-xs text-blue-300 text-center">
          ✓ Demonstrates <span className="font-mono font-bold">instagram_manage_comments</span>{' '}
          permission: Read comments, reply to comments, delete comments (moderation)
        </p>
      </div>
    </div>
  );
};

export default CommentInbox;
