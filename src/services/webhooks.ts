// src/services/webhooks.ts - FIXED VERSION
import axios from 'axios';

// FIXED: Use backend port 3001, not frontend port 3000
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// Automation Status Management
export const postAutomationStatus = (data: {
  status: 'active' | 'inactive' | 'paused';
  automation: string;
  timestamp?: string;
}) =>
  axios.post(`${API_BASE_URL}/webhook/automation-status`, data);

// Content Publishing Events
export const postContentPublished = (data: {
  post_id: string;
  caption: string;
  media_type: 'image' | 'video' | 'carousel';
  timestamp?: string;
}) =>
  axios.post(`${API_BASE_URL}/webhook/content-published`, data);

// Engagement Updates
export const postEngagementUpdate = (data: {
  type: 'like' | 'comment' | 'follow' | 'mention' | 'automation_toggle';
  user_id: string;
  post_id?: string;
  engagement_data: any;
}) =>
  axios.post(`${API_BASE_URL}/webhook/engagement-update`, data);

// Analytics Data Fetching
export const fetchAnalyticsData = () =>
  axios.get(`${API_BASE_URL}/webhook/analytics-data`);

// Test Backend Connection
export const testBackendConnection = () =>
  axios.get(`${API_BASE_URL}/health`);

// Test Webhook Endpoints
export const testWebhookEndpoints = () =>
  axios.get(`${API_BASE_URL}/webhook/test`);

// Real-time webhook status
export const getWebhookStatus = () =>
  axios.get(`${API_BASE_URL}/webhook/n8n-status`);

// Meta webhook verification test
export const testMetaWebhook = (verifyToken: string) =>
  axios.get(`${API_BASE_URL}/webhook/instagram`, {
    params: {
      'hub.mode': 'subscribe',
      'hub.verify_token': verifyToken,
      'hub.challenge': 'test_challenge_123'
    }
  });