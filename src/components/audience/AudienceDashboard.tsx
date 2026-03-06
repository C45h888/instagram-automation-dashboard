/**
 * AudienceDashboard.tsx
 *
 * Main container for Audience Insights page.
 * Follows project glass-morphism aesthetic.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Users, TrendingUp, Activity, Eye } from 'lucide-react';
import AudienceMetricCard from './AudienceMetricCard';
import FollowerGrowthChart from './FollowerGrowthChart';
import DemographicsPlaceholder from './DemographicsPlaceholder';
import { useInstagramAccount } from '../../hooks/useInstagramAccount';
import { useRealtimeAnalytics } from '../../hooks/realtimedata';

const AudienceDashboard: React.FC = () => {
  const { accounts, isLoading: accountsLoading, error: accountsError } = useInstagramAccount();
  const primaryAccount = accounts[0];
  
  const { 
    summary, 
    analytics, 
    loading: analyticsLoading
  } = useRealtimeAnalytics(primaryAccount?.id || null);

  const isLoading = accountsLoading || analyticsLoading;

  // Format follower count
  const formatFollowers = (count: number | null | undefined): string => {
    if (count === null || count === undefined) return '0';
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toLocaleString();
  };

  // Format percentage
  const formatPercent = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '0%';
    return `${(value * 100).toFixed(1)}%`;
  };

  // Transform analytics data for chart
  const chartData = React.useMemo(() => {
    if (!analytics || analytics.length === 0) return [];
    return analytics
      .map(day => ({
        date: day.date,
        followers: day.followers_count,
        engagement: day.engagement_rate ? day.engagement_rate * 100 : null,
        impressions: day.total_impressions,
        reach: day.total_reach,
      }))
      .reverse();
  }, [analytics]);

  // Get current values from account or summary
  const currentFollowers = primaryAccount?.followers_count ?? summary?.totalFollowers ?? 0;
  const growthRate = summary?.growthRate ?? null;
  const engagementRate = summary?.avgEngagement ?? null;
  const totalReach = summary?.totalReach ?? 0;

  if (accountsError) {
    return (
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="glass-morphism-card p-6 rounded-2xl border-2 border-red-500/50 bg-red-900/20">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="bg-red-500/20 p-3 rounded-full">
                  <Activity className="w-6 h-6 text-red-400" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-red-400 mb-2">
                  Error Loading Audience Data
                </h3>
                <p className="text-gray-300">{accountsError}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div 
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
              Audience Insights
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Real-time follower analytics and growth metrics
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 glass-morphism-card rounded-full">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
              <span className="text-gray-300 text-xs font-medium">Live</span>
            </div>
            {primaryAccount && (
              <div className="px-3 py-1.5 glass-morphism-card rounded-full">
                <span className="text-blue-400 text-xs font-medium">
                  @{primaryAccount.username}
                </span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Key Metrics Grid */}
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <AudienceMetricCard
            label="Total Followers"
            value={formatFollowers(currentFollowers)}
            change={growthRate}
            changeLabel="vs last period"
            icon={<Users className="w-5 h-5" />}
            isLoading={isLoading}
            color="blue"
          />
          <AudienceMetricCard
            label="Growth Rate"
            value={growthRate !== null ? `${growthRate > 0 ? '+' : ''}${growthRate.toFixed(1)}%` : 'N/A'}
            change={growthRate}
            changeLabel="trend"
            icon={<TrendingUp className="w-5 h-5" />}
            isLoading={isLoading}
            color="green"
          />
          <AudienceMetricCard
            label="Engagement Rate"
            value={formatPercent(engagementRate)}
            icon={<Activity className="w-5 h-5" />}
            isLoading={isLoading}
            color="purple"
          />
          <AudienceMetricCard
            label="Total Reach"
            value={formatFollowers(totalReach)}
            icon={<Eye className="w-5 h-5" />}
            isLoading={isLoading}
            color="yellow"
          />
        </motion.div>

        {/* Main Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <FollowerGrowthChart
            data={chartData}
            isLoading={isLoading}
            title="Follower Growth Trend"
          />
        </motion.div>

        {/* Demographics Section Header */}
        <motion.div 
          className="flex items-center gap-4 pt-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <div className="h-px flex-1 bg-white/10"></div>
          <span className="text-gray-400 text-sm font-medium uppercase tracking-wider">
            Audience Demographics
          </span>
          <div className="h-px flex-1 bg-white/10"></div>
        </motion.div>

        {/* Demographics Placeholders */}
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.4 }}
        >
          <DemographicsPlaceholder
            title="Gender Distribution"
            description="Male, female, and unknown follower breakdown with percentage splits"
            icon="gender"
            etaVersion="v2.0"
          />
          <DemographicsPlaceholder
            title="Age Demographics"
            description="Age group distribution from 13-17 through 65+ segments"
            icon="age"
            etaVersion="v2.0"
          />
          <DemographicsPlaceholder
            title="Top Locations"
            description="Geographic distribution of followers by country and city"
            icon="location"
            etaVersion="v2.0"
          />
        </motion.div>

        {/* Footer */}
        <motion.div 
          className="pt-6 border-t border-white/10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.5 }}
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-sm text-gray-400">
            <span>Data source: Instagram Graph API + Real-time analytics</span>
            <span>Last updated: {new Date().toLocaleString()}</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AudienceDashboard;
