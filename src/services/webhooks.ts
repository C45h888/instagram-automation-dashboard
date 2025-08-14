// src/services/webhooks.ts - FIXED VERSION FOR VITE + TYPESCRIPT
import axios, { type AxiosResponse } from 'axios';
// Vite environment variables (properly typed)
const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'https://instagram-backend.888intelligenceautomation.in';
const WEBHOOK_VERIFY_TOKEN = (import.meta as any).env?.VITE_WEBHOOK_VERIFY_TOKEN || 'instagram_automation_cf_token_2024';

// Configure axios defaults
axios.defaults.timeout = 15000;
axios.defaults.headers.common['Content-Type'] = 'application/json';
axios.defaults.headers.common['User-Agent'] = 'Instagram-Automation-Dashboard/1.0';

console.log('🌐 Webhook Service Initialized (Cloudflare)');
console.log('📡 API Base URL:', API_BASE_URL);

// Types for better TypeScript support
interface AutomationStatusData {
  status: 'active' | 'inactive' | 'paused';
  automation: string;
  timestamp?: string;
}

interface ContentPublishedData {
  post_id: string;
  caption: string;
  media_type: 'image' | 'video' | 'carousel';
  timestamp?: string;
}

interface EngagementUpdateData {
  type: 'like' | 'comment' | 'follow' | 'mention' | 'automation_toggle';
  user_id: string;
  post_id?: string;
  engagement_data: any;
}

interface HealthCheckResponse {
  status: string;
  uptime: number;
  tunnel: {
    provider: string;
    domain: string;
    active: boolean;
  };
  timestamp: string;
}

// Error handling wrapper
const handleApiCall = async <T>(apiCall: () => Promise<AxiosResponse<T>>): Promise<T> => {
  try {
    const response = await apiCall();
    return response.data;
  } catch (error: any) {
    console.error('❌ API call failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw new Error(`API call failed: ${error.message}`);
  }
};

// ============================================
// CORE WEBHOOK FUNCTIONS
// ============================================

/**
 * Test backend server connection
 */
export const testBackendConnection = async (): Promise<HealthCheckResponse> => {
  console.log('🔍 Testing Cloudflare backend connection...');
  return handleApiCall(() => axios.get(`${API_BASE_URL}/health`));
};

/**
 * Test webhook endpoints
 */
export const testWebhookEndpoints = async (): Promise<any> => {
  console.log('🧪 Testing webhook endpoints...');
  return handleApiCall(() => axios.get(`${API_BASE_URL}/webhook/test`));
};

/**
 * Test Meta webhook verification
 */
export const testMetaWebhookVerification = async (
  customToken?: string
): Promise<string> => {
  const token = customToken || WEBHOOK_VERIFY_TOKEN;
  const challenge = 'test_challenge_' + Date.now();
  
  console.log('📱 Testing Meta webhook verification via Cloudflare...');
  
  const response = await handleApiCall(() => 
    axios.get(`${API_BASE_URL}/webhook/instagram`, {
      params: {
        'hub.mode': 'subscribe',
        'hub.verify_token': token,
        'hub.challenge': challenge
      }
    })
  );
  
  return response;
};

/**
 * Get tunnel status
 */
export const getTunnelStatus = async (): Promise<any> => {
  console.log('🌐 Getting Cloudflare tunnel status...');
  return handleApiCall(() => axios.get(`${API_BASE_URL}/tunnel/status`));
};

// ============================================
// AUTOMATION WEBHOOK FUNCTIONS
// ============================================

/**
 * Post automation status update
 */
export const postAutomationStatus = async (data: AutomationStatusData): Promise<any> => {
  console.log('📊 Posting automation status:', data.status);
  return handleApiCall(() => 
    axios.post(`${API_BASE_URL}/webhook/automation-status`, {
      ...data,
      timestamp: data.timestamp || new Date().toISOString()
    })
  );
};

/**
 * Post content published event
 */
export const postContentPublished = async (data: ContentPublishedData): Promise<any> => {
  console.log('📝 Posting content published event:', data.post_id);
  return handleApiCall(() => 
    axios.post(`${API_BASE_URL}/webhook/content-published`, {
      ...data,
      timestamp: data.timestamp || new Date().toISOString()
    })
  );
};

/**
 * Post engagement update
 */
export const postEngagementUpdate = async (data: EngagementUpdateData): Promise<any> => {
  console.log('💬 Posting engagement update:', data.type);
  return handleApiCall(() => 
    axios.post(`${API_BASE_URL}/webhook/engagement-update`, data)
  );
};

/**
 * Fetch analytics data
 */
export const fetchAnalyticsData = async (): Promise<any> => {
  console.log('📈 Fetching analytics data...');
  return handleApiCall(() => axios.get(`${API_BASE_URL}/webhook/analytics-data`));
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get current webhook configuration
 */
export const getWebhookConfig = () => {
  return {
    apiBaseUrl: API_BASE_URL,
    webhookUrl: `${API_BASE_URL}/webhook/instagram`,
    verifyToken: WEBHOOK_VERIFY_TOKEN,
    healthCheckUrl: `${API_BASE_URL}/health`,
    provider: 'cloudflare',
    domain: '888intelligenceautomation.in'
  };
};

/**
 * Test complete webhook flow
 */
export const testCompleteWebhookFlow = async (): Promise<{
  backendConnection: boolean;
  webhookEndpoints: boolean;
  metaVerification: boolean;
  tunnelStatus: boolean;
}> => {
  console.log('🧪 Testing complete Cloudflare webhook flow...');
  
  const results = {
    backendConnection: false,
    webhookEndpoints: false,
    metaVerification: false,
    tunnelStatus: false
  };
  
  try {
    await testBackendConnection();
    results.backendConnection = true;
    console.log('✅ Backend connection: OK');
  } catch (error) {
    console.log('❌ Backend connection: FAILED');
  }
  
  try {
    await testWebhookEndpoints();
    results.webhookEndpoints = true;
    console.log('✅ Webhook endpoints: OK');
  } catch (error) {
    console.log('❌ Webhook endpoints: FAILED');
  }
  
  try {
    await testMetaWebhookVerification();
    results.metaVerification = true;
    console.log('✅ Meta verification: OK');
  } catch (error) {
    console.log('❌ Meta verification: FAILED');
  }
  
  try {
    await getTunnelStatus();
    results.tunnelStatus = true;
    console.log('✅ Tunnel status: OK');
  } catch (error) {
    console.log('❌ Tunnel status: FAILED');
  }
  
  const allPassed = Object.values(results).every(result => result);
  console.log(allPassed ? '🎉 All Cloudflare webhook tests passed!' : '⚠️ Some webhook tests failed');
  
  return results;
};

// Export configuration for debugging
export const WEBHOOK_CONFIG = getWebhookConfig();