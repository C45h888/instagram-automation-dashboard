// backend/server.js - Optimized Server with Direct Supabase Connection
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config({ path: '../.env' });

// Import optimized Supabase configuration
const { 
  initializeSupabase, 
  checkHealth,
  getSupabaseAdmin,
  getConnectionInfo,
  logApiRequest,
  logAudit
} = require('./config/supabase');

const app = express();
const PORT = process.env.PORT || 3001;

// =============================================================================
// CORS CONFIGURATION - PRODUCTION READY
// =============================================================================

const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:5174',
      'https://888intelligenceautomation.in',
      'https://www.888intelligenceautomation.in',
      'https://instagram-backend.888intelligenceautomation.in'
    ];
    
    // Allow requests with no origin (mobile apps, postman, etc)
    if (!origin) return callback(null, true);
    
    // Check if origin is allowed
    if (allowedOrigins.includes(origin) || origin.includes('888intelligenceautomation.in')) {
      callback(null, true);
    } else {
      console.warn(`⚠️  CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Request-ID',
    'X-Client-Info'
  ]
};

app.use(cors(corsOptions));

// =============================================================================
// MIDDLEWARE CONFIGURATION
// =============================================================================

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Request ID middleware
app.use((req, res, next) => {
  req.requestId = require('crypto').randomUUID();
  req.startTime = Date.now();
  res.header('X-Request-ID', req.requestId);
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.url;
  
  // Log request details (excluding sensitive paths)
  if (!url.includes('/health')) {
    console.log(`📥 ${timestamp} [${req.requestId}] ${method} ${url}`);
    
    // Log Cloudflare headers if present
    if (req.headers['cf-ray']) {
      console.log(`   CF-Ray: ${req.headers['cf-ray']}`);
      console.log(`   CF-Country: ${req.headers['cf-ipcountry'] || 'unknown'}`);
    }
  }
  
  // Track API usage (after response)
  const originalSend = res.send;
  res.send = function(data) {
    res.send = originalSend;
    
    // Calculate response time
    const responseTime = Date.now() - req.startTime;
    
    // Log API request to database (async, non-blocking)
    if (!url.includes('/health') && !url.includes('/test')) {
      logApiRequest(
        req.user?.id || null,
        url,
        method,
        responseTime,
        res.statusCode,
        res.statusCode < 400
      ).catch(err => console.error('Failed to log API request:', err));
    }
    
    return res.send(data);
  };
  
  next();
});

// =============================================================================
// HEALTH CHECK ENDPOINTS - CRITICAL FOR MONITORING
// =============================================================================

// Basic health check (no database required)
app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    service: 'instagram-automation-backend',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    server: {
      port: PORT,
      platform: process.platform,
      nodeVersion: process.version,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB'
      }
    }
  };
  
  res.status(200).json(health);
});

// Database health check endpoint
app.get('/health/database', async (req, res) => {
  try {
    const dbHealth = await checkHealth();
    const connectionInfo = getConnectionInfo();
    
    res.status(dbHealth.healthy ? 200 : 503).json({
      database: {
        healthy: dbHealth.healthy,
        responseTime: dbHealth.responseTime,
        url: connectionInfo?.url,
        environment: connectionInfo?.environment,
        lastConnected: connectionInfo?.timestamp,
        error: dbHealth.error
      },
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  } catch (error) {
    res.status(503).json({
      database: {
        healthy: false,
        error: error.message
      },
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  }
});

// Complete system status endpoint
app.get('/status', async (req, res) => {
  const status = {
    operational: true,
    timestamp: new Date().toISOString(),
    services: {
      backend: 'operational',
      database: 'checking...',
      authentication: 'operational',
      tunnels: {
        api: 'operational', // Tunnel A is always operational if this responds
        database: 'deprecated' // Tunnel B removed
      }
    },
    configuration: {
      supabase_configured: !!process.env.SUPABASE_SERVICE_KEY,
      encryption_enabled: !!process.env.ENCRYPTION_KEY,
      n8n_webhooks_configured: !!process.env.N8N_BASE_URL,
      static_ip_configured: !!process.env.STATIC_IP // For future use
    }
  };
  
  // Check database status
  try {
    const dbHealth = await checkHealth();
    status.services.database = dbHealth.healthy ? 'operational' : 'degraded';
  } catch (error) {
    status.services.database = 'unavailable';
    status.operational = false;
  }
  
  res.status(status.operational ? 200 : 503).json(status);
});

// =============================================================================
// ROUTE IMPORTS
// =============================================================================

// Import routes with error handling
try {
  const webhookRoutes = require('./routes/webhook');
  app.use('/webhook', webhookRoutes);
  console.log('✅ Webhook routes loaded');
} catch (error) {
  console.error('❌ Failed to load webhook routes:', error.message);
}

try {
  const legalRoutes = require('./routes/legal');
  app.use('/legal', legalRoutes);
  console.log('✅ Legal routes loaded');
} catch (error) {
  console.error('❌ Failed to load legal routes:', error.message);
}

try {
  const testRoutes = require('./routes/test');
  app.use('/api/test', testRoutes);
  console.log('✅ Test routes loaded');
} catch (error) {
  console.warn('⚠️  Test routes not available:', error.message);
}

// =============================================================================
// ROOT AND API DOCUMENTATION
// =============================================================================

app.get('/', (req, res) => {
  res.json({
    service: 'Instagram Automation Backend',
    version: '2.0.0',
    architecture: 'Direct Supabase Connection with Static IP Whitelisting',
    status: 'operational',
    documentation: '/api',
    health: '/health',
    timestamp: new Date().toISOString()
  });
});

app.get('/api', (req, res) => {
  res.json({
    title: 'Instagram Automation Backend API',
    version: '2.0.0',
    description: 'Optimized backend with direct Supabase connection',
    architecture: {
      api_tunnel: 'instagram-backend.888intelligenceautomation.in',
      database: 'Direct connection to Supabase (uromexjprcrjfmhkmgxa.supabase.co)',
      security: 'Static IP whitelisting on Supabase firewall',
      removed: 'Database tunnel (Tunnel B) - eliminated due to proxy issues'
    },
    endpoints: {
      health: {
        '/health': 'Basic health check',
        '/health/database': 'Database connection status',
        '/status': 'Complete system status'
      },
      webhooks: {
        '/webhook/instagram': 'Instagram webhook endpoint',
        '/webhook/n8n-status': 'N8N integration status'
      },
      testing: {
        '/api/test': 'Test suite overview',
        '/api/test/supabase': 'Database connection test',
        '/api/test/integration': 'Full integration test'
      },
      legal: {
        '/legal/privacy': 'Privacy policy',
        '/legal/terms': 'Terms of service'
      }
    },
    timestamp: new Date().toISOString()
  });
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    availableEndpoints: ['/health', '/api', '/status'],
    timestamp: new Date().toISOString(),
    requestId: req.requestId
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('💥 Server Error:', {
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.url,
    method: req.method,
    requestId: req.requestId
  });
  
  // Log error to audit log
  logAudit('server_error', null, {
    action: 'error',
    resource_type: 'server',
    details: {
      error: err.message,
      url: req.url,
      method: req.method
    },
    success: false
  }, req).catch(console.error);
  
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    requestId: req.requestId,
    timestamp: new Date().toISOString()
  });
});

// =============================================================================
// SERVER STARTUP WITH RESILIENT DATABASE CONNECTION
// =============================================================================

async function startServer() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 Instagram Automation Backend - Starting...');
  console.log('='.repeat(60));
  
  // Display configuration
  console.log('\n📋 Configuration:');
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Port: ${PORT}`);
  console.log(`   Supabase URL: ${process.env.SUPABASE_URL || 'Not configured'}`);
  console.log(`   Service Key: ${process.env.SUPABASE_SERVICE_KEY ? '✅ Configured' : '❌ Missing'}`);
  console.log(`   Anon Key: ${process.env.SUPABASE_ANON_KEY ? '✅ Configured' : '❌ Missing'}`);
  console.log(`   Encryption: ${process.env.ENCRYPTION_KEY ? '✅ Enabled' : '⚠️  Disabled'}`);
  
  // Initialize Supabase with resilient connection
  console.log('\n🔄 Initializing Supabase connection...');
  
  try {
    const { supabaseAdmin, connectionInfo } = await initializeSupabase({
      retryAttempts: process.env.NODE_ENV === 'production' ? 5 : 3,
      retryDelay: 5000,
      timeout: 10000
    });
    
    if (supabaseAdmin) {
      console.log('\n✅ Database connection established');
      console.log(`   Connected to: ${connectionInfo.url}`);
      console.log(`   Connection established at: ${connectionInfo.timestamp}`);
      
      // Verify with a test query
      const admin = getSupabaseAdmin();
      if (admin) {
        const { count, error } = await admin
          .from('user_profiles')
          .select('*', { count: 'exact', head: true });
        
        if (!error) {
          console.log(`   Database verified: ${count || 0} user profiles`);
        }
      }
    } else {
      console.warn('\n⚠️  Starting without database connection');
      console.warn('   Database features will be unavailable');
    }
  } catch (error) {
    console.error('\n❌ Database initialization failed:', error.message);
    
    // In production, this is critical
    if (process.env.NODE_ENV === 'production') {
      console.error('💥 Cannot start server in production without database');
      process.exit(1);
    } else {
      console.warn('⚠️  Continuing in development mode without database');
    }
  }
  
  // Start Express server
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('\n' + '='.repeat(60));
    console.log('✅ Server Successfully Started!');
    console.log('='.repeat(60));
    console.log('\n📍 Access Points:');
    console.log(`   Local: http://localhost:${PORT}`);
    console.log(`   Tunnel: https://instagram-backend.888intelligenceautomation.in`);
    console.log('\n🔗 Key Endpoints:');
    console.log('   Health: /health');
    console.log('   Database: /health/database');
    console.log('   Status: /status');
    console.log('   API Docs: /api');
    console.log('\n🔐 Security:');
    console.log('   CORS: Configured for allowed origins');
    console.log('   Database: Direct connection with IP whitelisting');
    console.log('   Encryption: ' + (process.env.ENCRYPTION_KEY ? 'Enabled' : 'Disabled'));
    console.log('\n' + '='.repeat(60) + '\n');
  });
  
  // Graceful shutdown handling
  const gracefulShutdown = async (signal) => {
    console.log(`\n📴 ${signal} received, shutting down gracefully...`);
    
    server.close(async () => {
      console.log('🔒 HTTP server closed');
      
      // Close database connections
      try {
        const admin = getSupabaseAdmin();
        if (admin) {
          // Supabase client doesn't need explicit closing
          console.log('🔒 Database connections cleaned up');
        }
      } catch (error) {
        console.error('Error during cleanup:', error);
      }
      
      console.log('👋 Server shutdown complete');
      process.exit(0);
    });
    
    // Force shutdown after 10 seconds
    setTimeout(() => {
      console.error('⚠️  Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };
  
  // Handle shutdown signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  
  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
  });
}

// Start the server
startServer().catch((error) => {
  console.error('💥 Fatal error during startup:', error);
  process.exit(1);
});