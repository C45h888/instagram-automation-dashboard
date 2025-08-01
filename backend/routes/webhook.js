const express = require('express');
const router = express.Router();

// Webhook verification (GET request) - Required by Meta
router.get('/instagram', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  console.log('🔍 Webhook verification request:', { mode, token, challenge });
  
  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    console.log('✅ Webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    console.log('❌ Webhook verification failed - token mismatch');
    console.log('Expected:', process.env.WEBHOOK_VERIFY_TOKEN);
    console.log('Received:', token);
    res.sendStatus(403);
  }
});

// Webhook events handler (POST request) - Receives Instagram events
router.post('/instagram', (req, res) => {
  const body = req.body;
  
  console.log('📨 Webhook event received:', JSON.stringify(body, null, 2));
  
  if (body.object === 'instagram') {
    // Process Instagram webhook events
    body.entry?.forEach(entry => {
      console.log(`📋 Processing entry ID: ${entry.id}`);
      
      entry.changes?.forEach(change => {
        console.log(`🔄 Event type: ${change.field}`, change.value);
        
        // Handle different event types
        switch(change.field) {
          case 'comments':
            handleCommentEvent(change.value);
            break;
          case 'mentions':
            handleMentionEvent(change.value);
            break;
          case 'story_insights':
            handleStoryInsight(change.value);
            break;
          default:
            console.log('❓ Unhandled event type:', change.field);
        }
      });
    });
    
    res.status(200).send('EVENT_RECEIVED');
  } else {
    console.log('❌ Invalid webhook object:', body.object);
    res.sendStatus(404);
  }
});

// Test endpoint for development
router.get('/test', (req, res) => {
  res.json({
    message: '🧪 Webhook test endpoint',
    verify_token: process.env.WEBHOOK_VERIFY_TOKEN ? '✅ Set' : '❌ Not set',
    timestamp: new Date().toISOString()
  });
});

// Event handlers
function handleCommentEvent(data) {
  console.log('💬 Processing comment event:', data);
  // TODO: Add your comment automation logic here
  // Example: Auto-reply to comments, moderate content, etc.
}

function handleMentionEvent(data) {
  console.log('📢 Processing mention event:', data);
  // TODO: Add your mention handling logic here
  // Example: Thank users for mentions, repost stories, etc.
}

function handleStoryInsight(data) {
  console.log('📊 Processing story insight:', data);
  // TODO: Add your analytics logic here
  // Example: Track story performance, save metrics to database
}

// N8N Webhook Routes - Send data TO N8N workflows
router.post('/automation-status', (req, res) => {
  const data = req.body;
  console.log('🤖 Automation status update:', data);
  
  // Process automation status change
  // This could trigger N8N workflows for automation monitoring
  
  res.json({ status: 'received', message: 'Automation status updated' });
});

router.post('/content-published', (req, res) => {
  const data = req.body;
  console.log('📝 Content published:', data);
  
  // Process published content event
  // This could trigger N8N workflows for content promotion
  
  res.json({ status: 'received', message: 'Content publication logged' });
});

router.post('/engagement-update', (req, res) => {
  const data = req.body;
  console.log('❤️ Engagement update:', data);
  
  // Process engagement metrics
  // This could trigger N8N workflows for engagement analysis
  
  res.json({ status: 'received', message: 'Engagement metrics updated' });
});

router.get('/analytics-data', (req, res) => {
  console.log('📊 Analytics data requested');
  
  // Return analytics data for N8N workflows
  const analyticsData = {
    followers: 1250,
    engagement_rate: 4.2,
    posts_today: 3,
    comments_today: 15,
    last_updated: new Date().toISOString()
  };
  
  res.json(analyticsData);
});

// ===== N8N WORKFLOW OUTPUT WEBHOOKS =====
// These receive data FROM N8N workflows back to your system

// 1. N8N sends processed responses back
router.post('/n8n-response', (req, res) => {
  const data = req.body;
  console.log('📨 N8N Response received:', JSON.stringify(data, null, 2));
  
  // Data structure from N8N:
  // {
  //   message_id: "msg_123",
  //   response_text: "Thank you for your message...",
  //   message_type: "dm" | "comment",
  //   user_id: "@username",
  //   sentiment: "positive" | "negative" | "neutral",
  //   priority: "high" | "medium" | "low",
  //   auto_responded: true,
  //   timestamp: "2025-07-30T..."
  // }
  
  // Broadcast to frontend via real-time cache
  broadcastToFrontend('new_response', data);
  
  res.json({ status: 'received', message: 'Response processed', timestamp: new Date().toISOString() });
});

// 2. N8N sends metrics and tracking data
router.post('/n8n-metrics', (req, res) => {
  const data = req.body;
  console.log('📊 N8N Metrics received:', JSON.stringify(data, null, 2));
  
  // Data structure from N8N:
  // {
  //   interaction_id: "int_123",
  //   response_time: 1200, // milliseconds
  //   message_classification: "question" | "complaint" | "compliment",
  //   auto_response_success: true,
  //   user_satisfaction_predicted: 0.85,
  //   timestamp: "2025-07-30T..."
  // }
  
  // Update frontend metrics in real-time
  broadcastToFrontend('metrics_update', data);
  
  res.json({ status: 'received', message: 'Metrics logged', timestamp: new Date().toISOString() });
});

// 3. N8N sends urgent alerts (high priority messages)
router.post('/n8n-alerts', (req, res) => {
  const data = req.body;
  console.log('🚨 N8N Alert received:', JSON.stringify(data, null, 2));
  
  // Data structure from N8N:
  // {
  //   alert_type: "urgent_message" | "negative_sentiment" | "escalation_needed",
  //   message_content: "Original message text",
  //   user_id: "@username",
  //   priority_score: 0.95,
  //   suggested_action: "human_review" | "immediate_response",
  //   timestamp: "2025-07-30T..."
  // }
  
  // Send real-time alert to frontend
  broadcastToFrontend('urgent_alert', data);
  
  res.json({ status: 'received', message: 'Alert processed', timestamp: new Date().toISOString() });
});

// 4. N8N requests current automation status
router.get('/n8n-status', (req, res) => {
  console.log('📋 N8N Status check requested');
  
  // Return current system status for N8N decisions
  const systemStatus = {
    automations_active: true,
    response_mode: "auto", // "auto" | "manual" | "hybrid"
    rate_limit_status: "ok", // "ok" | "warning" | "exceeded"
    queue_length: 5,
    last_response_time: 850,
    available_agents: 2,
    timestamp: new Date().toISOString()
  };
  
  res.json(systemStatus);
});

// 5. Frontend polls for real-time updates
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
    latest_timestamp: events.length > 0 ? events[events.length - 1].timestamp : null,
    total_events: events.length
  });
});

// ===== UTILITY FUNCTION FOR REAL-TIME UPDATES =====
function broadcastToFrontend(eventType, data) {
  // Initialize global cache if it doesn't exist
  if (!global.realtimeCache) {
    global.realtimeCache = [];
  }
  
  // Add new event to cache
  const event = {
    type: eventType,
    data: data,
    timestamp: new Date().toISOString(),
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
  };
  
  global.realtimeCache.push(event);
  
  // Keep only last 100 events to prevent memory issues
  if (global.realtimeCache.length > 100) {
    global.realtimeCache = global.realtimeCache.slice(-100);
  }
  
  console.log(`📡 Broadcasting to frontend: ${eventType}`, data);
  console.log(`📈 Cache now has ${global.realtimeCache.length} events`);
}

module.exports = router;