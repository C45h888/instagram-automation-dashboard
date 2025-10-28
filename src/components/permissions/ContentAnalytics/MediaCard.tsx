// =====================================
// MEDIA CARD COMPONENT
// Displays single media item with engagement metrics
// Shows performance tier and engagement rate
// =====================================

import React, { useState } from 'react';
import { Heart, MessageCircle, Share2, Eye, TrendingUp, Image as ImageIcon, Video, Grid } from 'lucide-react';
import { motion } from 'framer-motion';
import type { MediaData } from '../../../types/permissions';

interface MediaCardProps {
  media: MediaData;
  onClick?: (media: MediaData) => void;
  className?: string;
}

// Performance tier styling
const TIER_STYLES = {
  low: {
    bg: 'bg-gray-500/20',
    text: 'text-gray-300',
    border: 'border-gray-500/30'
  },
  average: {
    bg: 'bg-blue-500/20',
    text: 'text-blue-300',
    border: 'border-blue-500/30'
  },
  high: {
    bg: 'bg-green-500/20',
    text: 'text-green-300',
    border: 'border-green-500/30'
  },
  viral: {
    bg: 'bg-purple-500/20',
    text: 'text-purple-300',
    border: 'border-purple-500/30'
  }
} as const;

// Media type icons
const MEDIA_TYPE_ICONS = {
  IMAGE: ImageIcon,
  VIDEO: Video,
  CAROUSEL_ALBUM: Grid
};

export const MediaCard: React.FC<MediaCardProps> = ({ media, onClick, className = '' }) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  const tierStyle = TIER_STYLES[media.performance_tier];
  const MediaTypeIcon = media.media_type ? (MEDIA_TYPE_ICONS[media.media_type as keyof typeof MEDIA_TYPE_ICONS] || ImageIcon) : ImageIcon;

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formattedDate = media.published_at
    ? new Date(media.published_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    : 'Unknown';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      onClick={() => onClick?.(media)}
      className={`
        glass-morphism-card rounded-xl border border-gray-700 overflow-hidden
        ${onClick ? 'cursor-pointer hover:border-purple-500/50 transition-all' : ''}
        ${className}
      `}
    >
      {/* Media Thumbnail/Placeholder */}
      <div className="relative aspect-square bg-gray-900/50 overflow-hidden">
        {media.media_url || media.thumbnail_url ? (
          <>
            <img
              src={(media.thumbnail_url || media.media_url) || ''}
              alt={media.caption?.substring(0, 50) || 'Media'}
              onLoad={() => setImageLoaded(true)}
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500/20 to-pink-500/20">
            <MediaTypeIcon className="w-16 h-16 text-gray-600" />
          </div>
        )}

        {/* Media Type Badge */}
        <div className="absolute top-2 left-2 px-2 py-1 bg-black/80 rounded text-xs text-white flex items-center space-x-1">
          <MediaTypeIcon className="w-3 h-3" />
          <span>{media.media_type?.replace('_', ' ') || 'MEDIA'}</span>
        </div>

        {/* Performance Tier Badge */}
        <div
          className={`
            absolute top-2 right-2 px-2 py-1 rounded border font-medium text-xs
            ${tierStyle.bg} ${tierStyle.text} ${tierStyle.border}
          `}
        >
          {media.performance_tier.toUpperCase()}
        </div>

        {/* Engagement Rate Overlay */}
        <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 rounded text-xs text-white flex items-center space-x-1">
          <TrendingUp className="w-3 h-3" />
          <span>{media.engagement_rate.toFixed(1)}%</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Caption */}
        <p className="text-gray-200 text-sm line-clamp-2 mb-3 min-h-[40px]">
          {media.caption || 'No caption'}
        </p>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="flex items-center space-x-2 text-xs">
            <Heart className="w-4 h-4 text-red-400" />
            <span className="text-gray-300">{formatNumber(media.like_count || 0)}</span>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <MessageCircle className="w-4 h-4 text-blue-400" />
            <span className="text-gray-300">{formatNumber(media.comments_count || 0)}</span>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <Share2 className="w-4 h-4 text-green-400" />
            <span className="text-gray-300">{formatNumber(media.shares_count || 0)}</span>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <Eye className="w-4 h-4 text-purple-400" />
            <span className="text-gray-300">{formatNumber(media.reach || 0)}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-700">
          <span className="text-xs text-gray-500">{formattedDate}</span>
          {media.best_time_posted && (
            <span className="text-xs text-green-400 flex items-center space-x-1">
              <TrendingUp className="w-3 h-3" />
              <span>Best Time</span>
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default MediaCard;
