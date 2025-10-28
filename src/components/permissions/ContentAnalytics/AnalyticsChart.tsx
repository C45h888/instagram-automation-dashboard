// =====================================
// ANALYTICS CHART COMPONENT
// Displays engagement metrics summary
// Shows performance tier distribution
// =====================================

import React from 'react';
import { TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import type { MediaData } from '../../../types/permissions';

interface AnalyticsChartProps {
  media: MediaData[];
  className?: string;
}

export const AnalyticsChart: React.FC<AnalyticsChartProps> = ({ media, className = '' }) => {
  // Calculate analytics
  const totalPosts = media.length;
  const totalLikes = media.reduce((sum, m) => sum + (m.like_count || 0), 0);
  const totalComments = media.reduce((sum, m) => sum + (m.comments_count || 0), 0);
  const totalReach = media.reduce((sum, m) => sum + (m.reach || 0), 0);
  const avgEngagementRate =
    media.length > 0 ? media.reduce((sum, m) => sum + m.engagement_rate, 0) / media.length : 0;

  // Performance tier distribution
  const tierCounts = {
    viral: media.filter((m) => m.performance_tier === 'viral').length,
    high: media.filter((m) => m.performance_tier === 'high').length,
    average: media.filter((m) => m.performance_tier === 'average').length,
    low: media.filter((m) => m.performance_tier === 'low').length
  };

  const tierPercentages = {
    viral: totalPosts > 0 ? (tierCounts.viral / totalPosts) * 100 : 0,
    high: totalPosts > 0 ? (tierCounts.high / totalPosts) * 100 : 0,
    average: totalPosts > 0 ? (tierCounts.average / totalPosts) * 100 : 0,
    low: totalPosts > 0 ? (tierCounts.low / totalPosts) * 100 : 0
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <div className={`glass-morphism-card p-6 rounded-xl border border-gray-700 ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-xl font-bold text-white mb-2">Content Performance Analytics</h3>
        <p className="text-gray-400 text-sm">Overview of your content engagement metrics</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/30"
        >
          <p className="text-gray-400 text-xs mb-1">Total Posts</p>
          <p className="text-white text-2xl font-bold">{totalPosts}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-4 bg-red-500/10 rounded-lg border border-red-500/30"
        >
          <p className="text-gray-400 text-xs mb-1">Total Likes</p>
          <p className="text-white text-2xl font-bold">{formatNumber(totalLikes)}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30"
        >
          <p className="text-gray-400 text-xs mb-1">Total Comments</p>
          <p className="text-white text-2xl font-bold">{formatNumber(totalComments)}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="p-4 bg-green-500/10 rounded-lg border border-green-500/30"
        >
          <p className="text-gray-400 text-xs mb-1">Total Reach</p>
          <p className="text-white text-2xl font-bold">{formatNumber(totalReach)}</p>
        </motion.div>
      </div>

      {/* Engagement Rate */}
      <div className="mb-6 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <p className="text-gray-400 text-sm">Average Engagement Rate</p>
          <div className="flex items-center space-x-1 text-green-400">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm font-medium">+2.3%</span>
          </div>
        </div>
        <p className="text-white text-3xl font-bold">{avgEngagementRate.toFixed(2)}%</p>
        <p className="text-gray-500 text-xs mt-1">
          {avgEngagementRate > 5 ? 'Excellent performance' : avgEngagementRate > 3 ? 'Good performance' : 'Room for improvement'}
        </p>
      </div>

      {/* Performance Tier Distribution */}
      <div>
        <h4 className="text-white font-semibold mb-3">Performance Distribution</h4>
        <div className="space-y-3">
          {/* Viral */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-purple-300 text-sm font-medium">Viral</span>
              <span className="text-gray-400 text-xs">
                {tierCounts.viral} posts ({tierPercentages.viral.toFixed(0)}%)
              </span>
            </div>
            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${tierPercentages.viral}%` }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="h-full bg-purple-500"
              />
            </div>
          </div>

          {/* High */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-green-300 text-sm font-medium">High</span>
              <span className="text-gray-400 text-xs">
                {tierCounts.high} posts ({tierPercentages.high.toFixed(0)}%)
              </span>
            </div>
            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${tierPercentages.high}%` }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="h-full bg-green-500"
              />
            </div>
          </div>

          {/* Average */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-blue-300 text-sm font-medium">Average</span>
              <span className="text-gray-400 text-xs">
                {tierCounts.average} posts ({tierPercentages.average.toFixed(0)}%)
              </span>
            </div>
            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${tierPercentages.average}%` }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="h-full bg-blue-500"
              />
            </div>
          </div>

          {/* Low */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-gray-300 text-sm font-medium">Low</span>
              <span className="text-gray-400 text-xs">
                {tierCounts.low} posts ({tierPercentages.low.toFixed(0)}%)
              </span>
            </div>
            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${tierPercentages.low}%` }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="h-full bg-gray-500"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsChart;
