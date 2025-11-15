// src/pages/ContentManagement.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, TrendingUp, Plus, Image as ImageIcon, Video, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useInstagramAccount } from '../hooks/useInstagramAccount';
import { CreatePostModal } from '../components/permissions/ContentManagement/CreatePostModal';
import { SkeletonMediaGrid } from '../components/ui/SkeletonMediaGrid';
import { useToast } from '../hooks/useToast';
import LoadingButton from '../components/ui/LoadingButton';
import type { MediaGridResponse, InstagramMedia } from '../types/instagram-media';

// MediaGrid Component
interface MediaGridProps {
  media: InstagramMedia[];
  isLoading: boolean;
}

const MediaGrid: React.FC<MediaGridProps> = ({ media, isLoading }) => {
  if (isLoading) {
    return <SkeletonMediaGrid count={8} />;
  }

  if (!media || media.length === 0) {
    return (
      <div className="text-center text-gray-400 glass-morphism-card p-12 rounded-2xl border border-gray-700">
        <ImageIcon className="w-16 h-16 mx-auto mb-4 text-gray-500" />
        <p className="text-lg font-medium mb-2">No media found</p>
        <p className="text-sm">Create your first Instagram post to get started!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {media.map((item) => (
        <div
          key={item.id}
          className="glass-morphism-card rounded-2xl overflow-hidden group border border-gray-700/50 hover:border-green-500/50 transition-all duration-300"
        >
          <a
            href={item.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full h-48 relative overflow-hidden"
          >
            {item.media_type === 'IMAGE' || item.media_type === 'CAROUSEL_ALBUM' ? (
              <img
                src={item.media_type === 'CAROUSEL_ALBUM' ? item.thumbnail_url : item.media_url}
                alt={item.caption?.substring(0, 50) || 'Instagram post'}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                loading="lazy"
              />
            ) : (
              <video
                src={item.media_url}
                className="w-full h-full object-cover"
                muted
                playsInline
                poster={item.thumbnail_url}
              />
            )}

            {/* Media Type Badge */}
            <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm p-1.5 rounded-full">
              {item.media_type === 'VIDEO' ? (
                <Video className="w-4 h-4 text-white" />
              ) : (
                <ImageIcon className="w-4 h-4 text-white" />
              )}
            </div>

            {/* Hover Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
              <div className="p-3 w-full">
                <p className="text-white text-xs font-medium">View on Instagram →</p>
              </div>
            </div>
          </a>

          {/* Post Info */}
          <div className="p-4">
            <p className="text-white text-sm line-clamp-2 mb-2 min-h-[2.5rem]">
              {item.caption || 'No caption'}
            </p>

            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>{new Date(item.timestamp).toLocaleDateString()}</span>
              {(item.like_count !== undefined || item.comments_count !== undefined) && (
                <div className="flex items-center space-x-3">
                  {item.like_count !== undefined && (
                    <span>❤️ {item.like_count}</span>
                  )}
                  {item.comments_count !== undefined && (
                    <span>💬 {item.comments_count}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// Main Component
const ContentManagement: React.FC = () => {
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToast();

  // Modal state (using simple useState instead of useModal hook)
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Media state
  const [media, setMedia] = useState<InstagramMedia[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auth state
  const userId = useAuthStore(state => state.user?.id);
  const { businessAccountId, instagramBusinessId } = useInstagramAccount();

  // Fetch media function
  const fetchMedia = useCallback(async (showRefreshToast = false) => {
    if (!userId || !businessAccountId || !instagramBusinessId) {
      console.warn('⚠️ Missing authentication data');
      setIsLoading(false);
      return;
    }

    const isRefresh = showRefreshToast;
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      console.log('📥 Fetching Instagram media...');

      const url = `/api/instagram/media/${instagramBusinessId}?userId=${userId}&businessAccountId=${businessAccountId}&limit=50`;
      const response = await fetch(url);
      const result: MediaGridResponse = await response.json();

      if (!response.ok || !result.success) {
        // Handle specific error codes
        if (result.code === 'TOKEN_INVALID' || result.code === 'TOKEN_RETRIEVAL_FAILED') {
          throw new Error('Your Instagram connection expired. Please reconnect your account in Settings.');
        }
        if (result.code === 'RATE_LIMIT_EXCEEDED') {
          throw new Error('Rate limit exceeded. Please wait before refreshing again.');
        }

        throw new Error(result.error || 'Failed to fetch media');
      }

      console.log(`✅ Fetched ${result.data.length} media items`);
      setMedia(result.data);

      if (isRefresh) {
        toastSuccess(`Loaded ${result.data.length} posts`, {
          title: 'Refreshed',
          duration: 3000
        });
      }

    } catch (error: any) {
      console.error('❌ Failed to fetch media:', error);

      toastError(error.message || 'Failed to load Instagram media', {
        title: 'Error',
        duration: 5000
      });

      setMedia([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [userId, businessAccountId, instagramBusinessId, toastSuccess, toastError]);

  // Initial fetch
  useEffect(() => {
    fetchMedia(false);
  }, [fetchMedia]);

  // Handlers
  const handleOpenModal = () => setIsModalOpen(true);
  const handleCloseModal = () => setIsModalOpen(false);
  const handlePostSuccess = () => {
    fetchMedia(false); // Refetch without toast
  };
  const handleRefresh = () => {
    fetchMedia(true); // Refetch with toast
  };

  return (
    <>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Content Management</h1>
            <p className="text-gray-300">Create, publish, and manage your Instagram content.</p>
          </div>

          <div className="flex items-center space-x-3">
            <LoadingButton
              onClick={handleRefresh}
              loading={isRefreshing}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </LoadingButton>

            <LoadingButton
              onClick={handleOpenModal}
              loading={false}
              className="flex items-center space-x-2 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-6 rounded-lg transition-all shadow-lg shadow-green-500/30"
            >
              <Plus className="w-5 h-5" />
              <span>Create Post</span>
            </LoadingButton>
          </div>
        </div>

        {/* Content Analytics Card (Existing) */}
        <div
          onClick={() => navigate('/content/analytics')}
          className="glass-morphism-card p-6 rounded-2xl cursor-pointer hover:border-green-500/50 border border-gray-700 transition-all group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center group-hover:bg-green-500/30 transition-all">
                <BarChart3 className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-1">Content Analytics</h3>
                <p className="text-gray-400">View performance metrics and engagement data</p>
              </div>
            </div>
            <TrendingUp className="w-6 h-6 text-green-400 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Published Media Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold text-white">Published Media</h2>
            {!isLoading && media.length > 0 && (
              <p className="text-gray-400 text-sm">
                {media.length} post{media.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          <MediaGrid media={media} isLoading={isLoading} />
        </div>
      </div>

      {/* Create Post Modal */}
      <CreatePostModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSuccess={handlePostSuccess}
      />
    </>
  );
};

export default ContentManagement;
