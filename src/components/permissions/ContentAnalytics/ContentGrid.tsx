// =====================================
// CONTENT GRID COMPONENT
// Grid layout for media cards
// Responsive and supports filtering/sorting
// =====================================

import React from 'react';
import { AlertCircle } from 'lucide-react';
import { MediaCard } from './MediaCard';
import type { MediaData } from '../../../types/permissions';

interface ContentGridProps {
  media: MediaData[];
  onMediaClick?: (media: MediaData) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  className?: string;
}

export const ContentGrid: React.FC<ContentGridProps> = ({
  media,
  onMediaClick,
  isLoading = false,
  emptyMessage = 'No content found',
  className = ''
}) => {
  if (isLoading) {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}>
        {[...Array(6)].map((_, index) => (
          <div
            key={index}
            className="glass-morphism-card rounded-xl border border-gray-700 overflow-hidden animate-pulse"
          >
            <div className="aspect-square bg-white/5" />
            <div className="p-4">
              <div className="h-4 bg-white/5 rounded mb-2" />
              <div className="h-4 bg-white/5 rounded w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (media.length === 0) {
    return (
      <div className={`glass-morphism-card p-12 rounded-xl border border-gray-700 text-center ${className}`}>
        <AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-4" />
        <p className="text-gray-400 text-lg">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}>
      {media.map((item) => (
        <MediaCard key={item.id} media={item} onClick={onMediaClick} />
      ))}
    </div>
  );
};

export default ContentGrid;
