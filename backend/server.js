const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://instagram-backend.888intelligenceautomation.in',
    process.env.FRONTEND_URL
  ],
  credentials: true
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Trust proxy for Cloudflare
app.set('trust proxy', true);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Instagram Automation Backend is running',
    timestamp: new Date().toISOString(),
    port: PORT,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Instagram Automation Dashboard API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      webhook: '/webhook/*',
      api: '/api/*'
    }
  });
});

// Meta Instagram Webhook Routes
app.get('/webhook/instagram', (req, res) => {
  const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'instagram_automation_cf_token_2024';
  
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  console.log('Webhook verification request:', { mode, token, challenge });
  
  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('✅ Webhook verified successfully');
      res.status(200).send(challenge);
    } else {
      console.log('❌ Webhook verification failed - token mismatch');
      res.sendStatus(403);
    }
  } else {
    console.log('❌ Webhook verification failed - missing parameters');
    res.sendStatus(400);
  }
});

// Handle Instagram webhook events
app.post('/webhook/instagram', (req, res) => {
  console.log('📨 Instagram webhook event received:', req.body);
  
  // Process Instagram webhook data here
  const body = req.body;
  
  if (body.object === 'instagram') {
    body.entry?.forEach(entry => {
      console.log('Processing entry:', entry);
      
      // Handle different event types
      if (entry.changes) {
        entry.changes.forEach(change => {
          console.log('Change detected:', change.field, change.value);
        });
      }
    });
    
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

// API Routes
app.get('/api/status', (req, res) => {
  res.json({
    server: 'running',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    tunnel: 'https://instagram-backend.888intelligenceautomation.in'
  });
});

// Test endpoint for tunnel connectivity
app.get('/test/tunnel', (req, res) => {
  res.json({
    message: '🎉 Cloudflare tunnel is working!',
    timestamp: new Date().toISOString(),
    headers: req.headers,
    ip: req.ip,
    cloudflare: {
      connected: true,
      url: 'https://instagram-backend.888intelligenceautomation.in'
    }
  });
});

// Automation status endpoint
app.post('/webhook/automation-status', (req, res) => {
  console.log('📊 Automation status update:', req.body);
  res.json({ status: 'received', data: req.body });
});

// Content published endpoint
app.post('/webhook/content-published', (req, res) => {
  console.log('📸 Content published:', req.body);
  res.json({ status: 'processed', data: req.body });
});

// Engagement update endpoint
app.post('/webhook/engagement-update', (req, res) => {
  console.log('❤️ Engagement update:', req.body);
  res.json({ status: 'processed', data: req.body });
});

// Analytics data endpoint
app.get('/webhook/analytics-data', (req, res) => {
  res.json({
    analytics: {
      followers: 1234,
      posts: 56,
      engagement_rate: 4.2,
      last_updated: new Date().toISOString()
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.originalUrl,
    message: 'The requested endpoint does not exist'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Instagram Automation Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 Cloudflare tunnel: https://instagram-backend.888intelligenceautomation.in`);
  console.log(`🔗 Local development: http://localhost:${PORT}`);
  
  // Log environment info
  console.log('\n📋 Environment Info:');
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   WEBHOOK_VERIFY_TOKEN: ${process.env.WEBHOOK_VERIFY_TOKEN ? '✅ Set' : '❌ Missing'}`);
  console.log(`   PORT: ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  process.exit(0);
});