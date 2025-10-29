// backend/routes/webhook.js - COMPLETE N8N INTEGRATION

const express = require('express');
const router = express.Router();
const axios = require('axios');

// ✅ Import webhook signature verification middleware
const { verifyInstagramWebhookSignature } = require('../middleware/webhook-verification');

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
// Middleware will verify signature BEFORE calling the handler function
router.post('/instagram', verifyInstagramWebhookSignature, async (req, res) => {
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

// Helper function to forward events to N8N
async function forwardToN8N(eventType, { webhook_url, data }) {
  if (!webhook_url) {
    console.log(`❌ No N8N webhook URL configured for ${eventType}`);
    return;
  }

  try {
    console.log(`📤 Forwarding ${eventType} to N8N:`, webhook_url);
    
    const response = await axios.post(webhook_url, data, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Instagram-Backend-Forwarder/1.0'
      },
      timeout: 10000 // 10 second timeout
    });

    console.log(`✅ Successfully forwarded ${eventType} to N8N:`, response.status);
  } catch (error) {
    console.error(`❌ Failed to forward ${eventType} to N8N:`, {
      url: webhook_url,
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
  }
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
    await axios.post(process.env.N8N_CONTENT_WEBHOOK, {
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
    await axios.post(process.env.N8N_HUB_WEBHOOK, {
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
    cloudflare_tunnel: 'https://instagram-backend.888intelligenceautomation.in',
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
      'GET /webhook/realtime-updates (Frontend updates)'
    ],
    timestamp: new Date().toISOString()
  });
});

module.exports = router;