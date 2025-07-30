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

module.exports = router;