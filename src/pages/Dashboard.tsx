import React from 'react';
import { useAuthStore } from '../stores/authStore';
import { useDashboardData } from '../hooks/useDashboardData';
import DashboardHeader from '../components/dashboard/DashboardHeader';
import DashboardHeaderSkeleton from '../components/dashboard/DashboardHeaderSkeleton';
import AnimatedMetricsGrid from '../components/dashboard/AnimatedMetricsGrid';
import MetricsGridSkeleton from '../components/dashboard/MetricsGridSkeleton';
import AnimatedActivityFeed from '../components/dashboard/AnimatedActivityFeed';
import SkeletonFeed from '../components/ui/SkeletonFeed';
import QuickActions from '../components/dashboard/QuickActions';
import RecentMedia from '../components/dashboard/RecentMedia';
import SkeletonMediaGrid from '../components/ui/SkeletonMediaGrid';
import PerformanceChart from '../components/dashboard/PerformanceChart';
import AsyncWrapper from '../components/ui/AsyncWrapper';
import { useToast } from '../hooks/useToast';

const Dashboard: React.FC = () => {
  const { metrics, activities, recentMedia, chartData, isLoading } = useDashboardData();
  const toast = useToast();

  const handleActivityClick = (activity: any) => {
    toast.info(`Viewing details for: ${activity.title}`, {
      title: 'Activity Details',
      action: {
        label: 'Close',
        onClick: () => {}
      }
    });
  };

  return (
    <div className="space-y-8">
      {/* Dashboard Header */}
      <AsyncWrapper
        loading={isLoading}
        error={null}
        data={metrics.length > 0 ? metrics : null}
        skeleton={DashboardHeaderSkeleton}
      >
        {() => <DashboardHeader />}
      </AsyncWrapper>

      {/* Quick Actions */}
      <QuickActions />

      {/* Metrics Grid */}
      <AsyncWrapper
        loading={isLoading}
        error={null}
        data={metrics}
        skeleton={MetricsGridSkeleton}
      >
        {(data) => <AnimatedMetricsGrid metrics={data} />}
      </AsyncWrapper>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Activity Feed */}
        <div className="lg:col-span-1">
          <AsyncWrapper
            loading={isLoading}
            error={null}
            data={activities}
            skeleton={() => (
              <div className="glass-morphism-card p-6 rounded-2xl">
                <h2 className="text-xl font-bold text-white mb-6">Recent Activity</h2>
                <SkeletonFeed itemCount={5} />
              </div>
            )}
          >
            {(data) => (
              <AnimatedActivityFeed 
                activities={data} 
                onActivityClick={handleActivityClick}
              />
            )}
          </AsyncWrapper>
        </div>
        
        {/* Performance Chart */}
        <div className="lg:col-span-2">
          <AsyncWrapper
            loading={isLoading}
            error={null}
            data={chartData}
            skeleton={() => (
              <div className="glass-morphism-card p-6 rounded-2xl">
                <h2 className="text-xl font-bold text-white mb-6">Performance Overview</h2>
                <div className="h-80 bg-white/5 rounded-lg animate-pulse"></div>
              </div>
            )}
          >
            {(data) => <PerformanceChart data={data} />}
          </AsyncWrapper>
        </div>
      </div>

      {/* Recent Media */}
      <AsyncWrapper
        loading={isLoading}
        error={null}
        data={recentMedia}
        skeleton={() => (
          <div className="glass-morphism-card p-6 rounded-2xl">
            <h2 className="text-xl font-bold text-white mb-6">Recent Media</h2>
            <SkeletonMediaGrid itemCount={6} />
          </div>
        )}
      >
        {(data) => <RecentMedia media={data} />}
      </AsyncWrapper>
    </div>
  );
};

export default Dashboard;