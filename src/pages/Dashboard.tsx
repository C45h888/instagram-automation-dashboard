// src/pages/Dashboard.tsx
// BUG-FREE + VIEWPORT OPTIMIZED VERSION + TOKEN VALIDATION
// Fixes TypeScript errors while maintaining spacing optimizations
// ✅ UPDATED: Added token validation with lazy validation strategy
// ✅ PHASE 5: Added LinkAccountModal integration for error handling
import React, { useState, useEffect } from 'react';
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
import { useRealtimeUpdates } from '../services/realtimeService';
import { InstagramProfileCard } from '../components/permissions/InstagramProfile';
import { useInstagramProfile } from '../hooks/useInstagramProfile';
// ✅ NEW: Token validation imports
import { useTokenValidation } from '../hooks/useTokenValidation';
import TokenExpiredBanner from '../components/dashboard/TokenExpiredBanner';
// ✅ PHASE 5: LinkAccountModal integration
import { LinkAccountModal } from '../components/modals';
import { useInstagramAccount } from '../hooks/useInstagramAccount';

// Real-time Test Panel Component
const RealtimeTestPanel: React.FC = () => {
  // BUG FIX: testConnection is used in the button's onClick, so it's not unused
  const { isConnected, events, triggerTest, testConnection } = useRealtimeUpdates();

  return (
    <div className="glass-morphism-card p-6 rounded-2xl border-2 border-blue-500/30">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-white flex items-center">
          🔥 Real-time Test Panel
          <span className={`ml-3 w-3 h-3 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></span>
        </h3>
        <span className="text-sm text-gray-400">
          {isConnected ? '✅ Connected' : '❌ Disconnected'}
        </span>
      </div>

      {/* BUG FIX: Removed 'connection' from triggerTest types - only 'response', 'metrics', 'alert' are valid */}
      {/* BUG FIX: Changed last button to use testConnection function directly, not triggerTest */}
      <div className="flex gap-4 mb-4">
        <button
          onClick={() => triggerTest('response')}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-all"
        >
          Test Response
        </button>
        <button
          onClick={() => triggerTest('metrics')}
          className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-all"
        >
          Test Metrics
        </button>
        <button
          onClick={() => triggerTest('alert')}
          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-all"
        >
          Test Alert
        </button>
        {/* 
          BUG FIX: Use testConnection directly (not triggerTest('connection'))
          testConnection is a separate async function that tests backend connectivity
          triggerTest only accepts: 'response' | 'metrics' | 'alert'
        */}
        <button
          onClick={testConnection}
          className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium transition-all"
        >
          Test Connection
        </button>
      </div>

      <div className="bg-gray-900/50 rounded-lg p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-semibold text-gray-300">Events Received: {events.length}</span>
          <span className="text-sm text-gray-400">Recent Events:</span>
        </div>
        <div className="space-y-2 max-h-32 overflow-y-auto">
          {events.length > 0 ? (
            events.slice(-5).reverse().map((event, index) => (
              <div key={index} className="text-xs bg-gray-800/50 p-2 rounded flex justify-between items-center">
                <span className="text-gray-300">{event.type}</span>
                <span className="text-gray-500">{new Date(event.timestamp).toLocaleTimeString()}</span>
              </div>
            ))
          ) : (
            <div className="text-center text-gray-500 text-sm py-4">
              No events yet. Try triggering a test!
            </div>
          )}
        </div>
      </div>

      <div className="text-xs text-gray-500 border-t border-gray-700 pt-2 mt-2">
        💡 This panel shows real-time events from your N8N workflow. Remove this component once testing is complete.
      </div>
    </div>
  );
};

const Dashboard: React.FC = () => {
  const { metrics, activities, recentMedia, chartData, isLoading } = useDashboardData();
  const { profile, isLoading: profileLoading, error: profileError } = useInstagramProfile();
  const toast = useToast();

  // ✅ NEW: Token validation - Lazy validation on dashboard load
  const { isExpired, expirationDetails } = useTokenValidation();

  // ✅ PHASE 5: LinkAccountModal integration - Use isLoading for dynamic retry state
  const { error: accountError, refetch: refetchAccount, isLoading: isAccountLoading } = useInstagramAccount();
  const [showLinkModal, setShowLinkModal] = useState(false);

  // Show modal when no Instagram accounts are connected
  useEffect(() => {
    if (accountError && accountError.includes('No Instagram accounts')) {
      setShowLinkModal(true);
    }
  }, [accountError]);

  // ✅ NEW: Handle reconnect button click - Redirect to OAuth flow
  const handleReconnect = () => {
    console.log('🔄 Redirecting to Instagram OAuth flow...');
    // Get API base URL from environment
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://api.888intelligenceautomation.in';
    // Redirect to OAuth endpoint to get a new token
    window.location.href = `${apiBaseUrl}/api/auth/instagram`;
  };

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
    /*
      VIEWPORT OPTIMIZATION:
      Changed from: space-y-8 (32px gaps)
      Changed to: space-y-4 lg:space-y-6 (16px mobile, 24px desktop)
      Saves: 48-96px of vertical space with optimized section spacing
    */
    <div className="space-y-4 lg:space-y-6">

      {/* ✅ NEW: Token Expired Banner - Shows when Instagram token is invalid */}
      {/* This banner takes visual precedence but doesn't block the rest of the dashboard */}
      {isExpired && (
        <TokenExpiredBanner
          onReconnect={handleReconnect}
          expirationDetails={expirationDetails}
        />
      )}

      {/* ✅ PHASE 5: LinkAccountModal - Shows when no Instagram accounts are connected */}
      <LinkAccountModal
        isOpen={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        onRetry={() => {
          setShowLinkModal(false);
          refetchAccount();
        }}
        isRetrying={isAccountLoading}
      />

      {/* Real-time Test Panel - BUG-FREE VERSION */}
      <RealtimeTestPanel />

      {/* Dashboard Header - Welcome section with quick stats */}
      <AsyncWrapper
        loading={isLoading}
        error={null}
        data={metrics.length > 0 ? metrics : null}
        skeleton={DashboardHeaderSkeleton}
      >
        {() => <DashboardHeader />}
      </AsyncWrapper>

      {/* Instagram Profile Section */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
          Connected Instagram Account
          <span className="ml-2 text-sm font-normal text-gray-400">
            (Demonstrates instagram_basic permission)
          </span>
        </h2>

        <AsyncWrapper
          loading={profileLoading}
          error={profileError ? new Error(profileError) : null}
          data={profile}
          skeleton={() => (
            <div className="glass-morphism-card p-6 rounded-xl animate-pulse">
              <div className="h-32 bg-white/5 rounded-lg"></div>
            </div>
          )}
        >
          {(data) => <InstagramProfileCard account={data} />}
        </AsyncWrapper>
      </div>

      {/* Quick Actions - Gradient cards for main features */}
      <QuickActions />

      {/* Metrics Grid - Animated metric cards */}
      <AsyncWrapper
        loading={isLoading}
        error={null}
        data={metrics}
        skeleton={MetricsGridSkeleton}
      >
        {(data) => <AnimatedMetricsGrid metrics={data} />}
      </AsyncWrapper>

      {/* 
        Main Content Grid - Activity Feed + Performance Chart
        OPTIMIZATION: gap-8 → gap-4 lg:gap-6 (consistent spacing reduction)
      */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        
        {/* Activity Feed - 1/3 width on desktop */}
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
        
        {/* Performance Chart - 2/3 width on desktop */}
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

      {/* Recent Media - Bottom section with media grid */}
      <AsyncWrapper
        loading={isLoading}
        error={null}
        data={recentMedia}
        skeleton={() => (
          <div className="glass-morphism-card p-6 rounded-2xl">
            <h2 className="text-xl font-bold text-white mb-6">Recent Media</h2>
            <SkeletonMediaGrid count={6} />
          </div>
        )}
      >
        {(data) => <RecentMedia media={data} />}
      </AsyncWrapper>
    </div>
  );
};

export default Dashboard;

