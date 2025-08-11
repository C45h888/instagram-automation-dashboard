const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config({ path: '../.env' });

const app = express();
const PORT = process.env.PORT || 3001;

// Enhanced CORS for Cloudflare Tunnel
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000', 
    'https://888intelligenceautomation.in',
    'https://instagram-backend.888intelligenceautomation.in',
    'https://filme-roommates-cattle-purchasing.trycloudflare.com'
  ],
  credentials: true,
  optionsSuccessStatus: 200
}));

// Enhanced middleware for Cloudflare
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Cloudflare specific headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  
  // Log Cloudflare headers for debugging
  if (req.headers['cf-ray']) {
    console.log('📡 Cloudflare Ray ID:', req.headers['cf-ray']);
  }
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// ===== IMPORT AND MOUNT WEBHOOK ROUTES =====
const webhookRoutes = require('./routes/webhook');
app.use('/webhook', webhookRoutes);

// Enhanced health check for Cloudflare
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    uptime: process.uptime(),
    tunnel: {
      provider: 'cloudflare',
      domain: 'instagram-backend.888intelligenceautomation.in',
      host: req.get('host'),
      protocol: req.protocol,
      secure: req.secure || req.get('x-forwarded-proto') === 'https',
      cfRay: req.headers['cf-ray'] || 'not-available'
    },
    meta_ready: true,
    n8n_integration: 'active',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: '🚀 Instagram Automation Backend (Cloudflare Tunnel)',
    timestamp: new Date().toISOString(),
    tunnel: {
      provider: 'cloudflare',
      domain: 'instagram-backend.888intelligenceautomation.in',
      active: req.get('host')?.includes('888intelligenceautomation.in')
    },
    endpoints: {
      webhook_verify: 'GET /webhook/instagram',
      webhook_events: 'POST /webhook/instagram',
      n8n_status: 'GET /webhook/n8n-status',
      health: 'GET /health'
    }
  });
});

// Tunnel status endpoint
app.get('/tunnel/status', (req, res) => {
  res.json({
    provider: 'cloudflare',
    domain: 'instagram-backend.888intelligenceautomation.in',
    active: true,
    endpoint: 'https://instagram-backend.888intelligenceautomation.in',
    webhook_url: 'https://instagram-backend.888intelligenceautomation.in/webhook/instagram'
  });
});

app.listen(PORT, () => {
  console.log(`🌟 Server running on port ${PORT}`);
  console.log(`📡 Cloudflare tunnel ready: https://instagram-backend.888intelligenceautomation.in`);
  console.log(`🔗 Webhook endpoint: https://instagram-backend.888intelligenceautomation.in/webhook/instagram`);
  console.log(`🎯 N8N Status: https://instagram-backend.888intelligenceautomation.in/webhook/n8n-status`);
});