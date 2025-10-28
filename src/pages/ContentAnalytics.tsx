// =====================================
// CONTENT ANALYTICS PAGE
// Full page for Instagram content analytics
// Demonstrates instagram_content_publish permission
// =====================================

import React from 'react';
import { useContentAnalytics } from '../hooks/useContentAnalytics';
import { ContentGrid, AnalyticsChart } from '../components/permissions/ContentAnalytics';
import { DemoModeToggle } from '../components/permissions/shared/DemoModeToggle';
import { PermissionBadge } from '../components/permissions/shared/PermissionBadge';
import { FeatureHighlight } from '../components/permissions/shared/FeatureHighlight';
import AsyncWrapper from '../components/ui/AsyncWrapper';
import { BarChart3, TrendingUp, Target, Zap } from 'lucide-react';
import type { MediaData } from '../types/permissions';

const ContentAnalytics: React.FC = () => {
  const { media, analytics, isLoading, error } = useContentAnalytics();

  const handleMediaClick = (mediaItem: MediaData) => {
    // Could open a modal with detailed view
    console.log('Media clicked:', mediaItem);
  };

  return (
    <div className="space-y-6">
      {/* Demo Mode Toggle */}
      <DemoModeToggle />

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <BarChart3 className="w-8 h-8 text-green-400" />
            <div>
              <h1 className="text-3xl font-bold text-white">Content Analytics</h1>
              <p className="text-gray-400 text-sm">Track performance of your published content</p>
            </div>
          </div>
          <PermissionBadge permission="instagram_content_publish" status="granted" size="lg" />
        </div>

        {/* Feature Highlights */}
        <FeatureHighlight
          features={[
            {
              icon: BarChart3,
              title: 'Engagement Metrics',
              description: 'Track likes, comments, shares, and reach',
              color: 'green'
            },
            {
              icon: TrendingUp,
              title: 'Performance Tiers',
              description: 'Automatic classification of viral, high, average, low',
              color: 'purple'
            },
            {
              icon: Target,
              title: 'Optimal Timing',
              description: 'Identify best times to post for maximum engagement',
              color: 'blue'
            },
            {
              icon: Zap,
              title: 'Real-time Insights',
              description: 'Live analytics updated as content performs',
              color: 'yellow'
            }
          ]}
          columns={4}
          className="mb-6"
        />
      </div>

      {/* Analytics Chart */}
      <AsyncWrapper
        loading={isLoading}
        error={error ? new Error(error) : null}
        data={media}
        skeleton={() => (
          <div className="glass-morphism-card p-6 rounded-xl animate-pulse">
            <div className="h-64 bg-white/5 rounded-lg"></div>
          </div>
        )}
      >
        {(data) => <AnalyticsChart media={data} />}
      </AsyncWrapper>

      {/* Content Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-white">Published Content</h2>
          <span className="text-sm text-gray-400">{analytics.totalPosts} posts</span>
        </div>

        <AsyncWrapper
          loading={isLoading}
          error={error ? new Error(error) : null}
          data={media}
          skeleton={() => (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
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
          )}
        >
          {(data) => (
            <ContentGrid
              media={data}
              onMediaClick={handleMediaClick}
              emptyMessage="No content published yet"
            />
          )}
        </AsyncWrapper>
      </div>

      {/* Meta Review Note */}
      <div className="mt-8 p-4 bg-green-500/10 rounded-xl border border-green-500/30">
        <p className="text-xs text-green-300 text-center">
          ✓ Demonstrates <span className="font-mono font-bold">instagram_content_publish</span>{' '}
          permission: Create media, publish content, and access insights
        </p>
      </div>
    </div>
  );
};

export default ContentAnalytics;
