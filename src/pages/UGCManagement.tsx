// =====================================
// UGC MANAGEMENT PAGE
// Full page for managing Instagram visitor posts and brand mentions
// Demonstrates pages_read_user_content permission
// Evidence: Follows CommentManagement.tsx pattern EXACTLY
// =====================================

import React, { useState } from 'react';
import { useVisitorPosts } from '../hooks/useVisitorPosts';
import { VisitorPostInbox, PermissionRequestModal } from '../components/permissions/UGCManagement';
import AsyncWrapper from '../components/ui/AsyncWrapper';
import { useToast } from '../hooks/useToast';
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
    requestPermission
  } = useVisitorPosts();

  const toast = useToast();
  const [selectedPost, setSelectedPost] = useState<VisitorPost | null>(null);

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
    </div>
  );
};

export default UGCManagement;
