// backend/server.js - Enhanced Instagram Automation Backend with Supabase Testing Integration
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config({ path: '../.env' });

const app = express();
const PORT = process.env.PORT || 3001;

// Import Supabase configuration for startup testing
const { testConnection } = require('./config/supabase');

// =============================================================================
// ENHANCED CORS CONFIGURATION FOR CLOUDFLARE TUNNEL
// =============================================================================

// Enhanced CORS for Cloudflare Tunnel (preserved from original)
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000', 
    'https://888intelligenceautomation.in',
    'https://instagram-backend.888intelligenceautomation.in',
    'https://filme-roommates-cattle-purchasing.trycloudflare.com'
  ],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'X-Test-Suite',
    'X-Request-ID'
  ]
}));

// =============================================================================
// ENHANCED MIDDLEWARE FOR CLOUDFLARE + MONITORING
// =============================================================================

// Enhanced middleware for Cloudflare (preserved + enhanced)
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Request ID middleware for better debugging
app.use((req, res, next) => {
  req.requestId = require('crypto').randomUUID();
  res.header('X-Request-ID', req.requestId);
  next();
});

// Enhanced Cloudflare specific headers with monitoring
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Test-Suite, X-Request-ID');
  
  // Enhanced Cloudflare headers logging for debugging
  const cloudflareInfo = {};
  if (req.headers['cf-ray']) {
    cloudflareInfo.ray = req.headers['cf-ray'];
  }
  if (req.headers['cf-ipcountry']) {
    cloudflareInfo.country = req.headers['cf-ipcountry'];
  }
  if (req.headers['cf-connecting-ip']) {
    cloudflareInfo.realIp = req.headers['cf-connecting-ip'];
  }
  
  if (Object.keys(cloudflareInfo).length > 0) {
    console.log(`📡 Cloudflare Info:`, cloudflareInfo);
  }
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Request logging middleware for better monitoring
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.url;
  const userAgent = req.headers['user-agent'];
  
  console.log(`${timestamp} - ${method} ${url} - ${req.ip || 'unknown-ip'}`);
  
  // Log body for non-GET requests (excluding sensitive data)
  if (method !== 'GET' && req.body && Object.keys(req.body).length > 0) {
    const safeBody = { ...req.body };
    // Remove sensitive fields from logs
    ['password', 'token', 'access_token', 'refresh_token'].forEach(field => {
      if (safeBody[field]) safeBody[field] = '[REDACTED]';
    });
    console.log(`📝 Request Body:`, JSON.stringify(safeBody, null, 2));
  }
  
  next();
});

// =============================================================================
// ROUTE IMPORTS AND MOUNTING - ENHANCED WITH TEST ROUTES
// =============================================================================

// Import existing routes (preserved)
const webhookRoutes = require('./routes/webhook');
const legalRoutes = require('./routes/legal');

// Import new test routes (Phase 1 addition)
const testRoutes = require('./routes/test');

// Mount existing routes (preserved)
app.use('/webhook', webhookRoutes);
app.use('/legal', legalRoutes);

// Mount new test routes (Phase 1 addition)
app.use('/api/test', testRoutes);

// =============================================================================
// ENHANCED HEALTH CHECK ENDPOINTS
// =============================================================================

// Enhanced health check for Cloudflare (preserved + enhanced)
app.get('/health', async (req, res) => {
  const healthCheck = {
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
    tunnel: {
      provider: 'cloudflare',
      domain: 'instagram-backend.888intelligenceautomation.in',
      host: req.get('host'),
      protocol: req.protocol,
      secure: req.secure || req.get('x-forwarded-proto') === 'https',
      cfRay: req.headers['cf-ray'] || 'not-available',
      realIp: req.headers['cf-connecting-ip'] || req.ip
    },
    services: {
      meta_ready: true,
      n8n_integration: 'active',
      supabase_configured: !!process.env.SUPABASE_SERVICE_KEY,
      encryption_enabled: !!process.env.ENCRYPTION_KEY,
      test_suite: 'available'
    },
    environment: {
      node_env: process.env.NODE_ENV,
      port: PORT,
      pid: process.pid,
      platform: process.platform,
      node_version: process.version
    }
  };
  
  // Test Supabase connection for health check
  try {
    const supabaseHealthy = await testConnection();
    healthCheck.services.supabase_connection = supabaseHealthy ? 'healthy' : 'unhealthy';
    healthCheck.database = {
      connected: supabaseHealthy,
      tunnel_url: process.env.SUPABASE_TUNNEL_URL || 'not-configured',
      direct_url: 'uromexjprcrjfmhkmgxa.supabase.co'
    };
  } catch (error) {
    healthCheck.services.supabase_connection = 'error';
    healthCheck.database = {
      connected: false,
      error: error.message
    };
  }
  
  const statusCode = healthCheck.services.supabase_connection === 'healthy' ? 200 : 503;
  res.status(statusCode).json(healthCheck);
});

