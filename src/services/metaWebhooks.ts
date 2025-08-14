// src/services/metaWebhooks.ts - Meta API Webhook Integration
import axios  from 'axios';

// Environment configuration
const WEBHOOK_BASE_URL = (import.meta as any).env?.VITE_WEBHOOK_URL || 'https://instagram-backend.888intelligenceautomation.in';
const VERIFY_TOKEN = (import.meta as any).env?.VITE_WEBHOOK_VERIFY_TOKEN || 'instagram_automation_cf_token_2024';
const META_APP_SECRET = (import.meta as any).env?.VITE_META_APP_SECRET;

console.log('🔗 Meta Webhooks Service Initialized');
console.log('📡 Webhook Base URL:', WEBHOOK_BASE_URL);

// Types for Meta API webhook events
interface MetaWebhookEntry {
  id: string;
  changes?: MetaWebhookChange[];
}

interface MetaWebhookChange {
  field: 'comments' | 'mentions' | 'story_insights';
  value: any;
}

interface MetaWebhookBody {
  object: 'instagram';
  entry: MetaWebhookEntry[];
}

interface CommentData {
  id: string;
  text: string;
  from: {
    id: string;
    username?: string;
  };
  created_time: string;
  media?: {
    id: string;
  };
}

interface MentionData {
  media_id: string;
  comment_id?: string;
  from: {
    id: string;
    username?: string;
  };
  created_time: string;
}

interface StoryInsightData {
  story_id: string;
  impressions?: number;
  reach?: number;
  replies?: number;
}

// ============================================
// WEBHOOK VERIFICATION FUNCTIONS
// ============================================

/**
 * Verify Meta webhook challenge for subscription
 */
export const verifyWebhook = (mode: string, token: string, challenge: string): string => {
  console.log('🔍 Verifying Meta webhook:', { mode, token: token ? 'provided' : 'missing' });
  
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Meta webhook verification successful');
    return challenge;
  }
  
  console.error('❌ Meta webhook verification failed');
  console.error(`Expected token: ${VERIFY_TOKEN}`);
  console.error(`Received token: ${token}`);
  
  throw new Error('Webhook verification failed');
};

/**
 * Verify Meta webhook signature for security
 */
export const verifyWebhookSignature = (payload: string, signature: string): boolean => {
  if (!META_APP_SECRET) {
    console.warn('⚠️ META_APP_SECRET not configured - signature verification disabled');
    return true;
  }

  try {
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', META_APP_SECRET)
      .update(payload)
      .digest('hex');
    
    const isValid = signature === `sha256=${expectedSignature}`;
    
    if (isValid) {
      console.log('✅ Meta webhook signature verified');
    } else {
      console.error('❌ Meta webhook signature verification failed');
    }
    
    return isValid;
  } catch (error) {
    console.error('❌ Error verifying webhook signature:', error);
    return false;
  }
};

// ============================================
// WEBHOOK EVENT HANDLERS
// ============================================

/**
 * Handle incoming Meta webhook events
 */
export const handleWebhookEvent = (body: MetaWebhookBody): { status: string; processed: number } => {
  console.log('📨 Processing Meta webhook event:', {
    object: body.object,
    entries: body.entry?.length || 0,
    timestamp: new Date().toISOString()
  });
  
  if (body.object !== 'instagram') {
    throw new Error(`Invalid webhook object: ${body.object}`);
  }

  let processedEvents = 0;

  body.entry?.forEach(entry => {
    console.log(`📋 Processing entry ID: ${entry.id}`);
    
    entry.changes?.forEach(change => {
      console.log(`🔄 Processing ${change.field} event`);
      
      switch (change.field) {
        case 'comments':
          handleCommentEvent(change.value);
          processedEvents++;
          break;
        case 'mentions':
          handleMentionEvent(change.value);
          processedEvents++;
          break;
        case 'story_insights':
          handleStoryInsight(change.value);
          processedEvents++;
          break;
        default:
          console.log('❓ Unhandled event type:', change.field);
      }
    });
  });
  
  console.log(`✅ Processed ${processedEvents} webhook events`);
  
  return { status: 'success', processed: processedEvents };
};

/**
 * Handle Instagram comment events
 */
const handleCommentEvent = (commentData: CommentData): void => {
  console.log('💬 Processing comment event:', {
    id: commentData.id,
    from: commentData.from.username || commentData.from.id,
    text: commentData.text?.substring(0, 50) + '...',
    media_id: commentData.media?.id
  });
  
  // Add your comment automation logic here
  // Examples:
  // - Auto-reply to specific keywords
  // - Moderate inappropriate content
  // - Trigger follow-up actions
  // - Store in database for analytics
  
  // Trigger automation based on comment content
  if (commentData.text?.toLowerCase().includes('help')) {
    console.log('🤖 Triggering help automation for comment:', commentData.id);
    // Add help response automation
  }
  
  if (commentData.text?.toLowerCase().includes('price')) {
    console.log('💰 Triggering price inquiry automation for comment:', commentData.id);
    // Add price inquiry automation
  }
};

/**
 * Handle Instagram mention events
 */
const handleMentionEvent = (mentionData: MentionData): void => {
  console.log('📢 Processing mention event:', {
    media_id: mentionData.media_id,
    comment_id: mentionData.comment_id,
    from: mentionData.from.username || mentionData.from.id
  });
  
  // Add your mention automation logic here
  // Examples:
  // - Thank users for mentions
  // - Repost user-generated content
  // - Send follow-up messages
  // - Track brand mentions for analytics
  
  console.log('🙏 Triggering mention response automation');
  // Add mention response automation
};

