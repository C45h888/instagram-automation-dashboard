import React from 'react';
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

// ADD THIS IMPORT
import { useRealtimeUpdates } from '../services/realtimeService';

// ADD THIS TEST COMPONENT
const RealtimeTestPanel: React.FC = () => {
  const { isConnected, events, triggerTest, testConnection } = useRealtimeUpdates();

  return (
    <div className="glass-morphism-card p-6 rounded-2xl mb-6 border-2 border-blue-500/30">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-white flex items-center">
          🔥 Real-time Test Panel
          <span className={`ml-3 w-3 h-3 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></span>
        </h3>
        <span className="text-sm text-gray-400">
          {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-gray-300 mb-2">Events Received: <span className="text-white font-bold">{events.length}</span></p>
          <div className="flex gap-2 flex-wrap">
            <button 
              onClick={() => triggerTest('response')}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
            >
              Test Response
            </button>
            <button 
              onClick={() => triggerTest('metrics')}
              className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors"
            >
              Test Metrics
            </button>
            <button 
              onClick={() => triggerTest('alert')}
              className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors"
            >
              Test Alert
            </button>
            <button 
              onClick={testConnection}
              className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors"
            >
              Test Connection
            </button>
          </div>
        </div>

        <div>
          <p className="text-gray-300 mb-2">Recent Events:</p>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {events.slice(0, 3).map((event, i) => (
              <div key={i} className="text-xs bg-gray-700/50 p-2 rounded border-l-2 border-blue-400">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-blue-300">{event.type}</span>
                  <span className="text-gray-400">{new Date(event.timestamp).toLocaleTimeString()}</span>
                </div>
                {event.data?.message_id && (
                  <div className="text-gray-300 mt-1">ID: {event.data.message_id}</div>
                )}
              </div>
            ))}
            {events.length === 0 && (
              <div className="text-gray-400 text-sm italic">No events yet. Try triggering a test!</div>
            )}
          </div>
        </div>
      </div>

      <div className="text-xs text-gray-500 border-t border-gray-700 pt-2">
        💡 This panel shows real-time events from your N8N workflow. Remove this component once testing is complete.
      </div>
    </div>
  );
};

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
      {/* ADD THIS TEST PANEL AT THE TOP */}
      <RealtimeTestPanel />

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