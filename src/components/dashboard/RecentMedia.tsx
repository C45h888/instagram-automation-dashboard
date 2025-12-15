import React from 'react';
import { Heart, MessageCircle, Play, Eye } from 'lucide-react';
import type { MediaItem } from '../../types/dashboard';

interface RecentMediaProps {
  media: MediaItem[];
  isLoading?: boolean;
}

const RecentMedia: React.FC<RecentMediaProps> = ({ media, isLoading = false }) => {
  const getMediaIcon = (type: MediaItem['type']) => {
    switch (type) {
      case 'reel': return <Play className="w-4 h-4" />;
      case 'story': return <Eye className="w-4 h-4" />;
      default: return null;
    }
  };

  if (isLoading) {
    return (
      <div className="glass-morphism-card p-6 rounded-2xl">
        <h2 className="text-xl font-bold text-white mb-6">Recent Media</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="aspect-square bg-white/10 rounded-lg animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-morphism-card p-6 rounded-2xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Recent Media</h2>
        <button className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors">
          View All
        </button>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {media.map((item) => {
          // ✅ Video Thumbnail Support: Use thumbnailUrl for VIDEO, imageUrl for IMAGE
          const displayUrl = item.mediaType === 'VIDEO'
            ? (item.thumbnailUrl || item.imageUrl)
            : item.imageUrl;

          return (
            <div key={item.id} className="group relative aspect-square rounded-lg overflow-hidden hover:scale-105 transition-all duration-300">
              {item.mediaType === 'VIDEO' ? (
                <div className="relative w-full h-full">
                  <img
                    src={displayUrl}
                    alt="Video thumbnail"
                    className="w-full h-full object-cover"
                  />
                  {/* Video Play Indicator */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="p-3 rounded-full bg-black/60 text-white">
                      <Play className="w-6 h-6" />
                    </div>
                  </div>
                </div>
              ) : (
                <img
                  src={displayUrl}
                  alt="Recent post"
                  className="w-full h-full object-cover"
                />
              )}

              {/* Media Type Indicator */}
              {getMediaIcon(item.type) && (
                <div className="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white">
                  {getMediaIcon(item.type)}
                </div>
              )}

              {/* Hover Overlay */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="flex items-center justify-center space-x-4 mb-2">
                    <div className="flex items-center space-x-1">
                      <Heart className="w-4 h-4" />
                      <span className="text-sm">{item.likes}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <MessageCircle className="w-4 h-4" />
                      <span className="text-sm">{item.comments}</span>
                    </div>
                  </div>
                  <div className="text-xs text-green-400 font-medium">
                    {item.engagement} engagement
                  </div>
                  <div className="text-xs text-gray-300 mt-1">
                    {item.timestamp}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RecentMedia;