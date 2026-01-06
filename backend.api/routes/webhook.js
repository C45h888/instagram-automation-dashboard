// backend/routes/webhook.js - COMPLETE N8N INTEGRATION
// ✅ PHASE 6: Enhanced with retry logic, monitoring, and HMAC signature verification

const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');

// ============================================
// PHASE 6: CONFIGURATION CONSTANTS
// ============================================
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // ms (exponential backoff)
const RATE_LIMIT_BACKOFF = 30000; // 30s backoff for 429 responses
const MAX_EVENTS_CACHE = 50; // Bounded to prevent memory bloat

// ============================================
// PHASE 6: WEBHOOK METRICS STORAGE
// ============================================

/**
 * Webhook metrics storage - bounded to prevent memory issues
 * @type {Object}
 */
const webhookMetrics = {
  events: [],
  successCount: 0,
  failureCount: 0,
  retryCount: 0,
  rateLimitCount: 0,
  lastEventTime: null
};

/**
 * Logs webhook events for monitoring and debugging
 * Maintains bounded event cache and aggregated metrics
 * @param {string} eventType - Type of webhook event
 * @param {string} status - Event status ('success', 'failed', 'retry', 'skipped', 'rate_limited')
 * @param {string|null} error - Error message if applicable
 * @param {Object} metadata - Additional event metadata (latency, attempt, etc.)
 */
function logWebhookEvent(eventType, status, error = null, metadata = {}) {
  const event = {
    eventType,
    status,
    error,
    timestamp: new Date().toISOString(),
    ...metadata
  };

  // Update aggregated metrics
  if (status === 'success') webhookMetrics.successCount++;
  if (status === 'failed') webhookMetrics.failureCount++;
  if (status === 'retry') webhookMetrics.retryCount++;
  if (status === 'rate_limited') webhookMetrics.rateLimitCount++;
  webhookMetrics.lastEventTime = event.timestamp;

  // Keep last 50 events for debugging (bounded memory)
  webhookMetrics.events.push(event);
  if (webhookMetrics.events.length > MAX_EVENTS_CACHE) {
    webhookMetrics.events.shift();
  }

  // Log to console with structured JSON format (for log aggregation tools)
  console.log(JSON.stringify({
    type: 'WEBHOOK_EVENT',
    ...event
  }));
}

// ============================================
// PHASE 6: SIGNATURE VERIFICATION (MANDATORY - Meta Compliance)
// ============================================

/**
 * Verifies Meta webhook signature using HMAC-SHA256
 * MANDATORY for Meta compliance - prevents spoofed events
 * @see https://developers.facebook.com/docs/messenger-platform/webhooks#security
 */
function verifyMetaWebhookSignature(req, res, next) {
  const signature = req.headers['x-hub-signature-256'];

  if (!signature) {
    console.warn('⚠️ Webhook received without signature - rejecting');
    logWebhookEvent('signature_check', 'rejected', 'Missing signature header');
    return res.status(401).send('Missing signature');
  }

  // Use raw body if available (for accurate signature verification)
  const body = req.rawBody || JSON.stringify(req.body);

  const hmac = crypto.createHmac('sha256', process.env.META_APP_SECRET || '');
  hmac.update(body);
  const expectedSignature = `sha256=${hmac.digest('hex')}`;

  // Use timing-safe comparison to prevent timing attacks
  try {
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      console.warn('❌ Invalid webhook signature');
      logWebhookEvent('signature_check', 'rejected', 'Invalid signature');
      return res.status(401).send('Invalid signature');
    }
  } catch (error) {
    // Buffer length mismatch
    console.warn('❌ Signature comparison failed:', error.message);
    logWebhookEvent('signature_check', 'rejected', 'Signature comparison error');
    return res.status(401).send('Invalid signature');
  }

  console.log('✅ Webhook signature verified');
  logWebhookEvent('signature_check', 'success');
  next();
}

// ============================================
// PHASE 6: METRICS ENDPOINT AUTHENTICATION
// ============================================

/**
 * Simple API key validation middleware for metrics endpoint
 * Uses METRICS_API_KEY from environment - prevents public access
 */
function validateMetricsApiKey(req, res, next) {
  const apiKey = req.headers['x-metrics-api-key'] || req.query.api_key;
  const expectedKey = process.env.METRICS_API_KEY;

  // In development, allow access without key (for testing)
  if (process.env.NODE_ENV === 'development' && !expectedKey) {
    return next();
  }

  if (!apiKey || apiKey !== expectedKey) {
    console.warn('⚠️ Unauthorized metrics access attempt');
    return res.status(401).json({ error: 'Unauthorized - valid API key required' });
  }

  next();
}