/**
 * Handle Instagram story insights
 */
const handleStoryInsight = (insightData: StoryInsightData): void => {
  console.log('📊 Processing story insight:', {
    story_id: insightData.story_id,
    impressions: insightData.impressions,
    reach: insightData.reach,
    replies: insightData.replies
  });
  
  // Add your analytics automation logic here
  // Examples:
  // - Store metrics in database
  // - Trigger performance alerts
  // - Generate automated reports
  // - Optimize content strategy
  
  if (insightData.impressions && insightData.impressions > 1000) {
    console.log('🔥 High-performing story detected - triggering optimization');
    // Add high-performance story automation
  }
};

// ============================================
// TESTING AND VALIDATION FUNCTIONS
// ============================================

/**
 * Test Meta webhook endpoints
 */
export const testWebhookEndpoints = async (): Promise<any[]> => {
  console.log('🧪 Testing Meta webhook endpoints...');
  
  const endpoints = [
    '/webhook/instagram',
    '/webhook/test-connection',
    '/webhook/verify'
  ];
  
  const results = [];
  
  for (const endpoint of endpoints) {
    try {
      const response = await axios.get(`${WEBHOOK_BASE_URL}${endpoint}`, {
        timeout: 10000
      });
      
      results.push({ 
        endpoint, 
        status: 'success', 
        statusCode: response.status,
        response: response.data 
      });
      
      console.log(`✅ ${endpoint}: OK`);
    } catch (error: any) {
      results.push({ 
        endpoint, 
        status: 'error', 
        error: error.message,
        statusCode: error.response?.status 
      });
      
      console.log(`❌ ${endpoint}: FAILED - ${error.message}`);
    }
  }
  
  return results;
};

/**
 * Send test webhook event to your backend
 */
export const sendTestWebhookEvent = async (eventType: 'comment' | 'mention' | 'story_insight'): Promise<any> => {
  console.log(`🧪 Sending test ${eventType} webhook event...`);
  
  const testEvents = {
    comment: {
      object: 'instagram',
      entry: [{
        id: 'test_media_id_' + Date.now(),
        changes: [{
          field: 'comments' as const,
          value: {
            id: 'test_comment_' + Date.now(),
            text: 'This is a test comment from the webhook service',
            from: {
              id: 'test_user_123',
              username: 'test_user'
            },
            created_time: new Date().toISOString(),
            media: {
              id: 'test_media_' + Date.now()
            }
          }
        }]
      }]
    },
    mention: {
      object: 'instagram',
      entry: [{
        id: 'test_media_id_' + Date.now(),
        changes: [{
          field: 'mentions' as const,
          value: {
            media_id: 'test_media_' + Date.now(),
            comment_id: 'test_comment_' + Date.now(),
            from: {
              id: 'test_user_456',
              username: 'mention_user'
            },
            created_time: new Date().toISOString()
          }
        }]
      }]
    },
    story_insight: {
      object: 'instagram',
      entry: [{
        id: 'test_story_id_' + Date.now(),
        changes: [{
          field: 'story_insights' as const,
          value: {
            story_id: 'test_story_' + Date.now(),
            impressions: Math.floor(Math.random() * 5000) + 100,
            reach: Math.floor(Math.random() * 3000) + 50,
            replies: Math.floor(Math.random() * 50) + 1
          }
        }]
      }]
    }
  };
  
  try {
    const response = await axios.post(`${WEBHOOK_BASE_URL}/webhook/instagram`, testEvents[eventType], {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Meta-Webhook-Test/1.0'
      },
      timeout: 15000
    });
    
    console.log(`✅ Test ${eventType} webhook sent successfully`);
    return response.data;
  } catch (error: any) {
    console.error(`❌ Failed to send test ${eventType} webhook:`, error.message);
    throw error;
  }
};

/**
 * Validate webhook configuration
 */
export const validateWebhookConfig = (): { valid: boolean; issues: string[] } => {
  console.log('🔍 Validating Meta webhook configuration...');
  
  const issues: string[] = [];
  
  if (!WEBHOOK_BASE_URL.startsWith('https://')) {
    issues.push('Webhook URL must use HTTPS');
  }
  
  if (!VERIFY_TOKEN || VERIFY_TOKEN.length < 10) {
    issues.push('Verify token must be at least 10 characters');
  }
  
  if (!WEBHOOK_BASE_URL.includes('888intelligenceautomation.in')) {
    issues.push('Webhook URL should use your configured domain');
  }
  
  if (!META_APP_SECRET) {
    issues.push('META_APP_SECRET not configured (recommended for production)');
  }
  
  const valid = issues.length === 0;
  
  if (valid) {
    console.log('✅ Webhook configuration is valid');
  } else {
    console.log('❌ Webhook configuration issues found:', issues);
  }
  
  return { valid, issues };
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get webhook configuration for debugging
 */
export const getWebhookConfig = () => {
  return {
    webhookBaseUrl: WEBHOOK_BASE_URL,
    webhookEndpoint: `${WEBHOOK_BASE_URL}/webhook/instagram`,
    verifyToken: VERIFY_TOKEN,
    hasAppSecret: !!META_APP_SECRET,
    provider: 'cloudflare',
    domain: '888intelligenceautomation.in'
  };
};

/**
 * Format webhook URL for Meta Developer Console
 */
export const getMetaWebhookUrl = (): string => {
  return `${WEBHOOK_BASE_URL}/webhook/instagram`;
};

// Export configuration for debugging
export const META_WEBHOOK_CONFIG = getWebhookConfig();