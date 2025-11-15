// =====================================
// USE VISITOR POSTS HOOK
// Manages UGC data fetching, filtering, and mutations
// Follows useComments.ts pattern
// =====================================

import { useState, useEffect } from 'react';
import { usePermissionDemoStore } from '../stores/permissionDemoStore';
import PermissionDemoService from '../services/permissionDemoService';
import type { VisitorPost, UGCStats, UGCFilterState, PermissionRequestForm } from '../types/ugc';
import { DEFAULT_UGC_FILTERS } from '../types/ugc';

interface UseVisitorPostsResult {
  visitorPosts: VisitorPost[];
  stats: UGCStats | null;
  isLoading: boolean;
  error: string | null;
  filters: UGCFilterState;
  setFilters: (filters: UGCFilterState) => void;
  toggleFeatured: (postId: string, featured: boolean) => Promise<void>;
  requestPermission: (form: PermissionRequestForm) => Promise<void>;
  refetch: () => void;
}

export const useVisitorPosts = (): UseVisitorPostsResult => {
  const { demoMode } = usePermissionDemoStore();
  const [visitorPosts, setVisitorPosts] = useState<VisitorPost[]>([]);
  const [stats, setStats] = useState<UGCStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<UGCFilterState>(DEFAULT_UGC_FILTERS);

  const fetchVisitorPosts = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (demoMode) {
        // Use demo data generator
        await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate API delay
        const demoData = PermissionDemoService.generateUGCDemoData();
        setVisitorPosts(demoData.data);
        setStats(demoData.stats);
      } else {
        // Fetch real data from backend API
        // TODO: Implement real data fetching from /api/instagram/visitor-posts
        // const response = await fetch('/api/instagram/visitor-posts?businessAccountId=...', {
        //   headers: {
        //     'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        //   }
        // });
        // const result = await response.json();
        // if (result.success) {
        //   setVisitorPosts(result.data);
        //   setStats(result.stats);
        // }

        // For now, fallback to demo data
        const demoData = PermissionDemoService.generateUGCDemoData();
        setVisitorPosts(demoData.data);
        setStats(demoData.stats);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch visitor posts');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFeatured = async (postId: string, featured: boolean): Promise<void> => {
    try {
      if (demoMode) {
        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Update post in local state
        setVisitorPosts((prevPosts) =>
          prevPosts.map((post) =>
            post.id === postId
              ? {
                  ...post,
                  featured,
                  featured_at: featured ? new Date().toISOString() : null,
                  updated_at: new Date().toISOString()
                }
              : post
          )
        );

        // Update stats if needed
        if (stats) {
          setStats({
            ...stats,
            featuredCount: featured
              ? stats.featuredCount + 1
              : Math.max(0, stats.featuredCount - 1)
          });
        }
      } else {
        // Send real request to backend
        // TODO: Implement real feature toggle
        // const response = await fetch(`/api/instagram/ugc/${postId}/feature`, {
        //   method: 'PATCH',
        //   headers: {
        //     'Content-Type': 'application/json',
        //     'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        //   },
        //   body: JSON.stringify({ featured })
        // });
        // const result = await response.json();
        // if (!result.success) {
        //   throw new Error(result.error || 'Failed to update featured status');
        // }

        // For now, simulate success
        await new Promise((resolve) => setTimeout(resolve, 300));
        setVisitorPosts((prevPosts) =>
          prevPosts.map((post) =>
            post.id === postId
              ? {
                  ...post,
                  featured,
                  featured_at: featured ? new Date().toISOString() : null,
                  updated_at: new Date().toISOString()
                }
              : post
          )
        );
      }
    } catch (err: any) {
      throw new Error(err.message || 'Failed to update featured status');
    }
  };

  const requestPermission = async (form: PermissionRequestForm): Promise<void> => {
    try {
      // Validate form
      if (!form.requestMessage.trim()) {
        throw new Error('Request message cannot be empty');
      }

      if (demoMode) {
        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Update post in local state to show permission was requested
        setVisitorPosts((prevPosts) =>
          prevPosts.map((post) =>
            post.id === form.ugcContentId
              ? {
                  ...post,
                  repost_permission_requested: true,
                  updated_at: new Date().toISOString()
                }
              : post
          )
        );

        // Update stats if needed
        if (stats) {
          setStats({
            ...stats,
            permissionsPending: stats.permissionsPending + 1
          });
        }
      } else {
        // Send real permission request to backend
        // TODO: Implement real permission request
        // const response = await fetch('/api/instagram/ugc/request-permission', {
        //   method: 'POST',
        //   headers: {
        //     'Content-Type': 'application/json',
        //     'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        //   },
        //   body: JSON.stringify(form)
        // });
        // const result = await response.json();
        // if (!result.success) {
        //   throw new Error(result.error || 'Failed to request permission');
        // }

        // For now, simulate success
        await new Promise((resolve) => setTimeout(resolve, 500));
        setVisitorPosts((prevPosts) =>
          prevPosts.map((post) =>
            post.id === form.ugcContentId
              ? {
                  ...post,
                  repost_permission_requested: true,
                  updated_at: new Date().toISOString()
                }
              : post
          )
        );
      }
    } catch (err: any) {
      throw new Error(err.message || 'Failed to request permission');
    }
  };

  useEffect(() => {
    fetchVisitorPosts();
  }, [demoMode]);

  return {
    visitorPosts,
    stats,
    isLoading,
    error,
    filters,
    setFilters,
    toggleFeatured,
    requestPermission,
    refetch: fetchVisitorPosts
  };
};

export default useVisitorPosts;
