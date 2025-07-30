const express = require('express');
const router = express.Router();

// Webhook verification (GET request)
router.get('/instagram', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  console.log('Webhook verification request:', { mode, token, challenge });
  
  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    console.log('✅ Webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    console.log('❌ Webhook verification failed');
    res.sendStatus(403);
  }
});

// Webhook events handler (POST request)
router.post('/instagram', (req, res) => {
  const body = req.body;
  
  console.log('📨 Webhook event received:', JSON.stringify(body, null, 2));
  
  if (body.object === 'instagram') {
    // Process Instagram webhook events
    body.entry?.forEach(entry => {
      entry.changes?.forEach(change => {
        console.log(`📋 Event: ${change.field}`, change.value);
        
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
            console.log('🔄 Unhandled event type:', change.field);
        }
      });
    });
    
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

// Event handlers
function handleCommentEvent(data) {
  console.log('💬 New comment event:', data);
  // Add your comment handling logic here
}

function handleMentionEvent(data) {
  console.log('📢 New mention event:', data);
  // Add your mention handling logic here
}

function handleStoryInsight(data) {
  console.log('📊 Story insight event:', data);
  // Add your analytics logic here
}

module.exports = router;