// Import Fixie proxy for static IP (Phase 5)
const { createProxiedHttpClient } = require('../config/fixie-proxy');

// Create proxied axios instance (singleton)
const proxiedAxios = createProxiedHttpClient({
  timeout: 15000,
  headers: {
    'User-Agent': 'Instagram-Automation-Backend/2.0',
    'X-Client-Info': 'N8N-Integration'
  }
});

// ✅ PHASE 6: Using inline verifyMetaWebhookSignature instead
// Legacy middleware (kept for reference, replaced with enhanced version above)
// const { verifyInstagramWebhookSignature } = require('../middleware/webhook-verification');

// ===== META INSTAGRAM WEBHOOKS (Incoming from Meta) =====

// Webhook verification (Meta will call this)
router.get('/instagram', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  console.log('🔍 Meta Webhook Verification:', { 
    mode, 
    token: token ? 'provided' : 'missing', 
    challenge: challenge ? 'provided' : 'missing' 
  });
  
  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    console.log('✅ Meta webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    console.log('❌ Meta webhook verification failed');
    res.sendStatus(403);
  }
});

// Instagram event handler (Meta sends events here)
// ✅ PHASE 6: Using enhanced signature verification with structured logging
// Middleware will verify signature BEFORE calling the handler function
router.post('/instagram', verifyMetaWebhookSignature, async (req, res) => {
  // ✅ Signature already verified by middleware at this point
  // If we reach here, the webhook is authentic and came from Instagram
  const body = req.body;

  console.log('📨 Instagram webhook event (verified):', JSON.stringify(body, null, 2));
  
  // Validate webhook structure
  if (body.object === 'instagram') {
    try {
      // Process webhook events
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          const field = change.field;
          const value = change.value;

          console.log(`   Processing ${field} event:`, JSON.stringify(value, null, 2));

          // Route different event types to appropriate N8N workflows
          switch(field) {
            case 'comments':
              await forwardToN8N('comment', {
                webhook_url: process.env.N8N_COMMENT_WEBHOOK,
                data: {
                  id: change.value.id || `comment_${Date.now()}`,
                  text: change.value.text,
                  from: {
                    id: change.value.from?.id,
                    username: change.value.from?.username
                  },
                  post_id: change.value.media?.id,
                  timestamp: new Date().toISOString(),
                  type: 'comment'
                }
              });
              break;

            case 'mentions':
              await forwardToN8N('mention', {
                webhook_url: process.env.N8N_COMMENT_WEBHOOK,
                data: {
                  id: change.value.id || `mention_${Date.now()}`,
                  text: change.value.text || 'Mentioned in post',
                  from: {
                    id: change.value.from?.id,
                    username: change.value.from?.username
                  },
                  post_id: change.value.media?.id,
                  timestamp: new Date().toISOString(),
                  type: 'mention'
                }
              });
              break;

            case 'messages':
              await forwardToN8N('dm', {
                webhook_url: process.env.N8N_DM_WEBHOOK,
                data: {
                  id: change.value.id || `dm_${Date.now()}`,
                  message: change.value.text,
                  from: {
                    id: change.value.from?.id,
                    username: change.value.from?.username
                  },
                  timestamp: new Date().toISOString(),
                  type: 'dm'
                }
              });
              break;
          }
        }
      }

      // Acknowledge receipt to Instagram
      res.status(200).send('EVENT_RECEIVED');
    } catch (error) {
      console.error('❌ Error processing webhook event:', error);
      // Still return 200 to Instagram to prevent retries
      res.status(200).send('EVENT_RECEIVED');
    }
  } else {
    console.log('❌ Invalid webhook object:', body.object);
    res.sendStatus(404);
  }
});

// ============================================
// PHASE 6: ENHANCED FORWARD TO N8N WITH RETRY
// ============================================

/**
 * Forwards webhook events to N8N with retry logic and rate limit handling
 * @param {string} eventType - Type of event (comment, mention, dm, order)
 * @param {Object} options - Webhook URL and data payload
 * @returns {Promise<Object>} Result with success status and metadata
 */
