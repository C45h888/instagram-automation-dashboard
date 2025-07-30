import React from 'react';
import { useAuthStore } from '../stores/authStore';
import { useDashboardData } from '../hooks/useDashboardData';
import DashboardHeader from '../components/dashboard/DashboardHeader';
import MetricsGrid from '../components/dashboard/MetricsGrid';
import ActivityFeed from '../components/dashboard/ActivityFeed';
import QuickActions from '../components/dashboard/QuickActions';
import RecentMedia from '../components/dashboard/RecentMedia';
import PerformanceChart from '../components/dashboard/PerformanceChart';

const Dashboard: React.FC = () => {
  const { metrics, activities, recentMedia, chartData, isLoading } = useDashboardData();

  return (
    <div className="space-y-8">
      {/* Dashboard Header */}
      <DashboardHeader />

      {/* Quick Actions */}
      <QuickActions />

      {/* Metrics Grid */}
      <MetricsGrid metrics={metrics} isLoading={isLoading} />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Activity Feed */}
        <div className="lg:col-span-1">
          <ActivityFeed activities={activities} isLoading={isLoading} />
        </div>
        
        {/* Performance Chart */}
        <div className="lg:col-span-2">
          <PerformanceChart data={chartData} isLoading={isLoading} />
        </div>
      </div>

      {/* Recent Media */}
      <RecentMedia media={recentMedia} isLoading={isLoading} />
    </div>
  );
};

export default Dashboard;