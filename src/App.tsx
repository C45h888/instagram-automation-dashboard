import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import RequireAuth from './components/layout/RequireAuth';
import Layout from './components/layout/Layout';
import { ToastProvider } from './contexts/ToastContext';
import { ModalProvider } from './contexts/ModalContext';
import ToastContainer from './components/ui/ToastContainer';
import { RouteAnimationProvider } from './components/transitions/RouteAnimationProvider';
import PageTransition from './components/transitions/PageTransition';
import RealtimeTest from './components/test/RealtimeTest';
import { useRealtimeUpdates } from './services/realtimeService';

// Add this component inside your JSX (temporarily)
const QuickTest = () => {
  const { isConnected, events, triggerTest } = useRealtimeUpdates();
  
  return (
    <div style={{ padding: '20px', background: '#333', color: 'white', margin: '20px', borderRadius: '8px' }}>
      <h3>🔥 Real-time Test</h3>
      <p>Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}</p>
      <p>Events: {events.length}</p>
      
      <button 
        onClick={() => triggerTest('response')} 
        style={{ padding: '8px 16px', margin: '5px', background: '#0066cc', color: 'white', border: 'none', borderRadius: '4px' }}
      >
        Test Response
      </button>
      
      {events.slice(0, 2).map((event, i) => (
        <div key={i} style={{ fontSize: '12px', margin: '5px 0', padding: '8px', background: '#555', borderRadius: '4px' }}>
          <strong>{event.type}</strong> - {new Date(event.timestamp).toLocaleTimeString()}
        </div>
      ))}
    </div>
  );
};

// Then use <QuickTest /> somewhere in your JSX


const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const ContentManagement = React.lazy(() => import('./pages/ContentManagement'));
const EngagementMonitor = React.lazy(() => import('./pages/EngagementMonitor'));
const Analytics = React.lazy(() => import('./pages/Analytics'));
const UGCManagement = React.lazy(() => import('./pages/UGCManagement'));
const Settings = React.lazy(() => import('./pages/Settings'));
const Login = React.lazy(() => import('./pages/Login'));

// Loading component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center h-screen bg-gray-900">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
  </div>
);

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <ModalProvider>
          <Router>
            <RouteAnimationProvider>
            <React.Suspense fallback={<LoadingSpinner />}>
              <Routes>
                <Route 
                  path="/login" 
                  element={
                    <PageTransition type="fade">
                      <Login />
                    </PageTransition>
                  } 
                />
                <Route
                  path="/"
                  element={
                    <RequireAuth>
                      <Layout />
                    </RequireAuth>
                  }
                >
                  <Route 
                    index 
                    element={
                      <PageTransition type="slideUp">
                        <Dashboard />
                      </PageTransition>
                    } 
                  />
                  <Route 
                    path="content" 
                    element={
                      <PageTransition type="slide">
                        <ContentManagement />
                      </PageTransition>
                    } 
                  />
                  <Route 
                    path="engagement" 
                    element={
                      <PageTransition type="slide">
                        <EngagementMonitor />
                      </PageTransition>
                    } 
                  />
                  <Route 
                    path="analytics" 
                    element={
                      <PageTransition type="slide">
                        <Analytics />
                      </PageTransition>
                    } 
                  />
                  <Route 
                    path="ugc" 
                    element={
                      <PageTransition type="slide">
                        <UGCManagement />
                      </PageTransition>
                    } 
                  />
                  <Route 
                    path="settings" 
                    element={
                      <PageTransition type="slide">
                        <Settings />
                      </PageTransition>
                    } 
                  />
                </Route>
              </Routes>
            </React.Suspense>
            </RouteAnimationProvider>
            <ToastContainer />
          </Router>
        </ModalProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;