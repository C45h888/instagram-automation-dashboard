// =====================================
// UGC MANAGEMENT PAGE
// Full page for managing Instagram visitor posts and brand mentions
// Demonstrates pages_read_user_content permission
// Evidence: Follows CommentManagement.tsx pattern EXACTLY
// =====================================

import React, { useState } from 'react';
import { useVisitorPosts } from '../hooks/useVisitorPosts';
import { VisitorPostInbox, PermissionRequestModal, RepostConfirmationModal } from '../components/permissions/UGCManagement';
import AsyncWrapper from '../components/ui/AsyncWrapper';
import { useToast } from '../hooks/useToast';
import { useAuthStore } from '../stores/authStore';
import { useInstagramAccount } from '../hooks/useInstagramAccount';
import type { VisitorPost, PermissionRequestForm } from '../types/ugc';

const UGCManagement: React.FC = () => {
  // EVIDENCE: Hook returns filters and setFilters
  const {
    visitorPosts,
    stats,
    isLoading,
    error,
    filters,
    setFilters,
    toggleFeatured,
    requestPermission,
    refetch
  } = useVisitorPosts();

  const toast = useToast();
  const { user } = useAuthStore();
  const { businessAccountId } = useInstagramAccount();

  const [selectedPost, setSelectedPost] = useState<VisitorPost | null>(null);
  const [repostPost, setRepostPost] = useState<VisitorPost | null>(null);
  const [isReposting, setIsReposting] = useState(false);

  // Feature toggle handler
  const handleFeatureToggle = async (postId: string, featured: boolean) => {
    try {
      await toggleFeatured(postId, featured);
      toast.success(
        featured ? 'Post featured successfully!' : 'Post unfeatured',
        {
          title: 'Success',
          duration: 3000
        }
      );
    } catch (err: any) {
      toast.error(err.message || 'Failed to update post', {
        title: 'Error',
        duration: 5000
      });
    }
  };

  // Permission request handler
  const handleRequestPermission = async (form: PermissionRequestForm) => {
    try {
      await requestPermission(form);
      toast.success('Permission request sent!', {
        title: 'Success',
        duration: 3000
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to request permission', {
        title: 'Error',
        duration: 5000
      });
      throw err; // Re-throw to let modal handle UI state
    }
  };

  // Repost click handler - opens confirmation modal
  const handleRepostClick = (postId: string) => {
    const post = visitorPosts.find(p => p.id === postId);
    if (post) {
      setRepostPost(post);
    }
  };

  // Repost confirmation handler - executes the repost
  const handleRepostConfirm = async () => {
    if (!repostPost || !user?.id || !businessAccountId) {
      toast.error('Missing required information for repost', {
        title: 'Error',
        duration: 5000
      });
      return;
    }

    setIsReposting(true);

    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://api.888intelligenceautomation.in';
      const response = await fetch(`${apiBaseUrl}/api/instagram/ugc/repost`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.id,
          businessAccountId,
          ugcContentId: repostPost.id
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to repost content');
      }

      toast.success('Content reposted successfully to your Instagram!', {
        title: 'Success',
        duration: 5000
      });

      // Close modal and refresh posts
      setRepostPost(null);
      await refetch();

    } catch (err: any) {
      console.error('❌ [Repost Error]:', err);
      toast.error(err.message || 'Failed to repost content', {
        title: 'Repost Failed',
        duration: 5000
      });
    } finally {
      setIsReposting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="glass-morphism-card p-6 rounded-2xl">
        <h1 className="text-3xl font-bold text-white mb-2">
          UGC Management
        </h1>
        <p className="text-gray-300">
          Monitor and manage visitor posts and brand mentions on your Instagram Business account
        </p>
      </div>

      {/* EVIDENCE: AsyncWrapper for loading states */}
      <AsyncWrapper
        loading={isLoading}
        error={error ? new Error(error) : null}
        data={visitorPosts}
        skeleton={() => (
          <div className="glass-morphism-card p-6 rounded-xl animate-pulse">
            <div className="h-96 bg-white/5 rounded-lg"></div>
          </div>
        )}
      >
        {(data) => (
          <VisitorPostInbox
            posts={data}
            stats={stats}
            filters={filters}
            onFiltersChange={setFilters}
            onFeatureToggle={handleFeatureToggle}
            onRequestPermission={(postId) => {
              const post = data.find(p => p.id === postId);
              setSelectedPost(post || null);
            }}
            onRepost={handleRepostClick}
            onAddNotes={(postId) => {
              // TODO: Implement notes modal
              console.log('Add notes for post:', postId);
            }}
          />
        )}
      </AsyncWrapper>

      {/* Permission Request Modal */}
      <PermissionRequestModal
        isOpen={selectedPost !== null}
        post={selectedPost}
        onClose={() => setSelectedPost(null)}
        onSubmit={handleRequestPermission}
      />

      {/* Repost Confirmation Modal */}
      <RepostConfirmationModal
        isOpen={repostPost !== null}
        post={repostPost!}
        onConfirm={handleRepostConfirm}
        onCancel={() => setRepostPost(null)}
        isLoading={isReposting}
      />
    </div>
  );
};

export default UGCManagement;
