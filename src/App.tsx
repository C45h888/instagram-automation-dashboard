// src/App.tsx - SIMPLIFIED VERSION TO GET FRONTEND WORKING
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

// Simple Dashboard Component
const Dashboard: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">🚀 Instagram Automation Dashboard</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">📊 Analytics</h2>
            <p className="text-gray-300">View your Instagram performance</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">🤖 Automations</h2>
            <p className="text-gray-300">Manage your automated workflows</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">💬 Engagement</h2>
            <p className="text-gray-300">Monitor comments and messages</p>
          </div>
        </div>

        {/* Real-time Test Component */}
        <RealtimeTestComponent />
      </div>
    </div>
  );
};

// Real-time Test Component
const RealtimeTestComponent: React.FC = () => {
  const [connectionStatus, setConnectionStatus] = React.useState<'connecting' | 'connected' | 'error'>('connecting');
  const [events, setEvents] = React.useState<any[]>([]);
  const [testResults, setTestResults] = React.useState<string[]>([]);

  // Test backend connection
  const testConnection = async () => {
    try {
      const response = await fetch('http://localhost:3001/health');
      const data = await response.json();
      setConnectionStatus('connected');
      setTestResults(prev => [...prev, `✅ Backend connected: ${JSON.stringify(data)}`]);
    } catch (error) {
      setConnectionStatus('error');
      setTestResults(prev => [...prev, `❌ Backend connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`]);
    }
  };

  // Test webhook endpoint
  const testWebhook = async (type: 'response' | 'metrics' | 'alert') => {
    const testData = {
      response: {
        message_id: 'test_' + Date.now(),
        response_text: 'Test response from frontend!',
        message_type: 'dm',
        user_id: '@test_user',
        sentiment: 'positive',
        priority: 'medium',
        auto_responded: true
      },
      metrics: {
        interaction_id: 'int_' + Date.now(),
        response_time: 1200,
        message_classification: 'question',
        auto_response_success: true,
        user_satisfaction_predicted: 0.85
      },
      alert: {
        alert_type: 'urgent_message',
        message_content: 'Test urgent message',
        user_id: '@urgent_user',
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
      
      const result = await response.json();
      setTestResults(prev => [...prev, `✅ ${type} webhook: ${JSON.stringify(result)}`]);
      
      // Check for new events
      checkForEvents();
    } catch (error) {
      setTestResults(prev => [...prev, `❌ ${type} webhook failed: ${error instanceof Error ? error.message : 'Unknown error'}`]);
    }
  };

  // Check for events
  const checkForEvents = async () => {
    try {
      const response = await fetch('http://localhost:3001/webhook/realtime-updates');
      const data = await response.json();
      setEvents(data.events || []);
      setTestResults(prev => [...prev, `📨 Found ${data.events?.length || 0} events`]);
    } catch (error) {
      setTestResults(prev => [...prev, `❌ Failed to check events: ${error instanceof Error ? error.message : 'Unknown error'}`]);
    }
  };

  // Test connection on mount
  React.useEffect(() => {
    testConnection();
  }, []);

  return (
    <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-6 mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-white">🔥 Real-time Integration Test</h2>
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${
            connectionStatus === 'connected' ? 'bg-green-400 animate-pulse' : 
            connectionStatus === 'error' ? 'bg-red-400' : 'bg-yellow-400 animate-pulse'
          }`}></div>
          <span className="text-sm text-gray-300">
            {connectionStatus === 'connected' ? '🟢 Connected' : 
             connectionStatus === 'error' ? '🔴 Error' : '🟡 Connecting'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Test Controls */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Test Controls</h3>
          <div className="space-y-2">
            <button 
              onClick={testConnection}
              className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
            >
              Test Backend Connection
            </button>
            <button 
              onClick={() => testWebhook('response')}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            >
              Test N8N Response Webhook
            </button>
            <button 
              onClick={() => testWebhook('metrics')}
              className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
            >
              Test N8N Metrics Webhook
            </button>
            <button 
              onClick={() => testWebhook('alert')}
              className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
            >
              Test N8N Alert Webhook
            </button>
            <button 
              onClick={checkForEvents}
              className="w-full px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded transition-colors"
            >
              Check for New Events
            </button>
          </div>
        </div>

        {/* Results Display */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Results & Events</h3>
          <div className="bg-gray-800 rounded p-4 h-64 overflow-y-auto">
            <div className="space-y-1">
              <p className="text-sm text-gray-300 mb-2">Events: {events.length}</p>
              {events.slice(0, 3).map((event, i) => (
                <div key={i} className="text-xs bg-gray-700 p-2 rounded border-l-2 border-blue-400">
                  <strong className="text-blue-300">{event.type}</strong>
                  <div className="text-gray-300">{new Date(event.timestamp).toLocaleTimeString()}</div>
                </div>
              ))}
              
              <div className="border-t border-gray-600 pt-2 mt-2">
                <p className="text-sm text-gray-300 mb-1">Test Results:</p>
                {testResults.slice(-5).map((result, i) => (
                  <div key={i} className="text-xs text-gray-400 mb-1 font-mono">
                    {result}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Simple Login Component
const Login: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-gray-800 p-8 rounded-lg max-w-md w-full">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">Login</h1>
        <button 
          onClick={() => window.location.href = '/'}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
        >
          Continue to Dashboard
        </button>
      </div>
    </div>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <React.Suspense fallback={
          <div className="min-h-screen bg-gray-900 flex items-center justify-center">
            <div className="text-white text-xl">Loading...</div>
          </div>
        }>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Dashboard />} />
          </Routes>
        </React.Suspense>
      </Router>
    </QueryClientProvider>
  );
}

export default App;