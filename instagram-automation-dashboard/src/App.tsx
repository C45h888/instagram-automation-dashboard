// src/App.tsx - COMPLETE WORKING VERSION
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Simple Test Component for Real-time Testing
const RealtimeTestPanel: React.FC = () => {
  const [connectionStatus, setConnectionStatus] = React.useState<'connecting' | 'connected' | 'error'>('connecting');
  const [events, setEvents] = React.useState<any[]>([]);
  const [testResults, setTestResults] = React.useState<string[]>([]);

  // Test backend connection
  const testConnection = async () => {
    setTestResults(prev => [...prev, '🔄 Testing backend connection...']);
    try {
      const response = await fetch('http://localhost:3001/health');
      if (response.ok) {
        const data = await response.json();
        setConnectionStatus('connected');
        setTestResults(prev => [...prev, `✅ Backend connected! Uptime: ${data.uptime}s`]);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      setConnectionStatus('error');
      setTestResults(prev => [...prev, `❌ Backend connection failed: ${error.message}`]);
    }
  };

  // Test webhook endpoints
  const testWebhook = async (type: 'response' | 'metrics' | 'alert') => {
    setTestResults(prev => [...prev, `🔄 Testing ${type} webhook...`]);
    
    const testData = {
      response: {
        message_id: 'frontend_test_' + Date.now(),
        response_text: 'Test response from React frontend!',
        message_type: 'dm',
        user_id: '@frontend_user',
        sentiment: 'positive',
        priority: 'medium',
        auto_responded: true
      },
      metrics: {
        interaction_id: 'frontend_int_' + Date.now(),
        response_time: Math.floor(Math.random() * 2000) + 500,
        message_classification: 'question',
        auto_response_success: true,
        user_satisfaction_predicted: Math.random()
      },
      alert: {
        alert_type: 'urgent_message',
        message_content: 'Test urgent alert from React frontend',
        user_id: '@frontend_urgent',
        priority_score: 0.95,
        suggested_action: 'human_review'
      }
    };

    try {
      const endpoint = type === 'response' ? 'n8n-response' : 
                     type === 'metrics' ? 'n8n-metrics' : 'n8n-alerts';
      
      const response = await fetch(`http://localhost:3001/webhook/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData[type])
      });
      
      if (response.ok) {
        const result = await response.json();
        setTestResults(prev => [...prev, `✅ ${type} webhook success! Response: ${result.message}`]);
        
        // Auto-check for new events after successful webhook
        setTimeout(checkForEvents, 1000);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      setTestResults(prev => [...prev, `❌ ${type} webhook failed: ${error.message}`]);
    }
  };

  // Check for real-time events
  const checkForEvents = async () => {
    try {
      const response = await fetch('http://localhost:3001/webhook/realtime-updates');
      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
        setTestResults(prev => [...prev, `📨 Events check: Found ${data.events?.length || 0} total events`]);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      setTestResults(prev => [...prev, `❌ Events check failed: ${error.message}`]);
    }
  };

  // Test connection on mount
  React.useEffect(() => {
    testConnection();
  }, []);

  return (
    <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/30 rounded-xl p-6 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">🔥 Real-time Integration Test</h2>
        <div className="flex items-center space-x-2">
          <div className={`w-4 h-4 rounded-full ${
            connectionStatus === 'connected' ? 'bg-green-400 animate-pulse' : 
            connectionStatus === 'error' ? 'bg-red-400' : 'bg-yellow-400 animate-pulse'
          }`}></div>
          <span className="text-sm font-medium">
            {connectionStatus === 'connected' ? '🟢 Connected' : 
             connectionStatus === 'error' ? '🔴 Backend Error' : '🟡 Connecting...'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Test Controls */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Test Controls</h3>
          <div className="grid grid-cols-1 gap-3">
            <button 
              onClick={testConnection}
              className="px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all duration-200 font-medium"
            >
              🔌 Test Backend Connection
            </button>
            <button 
              onClick={() => testWebhook('response')}
              className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 font-medium"
            >
              📨 Test N8N Response Webhook
            </button>
            <button 
              onClick={() => testWebhook('metrics')}
              className="px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all duration-200 font-medium"
            >
              📊 Test N8N Metrics Webhook
            </button>
            <button 
              onClick={() => testWebhook('alert')}
              className="px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all duration-200 font-medium"
            >
              🚨 Test N8N Alert Webhook
            </button>
            <button 
              onClick={checkForEvents}
              className="px-4 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-all duration-200 font-medium"
            >
              🔍 Check for New Events
            </button>
          </div>
        </div>

        {/* Results & Events Display */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Results & Live Events</h3>
          
          {/* Events Display */}
          <div className="bg-gray-800/50 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-300 mb-2">Live Events ({events.length})</h4>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {events.slice(0, 3).map((event, i) => (
                <div key={i} className="text-xs bg-gray-700/50 p-2 rounded border-l-2 border-blue-400">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-blue-300">{event.type}</span>
                    <span className="text-gray-400">{new Date(event.timestamp).toLocaleTimeString()}</span>
                  </div>
                  {event.data?.message_id && (
                    <div className="text-gray-300">ID: {event.data.message_id}</div>
                  )}
                </div>
              ))}
              {events.length === 0 && (
                <div className="text-gray-400 text-sm italic">No events yet. Try triggering a webhook test!</div>
              )}
            </div>
          </div>

          {/* Test Results Log */}
          <div className="bg-gray-800/50 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-green-300 mb-2">Test Results Log</h4>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {testResults.slice(-8).map((result, i) => (
                <div key={i} className="text-xs text-gray-300 font-mono bg-gray-900/30 p-1 rounded">
                  {result}
                </div>
              ))}
              {testResults.length === 0 && (
                <div className="text-gray-400 text-sm italic">Test results will appear here...</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 text-xs text-gray-400 border-t border-gray-600 pt-4">
        💡 <strong>Instructions:</strong> 1) Test backend connection first, 2) Try webhook tests, 3) Check events. 
        Remove this component once real-time integration is verified.
      </div>
    </div>
  );
};

// Main Dashboard Component
const Dashboard: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            🚀 Instagram Automation Dashboard
          </h1>
          <p className="text-xl text-gray-300">
            Real-time N8N webhook integration testing and monitoring
          </p>
        </div>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-r from-blue-600/20 to-blue-800/20 backdrop-blur-sm border border-blue-500/30 p-6 rounded-xl">
            <h2 className="text-xl font-semibold mb-2 text-blue-300">📊 Analytics</h2>
            <p className="text-gray-300">Real-time Instagram performance metrics</p>
          </div>
          <div className="bg-gradient-to-r from-green-600/20 to-green-800/20 backdrop-blur-sm border border-green-500/30 p-6 rounded-xl">
            <h2 className="text-xl font-semibold mb-2 text-green-300">🤖 Automations</h2>
            <p className="text-gray-300">N8N-powered automated workflows</p>
          </div>
          <div className="bg-gradient-to-r from-purple-600/20 to-purple-800/20 backdrop-blur-sm border border-purple-500/30 p-6 rounded-xl">
            <h2 className="text-xl font-semibold mb-2 text-purple-300">💬 Engagement</h2>
            <p className="text-gray-300">Live comment and message monitoring</p>
          </div>
        </div>

        {/* Real-time Test Panel */}
        <RealtimeTestPanel />
      </div>
    </div>
  );
};

// Simple Login Component
const Login: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 p-8 rounded-xl max-w-md w-full">
        <h1 className="text-3xl font-bold text-white mb-6 text-center">Welcome</h1>
        <p className="text-gray-300 text-center mb-6">Instagram Automation Dashboard</p>
        <button 
          onClick={() => window.location.href = '/'}
          className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-all duration-200 font-medium"
        >
          Enter Dashboard
        </button>
      </div>
    </div>
  );
};

// Main App Component
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <React.Suspense fallback={
          <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
            <div className="text-white text-xl">Loading Dashboard...</div>
          </div>
        }>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Dashboard />} />
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </React.Suspense>
      </Router>
    </QueryClientProvider>
  );
}

export default App;