// src/App.tsx - Optimized with Lazy Loading
import React, { lazy, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { startTokenRefreshInterval } from './services/tokenRefreshService';

// ==========================================
// EAGER IMPORTS (Critical - Always Needed)
// ==========================================

// Import Layout Components (always needed for protected routes)
import Layout from './components/layout/Layout';
import RequireAuth from './components/layout/RequireAuth';

// Keep Login eager - it's the entry point for unauthenticated users
import Login from './pages/Login';
import FacebookCallback from './pages/FacebookCallback';

// ==========================================
// LAZY IMPORTS (Load on-demand)
// ==========================================

// Dashboard and main pages - loaded when user navigates to them
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Analytics = lazy(() => import('./pages/Analytics'));
const ContentManagement = lazy(() => import('./pages/ContentManagement'));
const Settings = lazy(() => import('./pages/Settings'));
const EngagementMonitor = lazy(() => import('./pages/EngagementMonitor'));

// Permission Demo Pages - Meta App Review (Phase 3)
const CommentManagement = lazy(() => import('./pages/CommentManagement'));
const ContentAnalytics = lazy(() => import('./pages/ContentAnalytics'));
const DMInbox = lazy(() => import('./pages/DMInbox'));
const UGCManagement = lazy(() => import('./pages/UGCManagement'));

// Admin pages - only loaded when admin navigates to them
const AdminLogin = lazy(() => import('./pages/AdminLogin'));

// Legal pages - loaded when accessed (rare, so perfect for lazy loading)
const PrivacyPolicy = lazy(() => import('./pages/privacypolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const DataDeletion = lazy(() => import('./pages/DataDeletion'));
const PrivacyDashboard = lazy(() => import('./pages/PrivacyDashboard'));
const TestConnection = lazy(() => import('./pages/TestConnection'));

// ==========================================
// INLINE COMPONENTS (Placeholder Pages)
// ==========================================
// These are small and stay inline - no need for lazy loading

const Engagement: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="glass-morphism-card p-6 rounded-2xl">
        <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">💬 Engagement Hub</h1>
        <p className="text-gray-300 text-lg">Monitor and respond to comments and messages</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          onClick={() => navigate('/engagement/comments')}
          className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 cursor-pointer hover:border-yellow-500/50 hover:bg-gray-800/70 transition-all"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Comments</h3>
            <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm">12 new</span>
          </div>
          <p className="text-gray-400">Click to manage Instagram comments →</p>
        </div>

        <div
          onClick={() => navigate('/engagement/messages')}
          className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 cursor-pointer hover:border-blue-500/50 hover:bg-gray-800/70 transition-all"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Direct Messages</h3>
            <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm">8 unread</span>
          </div>
          <p className="text-gray-400">Click to view DM inbox →</p>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Auto Responses</h3>
            <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">Active</span>
          </div>
          <p className="text-gray-400">N8N workflow integration active</p>
        </div>
      </div>
    </div>
  );
};

const Automations: React.FC = () => (
  <div className="space-y-8 animate-fade-in">
    <div className="glass-morphism-card p-6 rounded-2xl">
      <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">🤖 Automation Workflows</h1>
      <p className="text-gray-300 text-lg">Manage your N8N automation workflows</p>
    </div>
    
    <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
          <div>
            <h4 className="text-white font-medium">Analytics Pipeline</h4>
            <p className="text-gray-400 text-sm">Daily performance reports</p>
          </div>
          <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
        </div>
        
        <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
          <div>
            <h4 className="text-white font-medium">Engagement Monitor</h4>
            <p className="text-gray-400 text-sm">Auto-reply to comments</p>
          </div>
          <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
        </div>
        
        <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
          <div>
            <h4 className="text-white font-medium">Sales Attribution</h4>
            <p className="text-gray-400 text-sm">Track Instagram → Shopify</p>
          </div>
          <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
        </div>
        
        <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
          <div>
            <h4 className="text-white font-medium">UGC Collection</h4>
            <p className="text-gray-400 text-sm">Monitor brand mentions</p>
          </div>
          <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
        </div>
      </div>
      
      <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
        <p className="text-yellow-400 text-sm">
          ✅ Your N8N webhooks are active and receiving data. Full workflow management UI coming soon.
        </p>
      </div>
    </div>
  </div>
);

const CreatePost: React.FC = () => (
  <div className="space-y-8 animate-fade-in">
    <div className="glass-morphism-card p-6 rounded-2xl">
      <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">📝 Create New Post</h1>
      <p className="text-gray-300 text-lg">Design and schedule your Instagram content</p>
    </div>
    
    <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
      <div className="space-y-6">
        <div>
          <label className="block text-white font-medium mb-2">Post Type</label>
          <div className="flex gap-4">
            <button className="px-4 py-2 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-lg">
              Feed Post
            </button>
            <button className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600">
              Story
            </button>
            <button className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600">
              Reel
            </button>
          </div>
        </div>
        
        <div>
          <label className="block text-white font-medium mb-2">Caption</label>
          <textarea 
            className="w-full p-3 bg-gray-900/50 text-white border border-gray-600 rounded-lg focus:border-yellow-500/50 outline-none resize-none"
            rows={4}
            placeholder="Write your caption here..."
          />
        </div>
        
        <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <p className="text-blue-400 text-sm">
            ℹ️ Post creation requires Instagram API approval. Currently in review with Meta.
          </p>
        </div>
      </div>
    </div>
  </div>
);

const Campaigns: React.FC = () => (
  <div className="space-y-8 animate-fade-in">
    <div className="glass-morphism-card p-6 rounded-2xl">
      <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">🎯 Campaign Management</h1>
      <p className="text-gray-300 text-lg">Track and optimize your marketing campaigns</p>
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
        <h3 className="text-xl font-bold text-white mb-2">Summer Launch</h3>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Progress</span>
            <span className="text-white">75%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div className="bg-yellow-500 h-2 rounded-full" style={{ width: '75%' }}></div>
          </div>
        </div>
      </div>
      
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
        <h3 className="text-xl font-bold text-white mb-2">Black Friday</h3>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Progress</span>
            <span className="text-white">30%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div className="bg-blue-500 h-2 rounded-full" style={{ width: '30%' }}></div>
          </div>
        </div>
      </div>
      
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
        <h3 className="text-xl font-bold text-white mb-2">Holiday Special</h3>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Progress</span>
            <span className="text-white">10%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div className="bg-green-500 h-2 rounded-full" style={{ width: '10%' }}></div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const Audience: React.FC = () => (
  <div className="space-y-8 animate-fade-in">
    <div className="glass-morphism-card p-6 rounded-2xl">
      <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">👥 Audience Insights</h1>
      <p className="text-gray-300 text-lg">Understand your followers and their behavior</p>
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 text-center">
        <div className="text-3xl font-bold text-white mb-2">24.5K</div>
        <div className="text-gray-400">Total Followers</div>
        <div className="text-green-400 text-sm mt-2">+12.5% this month</div>
      </div>
      
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 text-center">
        <div className="text-3xl font-bold text-white mb-2">68%</div>
        <div className="text-gray-400">Female Audience</div>
        <div className="text-gray-500 text-sm mt-2">Primary demographic</div>
      </div>
      
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 text-center">
        <div className="text-3xl font-bold text-white mb-2">18-34</div>
        <div className="text-gray-400">Age Range</div>
        <div className="text-gray-500 text-sm mt-2">Most active group</div>
      </div>
      
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 text-center">
        <div className="text-3xl font-bold text-white mb-2">NYC</div>
        <div className="text-gray-400">Top Location</div>
        <div className="text-gray-500 text-sm mt-2">18% of audience</div>
      </div>
    </div>
  </div>
);

// ==========================================
// TOKEN REFRESH MANAGER
// ==========================================

/**
 * TokenRefreshManager - Initializes and manages background token refresh
 *
 * Responsibilities:
 * - Starts automatic token refresh interval on app mount
 * - Runs `refreshAllExpiringTokens()` immediately and every 24 hours
 * - Cleans up interval on app unmount to prevent memory leaks
 *
 * @security Backend handles actual token storage - frontend only triggers refresh
 * @see src/services/tokenRefreshService.ts for implementation details
 */
const TokenRefreshManager: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Start token refresh interval on mount
    console.log('🔄 Initializing token refresh service...');
    intervalRef.current = startTokenRefreshInterval();

    // Cleanup on unmount - prevents memory leaks and duplicate intervals
    return () => {
      if (intervalRef.current) {
        console.log('⏹️ Stopping token refresh service');
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  return <>{children}</>;
};

// ==========================================
// QUERY CLIENT CONFIGURATION
// ==========================================

// Query Client with optimized settings (compatible with React Query v5)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000,   // 10 minutes
    },
  },
});

