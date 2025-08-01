// src/services/realtimeService.ts
import React from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export interface RealtimeEvent {
  type: 'new_response' | 'metrics_update' | 'urgent_alert';
  data: any;
  timestamp: string;
  id: string;
}

export interface N8NResponse {
  message_id: string;
  response_text: string;
  message_type: 'dm' | 'comment';
  user_id: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  priority: 'high' | 'medium' | 'low';
  auto_responded: boolean;
  timestamp?: string;
}

export interface N8NMetrics {
  interaction_id: string;
  response_time: number;
  message_classification: 'question' | 'complaint' | 'compliment';
  auto_response_success: boolean;
  user_satisfaction_predicted: number;
  timestamp?: string;
}

export interface N8NAlert {
  alert_type: 'urgent_message' | 'negative_sentiment' | 'escalation_needed';
  message_content: string;
  user_id: string;
  priority_score: number;
  suggested_action: 'human_review' | 'immediate_response';
  timestamp?: string;
}

class RealtimeService {
  private lastTimestamp: string | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private isPolling: boolean = false;

  // Start polling for real-time updates
  startPolling(intervalMs: number = 2000) {
    if (this.isPolling) {
      console.log('🔄 Already polling for updates');
      return;
    }

    this.stopPolling(); // Clear any existing interval
    this.isPolling = true;
    
    console.log('🚀 Starting real-time polling every', intervalMs, 'ms');
    
    this.pollingInterval = setInterval(async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/webhook/realtime-updates`, {
          params: this.lastTimestamp ? { since: this.lastTimestamp } : {}
        });
        
        const { events, latest_timestamp } = response.data;
        
        if (events && events.length > 0) {
          console.log('📨 Received', events.length, 'new events');
          
          // Update last timestamp
          this.lastTimestamp = latest_timestamp;
          
          // Notify listeners for each event
          events.forEach((event: RealtimeEvent) => {
            console.log('📡 Processing event:', event.type, event.data);
            this.notifyListeners(event.type, event.data);
            this.notifyListeners('any', event); // Generic listener for all events
          });
        }
      } catch (error) {
        console.error('❌ Error polling for updates:', error);
        // Don't stop polling on error, just log it
      }
    }, intervalMs);
  }

  // Stop polling
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      this.isPolling = false;
      console.log('⏹️ Stopped real-time polling');
    }
  }

  // Subscribe to specific event types
  subscribe(eventType: string, callback: (data: any) => void) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);

    console.log(`👂 Subscribed to ${eventType} events`);

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(eventType);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.listeners.delete(eventType);
        }
        console.log(`🔇 Unsubscribed from ${eventType} events`);
      }
    };
  }

  // Notify all listeners for an event type
  private notifyListeners(eventType: string, data: any) {
    const callbacks = this.listeners.get(eventType);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`❌ Error in event listener for ${eventType}:`, error);
        }
      });
    }
  }

  // Get current status
  getStatus() {
    return {
      isPolling: this.isPolling,
      lastTimestamp: this.lastTimestamp,
      activeListeners: Array.from(this.listeners.keys()),
      totalListeners: Array.from(this.listeners.values()).reduce((sum, set) => sum + set.size, 0)
    };
  }

  // Manual trigger for testing
  async triggerTestEvent(type: 'response' | 'metrics' | 'alert') {
    const testData = {
      response: {
        message_id: 'test_frontend_' + Date.now(),
        response_text: 'This is a test response from the frontend!',
        message_type: 'dm',
        user_id: '@frontend_test_user',
        sentiment: 'positive',
        priority: 'medium',
        auto_responded: true,
        timestamp: new Date().toISOString()
      },
      metrics: {
        interaction_id: 'int_frontend_' + Date.now(),
        response_time: Math.floor(Math.random() * 2000) + 500,
        message_classification: 'question',
        auto_response_success: true,
        user_satisfaction_predicted: Math.random(),
        timestamp: new Date().toISOString()
      },
      alert: {
        alert_type: 'urgent_message',
        message_content: 'This is a test urgent message from frontend',
        user_id: '@frontend_urgent_user',
        priority_score: 0.95,
        suggested_action: 'human_review',
        timestamp: new Date().toISOString()
      }
    };

    try {
      const endpoint = type === 'response' ? 'n8n-response' : 
                     type === 'metrics' ? 'n8n-metrics' : 'n8n-alerts';
      
      await axios.post(`${API_BASE_URL}/webhook/${endpoint}`, testData[type]);
      console.log(`✅ Test ${type} event triggered successfully`);
      return { success: true, message: `Test ${type} event sent` };
    } catch (error) {
      console.error(`❌ Failed to trigger test ${type} event:`, error);
      return { success: false, error: error.message };
    }
  }

  // Check backend connection
  async testConnection() {
    try {
      const response = await axios.get(`${API_BASE_URL}/health`);
      console.log('✅ Backend connection successful:', response.data);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('❌ Backend connection failed:', error);
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
export const realtimeService = new RealtimeService();

// React Hook for easy usage
export const useRealtimeUpdates = () => {
  const [isConnected, setIsConnected] = React.useState(false);
  const [events, setEvents] = React.useState<RealtimeEvent[]>([]);
  const [status, setStatus] = React.useState(realtimeService.getStatus());

  React.useEffect(() => {
    // Start polling when component mounts
    realtimeService.startPolling(3000); // Poll every 3 seconds
    setIsConnected(true);

    // Subscribe to all events to update local state
    const unsubscribe = realtimeService.subscribe('any', (event: RealtimeEvent) => {
      setEvents(prev => [event, ...prev.slice(0, 19)]); // Keep last 20 events
    });

    // Update status periodically
    const statusInterval = setInterval(() => {
      setStatus(realtimeService.getStatus());
    }, 5000);

    return () => {
      realtimeService.stopPolling();
      setIsConnected(false);
      unsubscribe();
      clearInterval(statusInterval);
    };
  }, []);

  return {
    isConnected,
    events,
    status,
    subscribe: realtimeService.subscribe.bind(realtimeService),
    triggerTest: realtimeService.triggerTestEvent.bind(realtimeService),
    testConnection: realtimeService.testConnection.bind(realtimeService)
  };
};