const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Enhanced webhook verification for Cloudflare + Meta API
router.get('/instagram', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  console.log('🔍 Meta Webhook Verification (Cloudflare):', {
    mode,
    token: token ? 'provided' : 'missing',
    challenge: challenge ? 'provided' : 'missing',
    cfRay: req.headers['cf-ray'],
    userAgent: req.headers['user-agent']
  });
  
  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    console.log('✅ Meta webhook verified via Cloudflare tunnel');
    res.status(200).send(challenge);
  } else {
    console.log('❌ Meta webhook verification failed');
    console.log(`   Expected: ${process.env.WEBHOOK_VERIFY_TOKEN}`);
    console.log(`   Received: ${token}`);
    res.sendStatus(403);
  }
});

// Enhanced webhook event handler
router.post('/instagram', (req, res) => {
  const body = req.body;
  const signature = req.get('X-Hub-Signature-256');
  
  console.log('📨 Instagram webhook event via Cloudflare:', {
    object: body.object,
    entries: body.entry?.length || 0,
    cfRay: req.headers['cf-ray'],
    timestamp: new Date().toISOString()
  });
  
  // Verify Meta signature if configured
  if (process.env.META_APP_SECRET && signature) {
    const expectedSignature = crypto
      .createHmac('sha256', process.env.META_APP_SECRET)
      .update(JSON.stringify(body))
      .digest('hex');
    
    if (signature !== `sha256=${expectedSignature}`) {
      console.log('❌ Invalid Meta signature via Cloudflare');
      return res.sendStatus(403);
    }
  }
  
  if (body.object === 'instagram') {
    body.entry?.forEach(entry => {
      console.log(`📋 Processing entry ID: ${entry.id}`);
      
      entry.changes?.forEach(change => {
        console.log(`🔄 Event: ${change.field}`, change.value);
        handleInstagramEvent(change.field, change.value);
      });
    });
    
    res.status(200).send('EVENT_RECEIVED');
  } else {
    console.log('❌ Invalid webhook object:', body.object);
    res.sendStatus(404);
  }
});

// Test endpoint for Cloudflare
router.get('/test', (req, res) => {
  res.json({
    message: '🧪 Cloudflare Webhook Test Endpoint',
    tunnel: 'active',
    timestamp: new Date().toISOString(),
    cloudflare: {
      cfRay: req.headers['cf-ray'] || 'not-available',
      country: req.headers['cf-ipcountry'] || 'unknown'
    }
  });
});

function handleInstagramEvent(field, value) {
  switch(field) {
    case 'comments':
      console.log('💬 Comment event:', value);
      break;
    case 'mentions':
      console.log('📢 Mention event:', value);
      break;
    case 'story_insights':
      console.log('📊 Story insight:', value);
      break;
    default:
      console.log('❓ Unhandled event:', field);
  }
}

module.exports = router;