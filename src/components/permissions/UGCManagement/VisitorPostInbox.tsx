// =====================================
// VISITOR POST INBOX COMPONENT
// Main container for UGC management
// Evidence: Follows CommentInbox.tsx pattern - comprehensive component
// =====================================

import React, { useMemo } from 'react';
import { Search, Filter, X, TrendingUp, MessageSquare, Star } from 'lucide-react';
import { VisitorPostCard } from './VisitorPostCard';
import { FeatureHighlight } from '../shared/FeatureHighlight';
import type { VisitorPost, UGCFilterState, UGCStats } from '../../../types/ugc';

interface VisitorPostInboxProps {
  posts: VisitorPost[];
  stats: UGCStats | null;
  filters: UGCFilterState;
  onFiltersChange: (filters: UGCFilterState) => void;
  onFeatureToggle: (postId: string, featured: boolean) => void;
  onRequestPermission: (postId: string) => void;
  onRepost: (postId: string) => void;
  onAddNotes: (postId: string) => void;
}

export const VisitorPostInbox: React.FC<VisitorPostInboxProps> = ({
  posts,
  stats,
  filters,
  onFiltersChange,
  onFeatureToggle,
  onRequestPermission,
  onRepost,
  onAddNotes
}) => {
  // EVIDENCE: Client-side filtering (same as CommentInbox)
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      if (filters.sentiment !== 'all' && post.sentiment !== filters.sentiment) return false;
      if (filters.priority !== 'all' && post.priority !== filters.priority) return false;
      if (filters.mediaType !== 'all' && post.media_type !== filters.mediaType) return false;

      if (filters.featured === 'featured' && !post.featured) return false;
      if (filters.featured === 'not_featured' && post.featured) return false;

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        return (
          post.message?.toLowerCase().includes(searchLower) ||
          post.author_username?.toLowerCase().includes(searchLower) ||
          post.author_name?.toLowerCase().includes(searchLower)
        );
      }

      return true;
    });
  }, [posts, filters]);

  const hasActiveFilters =
    filters.sentiment !== 'all' ||
    filters.priority !== 'all' ||
    filters.featured !== 'all' ||
    filters.mediaType !== 'all' ||
    filters.search !== '';

  const clearFilters = () => {
    onFiltersChange({
      sentiment: 'all',
      priority: 'all',
      featured: 'all',
      mediaType: 'all',
      search: ''
    });
  };

  return (
    <div className="space-y-6">
      {/* ✅ PHASE 4: Duplicate badge removed - now at page level in UGCManagement.tsx */}

      {/* Feature Highlights */}
      <FeatureHighlight
        features={[
          {
            icon: MessageSquare,
            title: "Monitor Brand Mentions",
            description: "Track when customers tag or mention your brand",
            color: "purple"
          },
          {
            icon: TrendingUp,
            title: "Sentiment Analysis",
            description: "AI-powered analysis of customer feedback",
            color: "blue"
          },
          {
            icon: Star,
            title: "Feature Testimonials",
            description: "Curate top customer content for marketing",
            color: "yellow"
          }
        ]}
        columns={3}
      />

      {/* Stats Overview - EVIDENCE: Calculated in component */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-morphism-card p-4 rounded-xl">
            <p className="text-3xl font-bold text-white">{stats.totalPosts}</p>
            <p className="text-gray-400 text-sm">Total Posts</p>
          </div>
          <div className="glass-morphism-card p-4 rounded-xl">
            <p className="text-3xl font-bold text-white">{stats.postsThisWeek}</p>
            <p className="text-gray-400 text-sm">This Week</p>
          </div>
          <div className="glass-morphism-card p-4 rounded-xl">
            <p className="text-3xl font-bold text-white">{stats.featuredCount}</p>
            <p className="text-gray-400 text-sm">Featured</p>
          </div>
          <div className="glass-morphism-card p-4 rounded-xl">
            <p className="text-3xl font-bold text-white">
              {Math.round((stats.sentimentBreakdown.positive / stats.totalPosts) * 100)}%
            </p>
            <p className="text-gray-400 text-sm">Positive</p>
          </div>
        </div>
      )}

      {/* Filters - EVIDENCE: Integrated in Inbox component */}
      <div className="glass-morphism-card p-4 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-purple-400" />
            <h3 className="text-white font-semibold">Filters</h3>
            <span className="text-xs text-gray-400">
              ({filteredPosts.length} of {posts.length} posts)
            </span>
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-gray-400 hover:text-white transition-colors flex items-center space-x-1"
            >
              <X className="w-3 h-3" />
              <span>Clear All</span>
            </button>
          )}
        </div>

        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search posts..."
              value={filters.search}
              onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
              className="w-full pl-10 pr-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Sentiment Filter */}
          <select
            value={filters.sentiment}
            onChange={(e) => onFiltersChange({ ...filters, sentiment: e.target.value as any })}
            className="px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">All Sentiment</option>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
          </select>

          {/* Priority Filter */}
          <select
            value={filters.priority}
            onChange={(e) => onFiltersChange({ ...filters, priority: e.target.value as any })}
            className="px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">All Priority</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Featured Filter */}
          <select
            value={filters.featured}
            onChange={(e) => onFiltersChange({ ...filters, featured: e.target.value as any })}
            className="px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">All Posts</option>
            <option value="featured">Featured</option>
            <option value="not_featured">Not Featured</option>
          </select>

          {/* Media Type Filter */}
          <select
            value={filters.mediaType}
            onChange={(e) => onFiltersChange({ ...filters, mediaType: e.target.value as any })}
            className="px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">All Media</option>
            <option value="IMAGE">Images</option>
            <option value="VIDEO">Videos</option>
            <option value="CAROUSEL_ALBUM">Carousels</option>
            <option value="TEXT">Text Only</option>
          </select>
        </div>
      </div>

      {/* Posts Grid */}
      {filteredPosts.length === 0 ? (
        <div className="glass-morphism-card p-12 rounded-xl text-center">
          <MessageSquare className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Posts Found</h3>
          <p className="text-gray-400 mb-4">
            {hasActiveFilters
              ? 'Try adjusting your filters to see more posts.'
              : 'Visitor posts will appear here when customers mention your brand.'}
          </p>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPosts.map((post) => (
            <VisitorPostCard
              key={post.id}
              post={post}
              onFeatureToggle={onFeatureToggle}
              onRequestPermission={onRequestPermission}
              onRepost={onRepost}
              onAddNotes={onAddNotes}
            />
          ))}
        </div>
      )}
    </div>
  );
};