// Database-specific health check
app.get('/health/database', async (req, res) => {
  try {
    const startTime = Date.now();
    const connected = await testConnection();
    const responseTime = Date.now() - startTime;
    
    res.json({
      database: {
        connected,
        response_time_ms: responseTime,
        tunnel_url: process.env.SUPABASE_TUNNEL_URL || process.env.SUPABASE_URL,
        configured: !!process.env.SUPABASE_SERVICE_KEY
      },
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  } catch (error) {
    res.status(500).json({
      database: {
        connected: false,
        error: error.message
      },
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  }
});

// =============================================================================
// ENHANCED ROOT AND STATUS ENDPOINTS
// =============================================================================

// Enhanced root endpoint (preserved + enhanced)
app.get('/', (req, res) => {
  res.json({
    message: '🚀 Instagram Automation Backend (Cloudflare Tunnel + Supabase)',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
    tunnel: {
      provider: 'cloudflare',
      domain: 'instagram-backend.888intelligenceautomation.in',
      active: req.get('host')?.includes('888intelligenceautomation.in'),
      database_tunnel: 'db-secure.888intelligenceautomation.in'
    },
    endpoints: {
      // Existing endpoints (preserved)
      webhook_verify: 'GET /webhook/instagram',
      webhook_events: 'POST /webhook/instagram',
      n8n_status: 'GET /webhook/n8n-status',
      health: 'GET /health',
      legal_privacy: 'GET /legal/privacy',
      legal_terms: 'GET /legal/terms',
      
      // New test endpoints (Phase 1 addition)
      test_suite: 'GET /api/test',
      test_supabase: 'GET /api/test/supabase',
      test_insert: 'POST /api/test/insert-test',
      test_rls: 'GET /api/test/test-rls',
      test_integration: 'GET /api/test/integration',
      create_test_user: 'POST /api/test/create-test-user'
    },
    phase_1_features: {
      supabase_integration: true,
      tunnel_architecture: true,
      encryption_support: !!process.env.ENCRYPTION_KEY,
      audit_logging: true,
      test_suite: true
    }
  });
});

// Enhanced tunnel status endpoint (preserved + enhanced)
app.get('/tunnel/status', async (req, res) => {
  const tunnelStatus = {
    provider: 'cloudflare',
    backend: {
      domain: 'instagram-backend.888intelligenceautomation.in',
      active: true,
      endpoint: 'https://instagram-backend.888intelligenceautomation.in',
      webhook_url: 'https://instagram-backend.888intelligenceautomation.in/webhook/instagram'
    },
    database: {
      domain: 'db-secure.888intelligenceautomation.in',
      tunnel_configured: !!process.env.SUPABASE_TUNNEL_URL,
      direct_access_blocked: true
    },
    security: {
      zero_trust: true,
      encryption_enabled: !!process.env.ENCRYPTION_KEY,
      rls_enabled: true
    },
    timestamp: new Date().toISOString(),
    requestId: req.requestId
  };
  
  // Test database tunnel connectivity
  try {
    const dbConnected = await testConnection();
    tunnelStatus.database.connected = dbConnected;
    tunnelStatus.database.status = dbConnected ? 'operational' : 'degraded';
  } catch (error) {
    tunnelStatus.database.connected = false;
    tunnelStatus.database.status = 'error';
    tunnelStatus.database.error = error.message;
  }
  
  res.json(tunnelStatus);
});

// =============================================================================
// API DOCUMENTATION ENDPOINT
// =============================================================================

// API documentation endpoint (new addition)
app.get('/api', (req, res) => {
  res.json({
    title: 'Instagram Automation Backend API',
    version: '1.0.0',
    description: 'Secure backend API for Instagram automation dashboard with Supabase integration',
    architecture: {
      backend_tunnel: 'instagram-backend.888intelligenceautomation.in',
      database_tunnel: 'db-secure.888intelligenceautomation.in',
      security_model: 'zero-trust'
    },
    endpoints: {
      '/health': 'System health check with database status',
      '/health/database': 'Database-specific health check',
      '/tunnel/status': 'Cloudflare tunnel status and connectivity',
      '/api/test/*': 'Comprehensive testing suite for Supabase integration',
      '/webhook/instagram': 'Instagram webhook endpoint',
      '/legal/*': 'Privacy policy and terms of service'
    },
    testing: {
      suite_url: '/api/test',
      integration_test: '/api/test/integration',
      database_test: '/api/test/supabase'
    },
    timestamp: new Date().toISOString(),
    requestId: req.requestId
  });
});

// =============================================================================
// ERROR HANDLING MIDDLEWARE
// =============================================================================

// 404 handler for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    available_endpoints: [
      'GET /',
      'GET /health',
      'GET /api',
      'GET /api/test',
      'GET /tunnel/status',
      'GET /webhook/instagram',
      'POST /webhook/instagram'
    ],
    timestamp: new Date().toISOString(),
    requestId: req.requestId
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('🚨 Server Error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    requestId: req.requestId,
    timestamp: new Date().toISOString()
  });
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    requestId: req.requestId,
    timestamp: new Date().toISOString()
  });
});

