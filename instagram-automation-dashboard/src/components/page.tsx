import React from 'react';
import { useAuthStore } from '../stores/authStore';
import MetricsGrid from './dashboard/MetricsGrid';
import ActivityFeed from './dashboard/ActivityFeed';
import QuickActions from './dashboard/QuickActions';

const Dashboard: React.FC = () => {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="glass-morphism-card p-6 rounded-2xl">
        <h1 className="text-3xl font-bold text-white mb-2">
          Welcome back, {user?.username || 'User'}!
        </h1>
        <p className="text-gray-300">
          Here's what's happening with your Instagram automation today.
        </p>
      </div>

      {/* Quick Actions */}
      <QuickActions />

      {/* Metrics Grid */}
      <MetricsGrid />

      {/* Activity Feed */}
      <ActivityFeed />
    </div>
  );
};

export default Dashboard;