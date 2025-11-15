// =====================================
// VISITOR POST CARD COMPONENT
// Displays individual UGC post
// Evidence: Follows CommentCard.tsx pattern
// =====================================

import React from 'react';
import { Heart, MessageCircle, ExternalLink, Star, Shield, StickyNote } from 'lucide-react';
import { SentimentBadge } from '../CommentManagement'; // EVIDENCE: Reuse existing component
import type { VisitorPost } from '../../../types/ugc';
import { motion } from 'framer-motion';

interface VisitorPostCardProps {
  post: VisitorPost;
  onFeatureToggle: (postId: string, featured: boolean) => void;
  onRequestPermission: (postId: string) => void;
  onAddNotes: (postId: string) => void;
}

export const VisitorPostCard: React.FC<VisitorPostCardProps> = ({
  post,
  onFeatureToggle,
  onRequestPermission,
  onAddNotes
}) => {
  const timeAgo = getTimeAgo(post.created_time);

  return (
    <motion.div
      className="glass-morphism-card rounded-xl overflow-hidden hover:border-purple-500/50 transition-all duration-200"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
    >
      {/* Author Info */}
      <div className="p-4 flex items-center space-x-3 border-b border-gray-700/50">
        <img
          src={post.author_profile_picture_url || 'https://i.pravatar.cc/150?img=0'}
          alt={post.author_name || 'User'}
          className="w-10 h-10 rounded-full"
        />
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold truncate">
            {post.author_name || 'Unknown User'}
          </p>
          <p className="text-gray-400 text-sm truncate">
            @{post.author_username || 'anonymous'} · {timeAgo}
          </p>
        </div>
        {post.featured && (
          <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
        )}
      </div>

      {/* Media Preview */}
      {post.media_url && (
        <div className="relative aspect-square bg-gray-800">
          {post.media_type === 'VIDEO' ? (
            <video
              src={post.media_url}
              className="w-full h-full object-cover"
              poster={post.thumbnail_url || undefined}
            />
          ) : (
            <img
              src={post.media_url}
              alt="Post media"
              className="w-full h-full object-cover"
            />
          )}
        </div>
      )}

      {/* Post Caption */}
      {post.message && (
        <div className="p-4 border-b border-gray-700/50">
          <p className="text-gray-300 text-sm line-clamp-3">
            {post.message}
          </p>
        </div>
      )}

      {/* Badges */}
      <div className="p-4 flex items-center space-x-2 border-b border-gray-700/50">
        {/* EVIDENCE: Reuse SentimentBadge from CommentManagement */}
        {post.sentiment && (post.sentiment === 'positive' || post.sentiment === 'neutral' || post.sentiment === 'negative') && (
          <SentimentBadge sentiment={post.sentiment as 'positive' | 'neutral' | 'negative'} />
        )}

        {post.priority && (
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            post.priority === 'urgent' ? 'bg-red-500/20 text-red-400' :
            post.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
            post.priority === 'medium' ? 'bg-blue-500/20 text-blue-400' :
            'bg-gray-500/20 text-gray-400'
          }`}>
            {post.priority.charAt(0).toUpperCase() + post.priority.slice(1)}
          </span>
        )}

        {post.repost_permission_requested && (
          <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-500/20 text-yellow-400">
            Permission Pending
          </span>
        )}
      </div>

      {/* Engagement Stats */}
      <div className="p-4 flex items-center space-x-4 text-gray-400 text-sm border-b border-gray-700/50">
        <span className="flex items-center space-x-1">
          <Heart className="w-4 h-4" />
          <span>{post.like_count ?? 0}</span>
        </span>
        <span className="flex items-center space-x-1">
          <MessageCircle className="w-4 h-4" />
          <span>{post.comment_count ?? 0}</span>
        </span>
        <a
          href={post.permalink_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center space-x-1 text-purple-400 hover:text-purple-300 transition-colors ml-auto"
        >
          <ExternalLink className="w-4 h-4" />
          <span>View on Instagram</span>
        </a>
      </div>

      {/* Action Buttons */}
      <div className="p-4 flex items-center space-x-2">
        <button
          onClick={() => onFeatureToggle(post.id, !post.featured)}
          className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            post.featured
              ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
              : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700/70'
          }`}
        >
          <Star className="w-4 h-4 inline mr-1" />
          {post.featured ? 'Featured' : 'Feature'}
        </button>

        {!post.repost_permission_requested && (
          <button
            onClick={() => onRequestPermission(post.id)}
            className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors"
          >
            <Shield className="w-4 h-4 inline mr-1" />
            Request Permission
          </button>
        )}

        <button
          onClick={() => onAddNotes(post.id)}
          className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-700/50 text-gray-300 hover:bg-gray-700/70 transition-colors"
        >
          <StickyNote className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
};

// Helper function
function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}