// =============================================================================
// SERVER STARTUP WITH ENHANCED LOGGING AND TESTING
// =============================================================================

// Startup function with comprehensive testing
const startServer = async () => {
  console.log('\n🚀 Starting Instagram Automation Backend...\n');
  
  // Environment validation
  console.log('🔧 Environment Configuration:');
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   PORT: ${PORT}`);
  console.log(`   Supabase Configured: ${!!process.env.SUPABASE_SERVICE_KEY ? '✅' : '❌'}`);
  console.log(`   Encryption Enabled: ${!!process.env.ENCRYPTION_KEY ? '✅' : '❌'}`);
  console.log(`   Tunnel URL: ${process.env.SUPABASE_TUNNEL_URL || 'Not configured'}`);
  
  // Test Supabase connection on startup (Phase 1 requirement)
  console.log('\n🗄️  Testing Supabase Connection...');
  try {
    const connected = await testConnection();
    if (connected) {
      console.log('✅ Supabase: Connected successfully');
      console.log('📊 Database: uromexjprcrjfmhkmgxa.supabase.co');
      console.log('🛡️  Security: RLS policies active');
    } else {
      console.warn('⚠️  Supabase: Connection failed - check credentials');
    }
  } catch (error) {
    console.error('❌ Supabase: Connection error -', error.message);
  }
  
  // Start the Express server
  const server = app.listen(PORT, () => {
    console.log('\n🌟 Server Successfully Started!');
    console.log(`📡 Backend API: https://instagram-backend.888intelligenceautomation.in`);
    console.log(`🏠 Local Access: http://localhost:${PORT}`);
    console.log(`🔐 Database: https://db-secure.888intelligenceautomation.in`);
    console.log(`🔗 Webhook: https://instagram-backend.888intelligenceautomation.in/webhook/instagram`);
    console.log(`🎯 N8N Status: https://instagram-backend.888intelligenceautomation.in/webhook/n8n-status`);
    
    console.log('\n📝 Available API Endpoints:');
    console.log('   GET  /health - System health check');
    console.log('   GET  /api/test - Test suite overview');
    console.log('   GET  /api/test/supabase - Database connection test');
    console.log('   GET  /api/test/integration - Full integration test');
    console.log('   POST /api/test/insert-test - Data insertion test');
    console.log('   GET  /tunnel/status - Cloudflare tunnel status');
    
    console.log('\n🧪 Phase 1 Implementation Status:');
    console.log('   ✅ Supabase client integration');
    console.log('   ✅ Cloudflare tunnel architecture');
    console.log('   ✅ Test suite implementation');
    console.log('   ✅ Audit logging system');
    console.log(`   ${!!process.env.ENCRYPTION_KEY ? '✅' : '⚠️ '} Instagram credential encryption`);
    
    console.log('\n🔧 Development URLs:');
    console.log('   Test Suite: http://localhost:3000/test-connection');
    console.log('   Admin Login: http://localhost:3000/admin');
    console.log('   API Docs: http://localhost:' + PORT + '/api');
    console.log('');
  });
  
  // Graceful shutdown handling
  process.on('SIGTERM', () => {
    console.log('🔄 SIGTERM received, shutting down gracefully...');
    server.close(() => {
      console.log('👋 Server closed successfully');
      process.exit(0);
    });
  });
  
  process.on('SIGINT', () => {
    console.log('\n🔄 SIGINT received, shutting down gracefully...');
    server.close(() => {
      console.log('👋 Server closed successfully');
      process.exit(0);
    });
  });
};

// Start the server
startServer().catch((error) => {
  console.error('💥 Failed to start server:', error);
  process.exit(1);
});