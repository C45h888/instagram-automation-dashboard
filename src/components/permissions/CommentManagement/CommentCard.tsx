// =====================================
// COMMENT CARD COMPONENT
// Displays individual comment with reply interface
// Integrates sentiment, priority, and automation status
// =====================================

import React, { useState } from 'react';
import { Heart, MessageCircle, Bot, Clock, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { SentimentBadge } from './SentimentBadge';
import { ReplyInterface } from './ReplyInterface';
import type { CommentData } from '../../../types/permissions';

interface CommentCardProps {
  comment: CommentData;
  onSendReply: (commentId: string, replyText: string) => Promise<void>;
  className?: string;
}

// Priority level styling
const PRIORITY_STYLES = {
  low: {
    bg: 'bg-gray-500/10',
    text: 'text-gray-400',
    border: 'border-gray-500/30'
  },
  medium: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/30'
  },
  high: {
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-400',
    border: 'border-yellow-500/30'
  },
  urgent: {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/30'
  }
} as const;

export const CommentCard: React.FC<CommentCardProps> = ({
  comment,
  onSendReply,
  className = ''
}) => {
  const [showReplyInterface, setShowReplyInterface] = useState(false);

  const priorityStyle = PRIORITY_STYLES[comment.priority_level];
  const formattedDate = comment.published_at
    ? new Date(comment.published_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Recently';

  const handleSendReply = async (commentId: string, replyText: string) => {
    await onSendReply(commentId, replyText);
    setShowReplyInterface(false); // Close interface on success
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`
        glass-morphism-card p-4 rounded-xl border
        ${comment.requires_response ? 'border-yellow-500/30' : 'border-gray-700'}
        ${className}
      `}
    >
      {/* Header: Author + Badges */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3 flex-1">
          {/* Author Avatar */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">
              {comment.author_username?.charAt(0).toUpperCase() || '?'}
            </span>
          </div>

          {/* Author Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <p className="text-white font-semibold text-sm truncate">
                {comment.author_name || 'Unknown'}
              </p>
              <span className="text-gray-500 text-xs">@{comment.author_username}</span>
            </div>
            <p className="text-gray-400 text-xs flex items-center space-x-2">
              <Clock className="w-3 h-3" />
              <span>{formattedDate}</span>
            </p>
          </div>
        </div>

        {/* Sentiment Badge */}
        <SentimentBadge sentiment={(comment.sentiment as 'positive' | 'neutral' | 'negative') || 'neutral'} size="sm" />
      </div>

      {/* Comment Text */}
      <div className="mb-3">
        <p className="text-gray-200 text-sm leading-relaxed">{comment.text}</p>
      </div>

      {/* Metadata: Likes, Replies, Priority */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-4 text-xs text-gray-400">
          {/* Likes */}
          <div className="flex items-center space-x-1">
            <Heart className="w-4 h-4" />
            <span>{comment.like_count || 0}</span>
          </div>

          {/* Reply Count */}
          <div className="flex items-center space-x-1">
            <MessageCircle className="w-4 h-4" />
            <span>{comment.reply_count || 0}</span>
          </div>

          {/* Priority Badge */}
          {comment.priority_level && (
            <span
              className={`
                px-2 py-0.5 rounded-full border text-xs font-medium
                ${priorityStyle.bg} ${priorityStyle.text} ${priorityStyle.border}
              `}
            >
              {comment.priority_level.toUpperCase()}
            </span>
          )}
        </div>

        {/* Automation Status */}
        {comment.processed_by_automation && (
          <div className="flex items-center space-x-1 text-xs text-green-400">
            <Bot className="w-4 h-4" />
            <span>Auto-replied</span>
          </div>
        )}
      </div>

      {/* Post Context (if available) */}
      {comment.post_title && (
        <div className="mb-3 p-2 bg-gray-900/50 rounded border border-gray-700">
          <p className="text-xs text-gray-400">
            On post: <span className="text-blue-400">{comment.post_title}</span>
          </p>
        </div>
      )}

      {/* Automated Response (if exists) */}
      {comment.automated_response_sent && comment.response_text && (
        <div className="mb-3 p-3 bg-green-500/10 rounded-lg border border-green-500/30">
          <div className="flex items-center space-x-2 mb-1">
            <Bot className="w-4 h-4 text-green-400" />
            <p className="text-xs text-green-400 font-semibold">Automated Reply Sent</p>
          </div>
          <p className="text-sm text-gray-300 italic">"{comment.response_text}"</p>
        </div>
      )}

      {/* Requires Response Alert */}
      {comment.requires_response && !comment.automated_response_sent && (
        <div className="mb-3 p-2 bg-yellow-500/10 rounded border border-yellow-500/30 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
          <p className="text-xs text-yellow-300">This comment requires a response</p>
        </div>
      )}

      {/* Reply Button */}
      {!showReplyInterface && (
        <button
          onClick={() => setShowReplyInterface(true)}
          className="w-full py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-300 text-sm font-medium transition-all flex items-center justify-center space-x-2"
        >
          <MessageCircle className="w-4 h-4" />
          <span>Reply to Comment</span>
        </button>
      )}

      {/* Reply Interface */}
      {showReplyInterface && (
        <ReplyInterface
          commentId={comment.id}
          commentAuthor={comment.author_username || 'user'}
          onSendReply={handleSendReply}
          onCancel={() => setShowReplyInterface(false)}
          className="mt-3"
        />
      )}
    </motion.div>
  );
};

export default CommentCard;