// ==========================================
// LOADING COMPONENT
// ==========================================

// Loading component - shown while lazy components load
const PageLoader: React.FC = () => (
  <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-500 mb-4"></div>
      <div className="text-white text-xl">Loading...</div>
    </div>
  </div>
);

// ==========================================
// MAIN APP COMPONENT
// ==========================================

// Main App Component with Protected Routes
function App() {
  return (
    <TokenRefreshManager>
      <QueryClientProvider client={queryClient}>
        <Router>
        {/* 
          React.Suspense wraps ALL routes to handle lazy loading
          fallback={<PageLoader />} shows loading spinner while chunks download
        */}
        <React.Suspense fallback={<PageLoader />}>
          <Routes>
            {/* ==========================================
                PUBLIC LEGAL PAGES - NO AUTH REQUIRED
                These are lazy loaded since they're rarely accessed
                ========================================== */}
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms-of-service" element={<TermsOfService />} />
            <Route path="/data-deletion" element={<DataDeletion />} />
            
            {/* ==========================================
                PUBLIC AUTHENTICATION ROUTES
                Login is eager, AdminLogin and FacebookCallback are lazy/eager
                ========================================== */}
            <Route path="/login" element={<Login />} />
            <Route path="/auth/callback" element={<FacebookCallback />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            
            {/* ==========================================
                PROTECTED ROUTES - REQUIRE AUTHENTICATION
                All pages inside here are lazy loaded on-demand
                ========================================== */}
            <Route 
              path="/" 
              element={
                <RequireAuth>
                  <Layout />
                </RequireAuth>
              }
            >
              {/* Main Dashboard */}
              <Route index element={<Dashboard />} />
              <Route path="dashboard" element={<Navigate to="/" replace />} />
              
              {/* Privacy Dashboard (Protected) */}
              <Route path="dashboard/privacy-controls" element={<PrivacyDashboard />} />
              
              {/* Analytics */}
              <Route path="analytics" element={<Analytics />} />
              
              {/* Content Management */}
              <Route path="content" element={<ContentManagement />} />
              <Route path="content/create" element={<CreatePost />} />
              <Route path="content/analytics" element={<ContentAnalytics />} />

              {/* Engagement Hub */}
              <Route path="engagement" element={<Engagement />} />
              <Route path="engagement/comments" element={<CommentManagement />} />
              <Route path="engagement/messages" element={<DMInbox />} />
              <Route path="engagement-monitor" element={<EngagementMonitor />} />
              
              {/* Automations */}
              <Route path="automations" element={<Automations />} />
              
              {/* Settings */}
              <Route path="settings" element={<Settings />} />
              
              {/* Campaign Management */}
              <Route path="campaigns" element={<Campaigns />} />
              
              {/* Audience */}
              <Route path="audience" element={<Audience />} />

              {/* UGC Management */}
              <Route path="ugc" element={<UGCManagement />} />
            </Route>
            
            {/* ==========================================
                MISC ROUTES
                ========================================== */}
            <Route path="/test-connection" element={<TestConnection />} />
            
            {/* Catch all - redirect to login if not authenticated */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </React.Suspense>
        </Router>
      </QueryClientProvider>
    </TokenRefreshManager>
  );
}

export default App;