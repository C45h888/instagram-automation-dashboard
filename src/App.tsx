import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import RequireAuth from './components/layout/RequireAuth';
import Layout from './components/layout/Layout';
import { ToastProvider } from './contexts/ToastContext';
import { ModalProvider } from './contexts/ModalContext';
import ToastContainer from './components/ui/ToastContainer';

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
            <React.Suspense fallback={<LoadingSpinner />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route
                  path="/"
                  element={
                    <RequireAuth>
                      <Layout />
                    </RequireAuth>
                  }
                >
                  <Route index element={<Dashboard />} />
                  <Route path="content" element={<ContentManagement />} />
                  <Route path="engagement" element={<EngagementMonitor />} />
                  <Route path="analytics" element={<Analytics />} />
                  <Route path="ugc" element={<UGCManagement />} />
                  <Route path="settings" element={<Settings />} />
                </Route>
              </Routes>
            </React.Suspense>
            <ToastContainer />
          </Router>
        </ModalProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;