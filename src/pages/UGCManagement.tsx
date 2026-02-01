// =====================================
// UGC MANAGEMENT PAGE - v2.0
// Full page for managing Instagram visitor posts and brand mentions
// Demonstrates pages_read_user_content permission
//
// ✅ REFACTORED (Phase 3):
// - Lazy-loaded modals for bundle optimization
// - Edge case banners (no account, token expired, scope errors)
// - Retry state banner
// =====================================

import React, { useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, AlertCircle, Link2, Shield } from 'lucide-react';
import { useVisitorPosts } from '../hooks/useVisitorPosts';
import { VisitorPostInbox } from '../components/permissions/UGCManagement';
// ✅ LAZY LOAD: Heavy modals (bundle optimization)
const PermissionRequestModal = lazy(() =>
  import('../components/permissions/UGCManagement').then(mod => ({
    default: mod.PermissionRequestModal
  }))
);
const RepostConfirmationModal = lazy(() =>
  import('../components/permissions/UGCManagement').then(mod => ({
    default: mod.RepostConfirmationModal
  }))
);
import AsyncWrapper from '../components/ui/AsyncWrapper';
import PermissionBadge from '../components/permissions/shared/PermissionBadge';  // ✅ NEW: Phase 4
import { useToast } from '../hooks/useToast';
import { useAuthStore } from '../stores/authStore';
import { useInstagramAccount } from '../hooks/useInstagramAccount';
import type { VisitorPost, PermissionRequestForm } from '../types/ugc';

const MAX_RETRIES = 3;

const UGCManagement: React.FC = () => {
  const navigate = useNavigate();

  const {
    visitorPosts,
    stats,
    isLoading,
    error,
    isRetrying,      // ✅ NEW
    retryCount,      // ✅ NEW
    scopeError,      // ✅ NEW
    filters,
    setFilters,
    toggleFeatured,
    requestPermission,
    refetch
  } = useVisitorPosts();

  const toast = useToast();
  const { user } = useAuthStore();
  const { businessAccountId, isLoading: accountLoading } = useInstagramAccount();

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

  // ✅ Edge Case 1: No Account Connected
  if (!accountLoading && !businessAccountId) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">UGC Management</h1>
            <p className="text-gray-300 text-lg">Manage visitor posts and brand mentions</p>
          </div>
        </div>

        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-8 text-center">
          <Link2 className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Instagram Account Connected</h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Connect your Instagram Business Account to view visitor posts and manage UGC.
          </p>
          <button
            onClick={() => navigate('/settings')}
            className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-black font-medium rounded-lg transition-all"
          >
            Connect Account
          </button>
        </div>
      </div>
    );
  }

  // ✅ Edge Case 2: Token Expired
  if (error?.includes('token expired') || error?.includes('190')) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">UGC Management</h1>
            <p className="text-gray-300 text-lg">Manage visitor posts and brand mentions</p>
          </div>
        </div>

        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Instagram Token Expired</h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Your Instagram connection has expired. Please reconnect your account to continue managing UGC.
          </p>
          <button
            onClick={() => navigate('/settings')}
            className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-all"
          >
            Reconnect Account
          </button>
        </div>
      </div>
    );
  }

  // ✅ Edge Case 3: Missing Scopes (from scope validation)
  if (scopeError && scopeError.length > 0) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">UGC Management</h1>
            <p className="text-gray-300 text-lg">Manage visitor posts and brand mentions</p>
          </div>
        </div>

        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-8 text-center">
          <Shield className="w-12 h-12 text-orange-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Missing Permissions</h3>
          <p className="text-gray-400 mb-4 max-w-md mx-auto">
            Your Instagram account needs additional permissions to view visitor posts:
          </p>
          <div className="mb-6 inline-block">
            {scopeError.map(scope => (
              <span key={scope} className="px-3 py-1 bg-orange-500/20 text-orange-300 rounded-full text-sm mx-1">
                {scope}
              </span>
            ))}
          </div>
          <button
            onClick={() => navigate('/settings')}
            className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-all"
          >
            Grant Permissions
          </button>
        </div>
      </div>
    );
  }

  // ✅ Edge Case 4: Generic Permission Error (fallback)
  if (error?.includes('permission') || error?.includes('100')) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">UGC Management</h1>
            <p className="text-gray-300 text-lg">Manage visitor posts and brand mentions</p>
          </div>
        </div>

        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-orange-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Permission Required</h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Your Instagram account needs the "pages_read_user_content" permission to view visitor posts.
          </p>
          <button
            onClick={() => navigate('/settings')}
            className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-all"
          >
            Grant Permissions
          </button>
        </div>
      </div>
    );
  }

  // ✅ Retry State Banner (shown during retries)
  const retryBanner = isRetrying && (
    <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex items-center space-x-3 animate-pulse">
      <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
      <div className="flex-1">
        <p className="text-blue-300 font-medium">Rate limit detected</p>
        <p className="text-blue-200/80 text-sm">
          Retrying request... (Attempt {retryCount}/{MAX_RETRIES})
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Retry banner */}
      {retryBanner}

      {/* ✅ Page-level Permission Badge (Phase 4) */}
      <div className="glass-morphism-card p-4 rounded-xl border border-purple-500/30">
        <div className="flex items-center space-x-3">
          <PermissionBadge
            permission="pages_read_user_content"
            status="granted"
            size="lg"
            showIcon={true}
          />
          <div className="flex-1">
            <p className="text-gray-400 text-sm">
              Read visitor posts and brand mentions on your Instagram Business account
            </p>
          </div>
        </div>
      </div>

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

      {/* ✅ LAZY LOADED: Permission Request Modal */}
      <Suspense fallback={null}>
        {selectedPost && (
          <PermissionRequestModal
            isOpen={selectedPost !== null}
            post={selectedPost}
            onClose={() => setSelectedPost(null)}
            onSubmit={handleRequestPermission}
          />
        )}
      </Suspense>

      {/* ✅ LAZY LOADED: Repost Confirmation Modal */}
      <Suspense fallback={null}>
        {repostPost && (
          <RepostConfirmationModal
            isOpen={repostPost !== null}
            post={repostPost}
            onConfirm={handleRepostConfirm}
            onCancel={() => setRepostPost(null)}
            isLoading={isReposting}
          />
        )}
      </Suspense>
    </div>
  );
};

export default UGCManagement;