async function forwardToN8NWithRetry(eventType, { webhook_url, data }) {
  if (!webhook_url) {
    console.log(`❌ No N8N webhook URL configured for ${eventType}`);
    logWebhookEvent(eventType, 'skipped', 'No webhook URL configured');
    return { success: false, reason: 'no_webhook_url' };
  }

  let lastError = null;

  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      console.log(`📤 [Attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS}] Forwarding ${eventType} to N8N`);

      const startTime = Date.now();
      const response = await proxiedAxios.post(webhook_url, data, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Instagram-Backend-Forwarder/2.0',
          'X-Retry-Attempt': String(attempt + 1)
        },
        timeout: 10000
      });

      const latency = Date.now() - startTime;

      logWebhookEvent(eventType, 'success', null, { latency, attempt: attempt + 1 });
      console.log(`✅ [${latency}ms] Successfully forwarded ${eventType} to N8N`);

      return { success: true, latency, attempts: attempt + 1 };

    } catch (error) {
      lastError = error;

      // Handle rate limiting (429) with longer backoff
      const status = error.response?.status;
      if (status === 429) {
        console.warn(`⚠️ Rate limited (429) - backing off for ${RATE_LIMIT_BACKOFF / 1000}s`);
        logWebhookEvent(eventType, 'rate_limited', 'HTTP 429', { attempt: attempt + 1 });
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_BACKOFF));
        continue; // Retry after longer backoff
      }

      logWebhookEvent(eventType, 'retry', error.message, { attempt: attempt + 1, status });

      if (attempt < MAX_RETRY_ATTEMPTS - 1) {
        const delay = RETRY_DELAYS[attempt];
        console.warn(`⚠️ Attempt ${attempt + 1} failed (${status || 'network error'}), retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  logWebhookEvent(eventType, 'failed', lastError?.message, { attempts: MAX_RETRY_ATTEMPTS });
  console.error(`❌ All ${MAX_RETRY_ATTEMPTS} attempts failed for ${eventType}`);

  return { success: false, error: lastError?.message, attempts: MAX_RETRY_ATTEMPTS };
}

// Legacy alias for backward compatibility (calls new retry version)
async function forwardToN8N(eventType, options) {
  return forwardToN8NWithRetry(eventType, options);
}

// ===== N8N RESPONSE WEBHOOKS (N8N sends responses back to your system) =====

// N8N sends automated responses back
router.post('/n8n-response', (req, res) => {
  const data = req.body;
  console.log('📨 N8N Response received:', JSON.stringify(data, null, 2));
  
  // Broadcast to frontend via real-time cache
  broadcastToFrontend('new_response', data);
  
  res.json({ 
    status: 'received', 
    message: 'Response processed', 
    timestamp: new Date().toISOString() 
  });
});

// N8N sends UGC alerts
router.post('/n8n-ugc', (req, res) => {
  const data = req.body;
  console.log('🌟 N8N UGC Alert received:', JSON.stringify(data, null, 2));
  
  broadcastToFrontend('ugc_alert', data);
  
  res.json({ 
    status: 'received', 
    message: 'UGC alert processed', 
    timestamp: new Date().toISOString() 
  });
});

// N8N sends sales attribution data  
router.post('/n8n-sales', (req, res) => {
  const data = req.body;
  console.log('💰 N8N Sales Attribution received:', JSON.stringify(data, null, 2));
  
  broadcastToFrontend('sales_attribution', data);
  
  res.json({ 
    status: 'received', 
    message: 'Sales attribution logged', 
    timestamp: new Date().toISOString() 
  });
});

// N8N sends content publishing confirmations
router.post('/n8n-content', (req, res) => {
  const data = req.body;
  console.log('📝 N8N Content Published:', JSON.stringify(data, null, 2));
  
  broadcastToFrontend('content_published', data);
  
  res.json({ 
    status: 'received', 
    message: 'Content publication logged', 
    timestamp: new Date().toISOString() 
  });
});

// ===== MANUAL TRIGGER ENDPOINTS (Frontend can trigger N8N workflows) =====

// Trigger content scheduling workflow
router.post('/trigger-content', async (req, res) => {
  const data = req.body;

  try {
    await proxiedAxios.post(process.env.N8N_CONTENT_WEBHOOK, {
      trigger_type: 'manual',
      trigger_source: 'frontend',
      data: data,
      timestamp: new Date().toISOString()
    });

    res.json({ status: 'triggered', message: 'Content workflow started' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to trigger workflow' });
  }
});

// Trigger hub coordination workflow
router.post('/trigger-hub', async (req, res) => {
  const data = req.body;

  try {
    await proxiedAxios.post(process.env.N8N_HUB_WEBHOOK, {
      trigger_type: data.trigger_type || 'manual',
      trigger_source: 'frontend',
      data: data,
      timestamp: new Date().toISOString()
    });

    res.json({ status: 'triggered', message: 'Hub workflow started' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to trigger workflow' });
  }
});

// Send Shopify orders to N8N Sales Attribution
router.post('/shopify-order', async (req, res) => {
  const orderData = req.body;
  
  try {
    await forwardToN8N('order', {
      webhook_url: process.env.N8N_ORDER_WEBHOOK,
      data: orderData
    });
    
    res.json({ status: 'forwarded', message: 'Order sent to attribution workflow' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to process order' });
  }
});

// ===== REAL-TIME FRONTEND COMMUNICATION =====

function broadcastToFrontend(eventType, data) {
  // Initialize global cache if not exists
  if (!global.realtimeCache) {
    global.realtimeCache = [];
  }
  
  // Add event to cache
  global.realtimeCache.push({
    type: eventType,
    data: data,
    timestamp: new Date().toISOString()
  });
  
  // Keep only last 100 events
  if (global.realtimeCache.length > 100) {
    global.realtimeCache.shift();
  }
}

// Frontend polls for real-time updates
router.get('/realtime-updates', (req, res) => {
  const since = req.query.since; // timestamp
  
  if (!global.realtimeCache) {
    return res.json({ events: [], latest_timestamp: null });
  }
  
  let events = global.realtimeCache;
  
  if (since) {
    events = events.filter(event => 
      new Date(event.timestamp) > new Date(since)
    );
  }
  
  res.json({ 
    events: events,
    latest_timestamp: events.length > 0 ? 
      events[events.length - 1].timestamp : null,
    total_cached: global.realtimeCache.length
  });
});

// Health check for N8N integration
router.get('/n8n-status', (req, res) => {
  res.json({
    n8n_webhooks: {
      dm_webhook: process.env.N8N_DM_WEBHOOK ? '✅ Set' : '❌ Not set',
      comment_webhook: process.env.N8N_COMMENT_WEBHOOK ? '✅ Set' : '❌ Not set', 
      order_webhook: process.env.N8N_ORDER_WEBHOOK ? '✅ Set' : '❌ Not set',
      content_webhook: process.env.N8N_CONTENT_WEBHOOK ? '✅ Set' : '❌ Not set',
      hub_webhook: process.env.N8N_HUB_WEBHOOK ? '✅ Set' : '❌ Not set'
    },
    backend_ready: true,
    cloudflare_tunnel: 'https://api.888intelligenceautomation.in',
    environment_variables: {
      webhook_verify_token: process.env.WEBHOOK_VERIFY_TOKEN ? '✅ Set' : '❌ Not set',
      meta_app_secret: process.env.META_APP_SECRET ? '✅ Set' : '❌ Not set'
    },
    timestamp: new Date().toISOString()
  });
});

// Test endpoint to verify routes are working
router.get('/test', (req, res) => {
  res.json({
    message: '✅ Webhook routes are working!',
    available_endpoints: [
      'GET /webhook/instagram (Meta verification)',
      'POST /webhook/instagram (Meta events)',
      'GET /webhook/n8n-status (N8N integration status)',
      'POST /webhook/n8n-response (N8N responses)',
      'POST /webhook/trigger-content (Manual content trigger)',
      'POST /webhook/trigger-hub (Manual hub trigger)',
      'GET /webhook/realtime-updates (Frontend updates)',
      'GET /webhook/metrics (Webhook metrics - auth required)'
    ],
    timestamp: new Date().toISOString()
  });
});

// ============================================
// PHASE 6: AUTH-PROTECTED METRICS ENDPOINT
// ============================================

/**
 * Webhook metrics endpoint - AUTH PROTECTED
 * Returns aggregated metrics, success rates, and recent events
 * @requires X-Metrics-Api-Key header or ?api_key query param
 */
router.get('/metrics', validateMetricsApiKey, (req, res) => {
  const uptime = process.uptime();
  const totalAttempts = webhookMetrics.successCount + webhookMetrics.failureCount;
  const successRate = totalAttempts > 0
    ? (webhookMetrics.successCount / totalAttempts * 100).toFixed(2)
    : 100;

  res.json({
    status: 'healthy',
    metrics: {
      totalSuccess: webhookMetrics.successCount,
      totalFailed: webhookMetrics.failureCount,
      totalRetries: webhookMetrics.retryCount,
      totalRateLimited: webhookMetrics.rateLimitCount,
      successRate: `${successRate}%`,
      lastEventTime: webhookMetrics.lastEventTime,
      eventsInCache: webhookMetrics.events.length,
      maxEventsCache: MAX_EVENTS_CACHE
    },
    recentEvents: webhookMetrics.events.slice(-10),
    uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;