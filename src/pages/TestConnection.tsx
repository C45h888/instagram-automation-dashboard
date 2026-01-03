import React, { useState, useEffect } from 'react';
import { testSupabaseConnection } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

export const TestConnection: React.FC = () => {
  const [connectionStatus, setConnectionStatus] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [testResults, setTestResults] = useState<string[]>([]);
  const { signInAsAdmin, signOut, user, isAuthenticated, isAdmin } = useAuthStore();
  
  useEffect(() => {
    runTests();
  }, []);
  
  const addResult = (message: string, success = true) => {
    setTestResults(prev => [...prev, `${success ? '✅' : '❌'} ${message}`]);
  };
  
  const runTests = async () => {
    setLoading(true);
    setTestResults([]);
    
    try {
      // Test 1: Frontend Supabase Connection
      addResult('Testing frontend Supabase connection...');
      const supabaseResult = await testSupabaseConnection();
      addResult(
        supabaseResult.connected 
          ? 'Frontend connected to Supabase via tunnel' 
          : `Frontend connection failed: ${supabaseResult.error}`,
        supabaseResult.connected
      );
      
      // Test 2: Backend API
      addResult('Testing backend API...');
      const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const backendResponse = await fetch(`${backendUrl}/health`);
      addResult(
        backendResponse.ok 
          ? 'Backend API is healthy' 
          : 'Backend API failed',
        backendResponse.ok
      );
      
      // Test 3: Backend Supabase Connection
      addResult('Testing backend Supabase connection...');
      const backendSupabaseResponse = await fetch(`${backendUrl}/api/test/supabase`);
      const backendSupabaseData = await backendSupabaseResponse.json();
      addResult(
        backendSupabaseResponse.ok 
          ? `Backend connected to Supabase (${backendSupabaseData.stats?.users || 0} users)` 
          : 'Backend Supabase connection failed',
        backendSupabaseResponse.ok
      );
      
      // Test 4: RLS Policies
      addResult('Testing RLS policies...');
      const rlsResponse = await fetch(`${backendUrl}/api/test/test-rls`);
      const rlsData = await rlsResponse.json();
      addResult(
        rlsData.rlsWorking 
          ? 'RLS policies are working correctly' 
          : 'WARNING: RLS may not be configured',
        rlsData.rlsWorking
      );
      
      setConnectionStatus({
        frontend: supabaseResult.connected,
        backend: backendResponse.ok,
        backendSupabase: backendSupabaseResponse.ok,
        rls: rlsData.rlsWorking,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Test error:', error);
      addResult(`Test failed: ${error}`, false);
    } finally {
      setLoading(false);
    }
  };
  
  const testDataInsertion = async () => {
    try {
      const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/test/insert-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test_name: 'Cloudflare Tunnel Test',
          test_data: {
            timestamp: new Date().toISOString(),
            source: 'TestConnection component'
          }
        })
      });
      
      const result = await response.json();
      addResult(
        response.ok 
          ? `Data inserted successfully (ID: ${result.data?.id})` 
          : 'Data insertion failed',
        response.ok
      );
    } catch (error) {
      addResult(`Insert test error: ${error}`, false);
    }
  };
  
  const testAdminLogin = async () => {
    try {
      await signInAsAdmin('admin@888intelligence.com', 'Admin@888Intelligence2024');
      addResult('Admin login successful');
    } catch (error) {
      addResult(`Admin login failed: ${error}`, false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">
          Supabase + Cloudflare Tunnel Test Dashboard
        </h1>
        
        {/* Connection Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatusCard
            title="Frontend → Supabase"
            status={connectionStatus.frontend}
            subtitle="Via Tunnel B"
          />
          <StatusCard
            title="Backend API"
            status={connectionStatus.backend}
            subtitle="Via Tunnel A"
          />
          <StatusCard
            title="Backend → Supabase"
            status={connectionStatus.backendSupabase}
            subtitle="Service Role"
          />
          <StatusCard
            title="RLS Policies"
            status={connectionStatus.rls}
            subtitle="Security Layer"
          />
        </div>
        
        {/* Test Results */}
        <div className="bg-gray-800/50 backdrop-blur-lg rounded-2xl p-6 mb-6 border border-gray-700">
          <h2 className="text-2xl font-semibold text-white mb-4">Test Results</h2>
          
          {loading ? (
            <div className="text-gray-400">Running connection tests...</div>
          ) : (
            <div className="space-y-2 font-mono text-sm">
              {testResults.map((result, index) => (
                <div key={index} className="text-gray-300">
                  {result}
                </div>
              ))}
            </div>
          )}
          
          <div className="flex gap-4 mt-6">
            <button
              onClick={runTests}
              disabled={loading}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Testing...' : 'Rerun Tests'}
            </button>
            
            <button
              onClick={testDataInsertion}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Test Data Insert
            </button>
          </div>
        </div>
        
        {/* Authentication Test */}
        <div className="bg-gray-800/50 backdrop-blur-lg rounded-2xl p-6 mb-6 border border-gray-700">
          <h2 className="text-2xl font-semibold text-white mb-4">Authentication Test</h2>
          
          {isAuthenticated ? (
            <div className="space-y-2">
              <p className="text-green-400">
                ✅ Authenticated as: {user?.email || user?.username}
              </p>
              <p className="text-gray-400">
                Role: {isAdmin ? 'Admin' : 'User'}
              </p>
              <button
                onClick={signOut}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={testAdminLogin}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Test Admin Login
            </button>
          )}
        </div>
        
        {/* Environment Info */}
        <div className="bg-gray-800/50 backdrop-blur-lg rounded-2xl p-6 border border-gray-700">
          <h2 className="text-2xl font-semibold text-white mb-4">Environment Configuration</h2>
          
          <div className="text-gray-400 space-y-2 font-mono text-sm">
            <div>Tunnel B (DB): {import.meta.env.VITE_SUPABASE_URL}</div>
            <div>Backend API: {import.meta.env.VITE_API_URL}</div>
            <div>Environment: {import.meta.env.VITE_ENVIRONMENT}</div>
            <div>OAuth Enabled: {import.meta.env.VITE_ENABLE_INSTAGRAM_OAUTH === 'true' ? 'Yes' : 'No (Waiting for Meta credentials)'}</div>
            <div>Database: uromexjprcrjfmhkmgxa.supabase.co</div>
            <div>Timestamp: {new Date().toISOString()}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatusCard: React.FC<{ title: string; status: boolean; subtitle: string }> = ({ 
  title, 
  status, 
  subtitle 
}) => (
  <div className={`p-6 rounded-xl border ${
    status 
      ? 'bg-green-900/20 border-green-500/50' 
      : status === false 
        ? 'bg-red-900/20 border-red-500/50'
        : 'bg-gray-800/50 border-gray-700'
  }`}>
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-white font-semibold">{title}</h3>
      <div className={`w-3 h-3 rounded-full ${
        status 
          ? 'bg-green-400 animate-pulse' 
          : status === false 
            ? 'bg-red-400'
            : 'bg-gray-400'
      }`} />
    </div>
    <p className="text-gray-400 text-sm">{subtitle}</p>
    <p className={`text-sm mt-2 font-semibold ${
      status 
        ? 'text-green-400' 
        : status === false 
          ? 'text-red-400'
          : 'text-gray-500'
    }`}>
      {status ? 'Connected' : status === false ? 'Failed' : 'Pending'}
    </p>
  </div>
);

export default TestConnection;