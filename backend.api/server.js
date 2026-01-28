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

// Import Fixie Static IP Proxy (Phase 5)
const {
  initializeFixieProxy,
  validateProxyConnection,
  getProxyHealth
} = require('./config/fixie-proxy');

const app = express();
const PORT = process.env.PORT || 3001;

// =============================================================================
// CORS CONFIGURATION - PRODUCTION READY (IMPROVED)
// =============================================================================
// Key improvements:
// 1. Filter empty/undefined values from origins array (safety net)
// 2. Pre-flight wildcard handler for instant OPTIONS responses
// 3. Environment variable support for dynamic origin configuration

// Build origins array with production URLs only
// NO LOCALHOST - prevents production builds from accepting localhost requests
const rawOrigins = [
  process.env.FRONTEND_URL,                    // Dynamic: production frontend
  process.env.ALLOWED_ORIGIN_1,                // Dynamic: additional origin
  process.env.ALLOWED_ORIGIN_2,                // Dynamic: additional origin
  'https://888intelligenceautomation.in',      // Production root
  'https://www.888intelligenceautomation.in',  // Production www
  'https://api.888intelligenceautomation.in',  // Production API
  'https://app.888intelligenceautomation.in'   // Production app
];

// SAFETY NET: Filter out undefined/null/empty strings to prevent CORS errors
const allowedOrigins = rawOrigins.filter(Boolean);

console.log('🔒 CORS Allowed Origins:', allowedOrigins);

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, postman, curl, etc)
    if (!origin) return callback(null, true);

    // Check if origin is in allowed list or matches domain pattern
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

// PRE-FLIGHT WILDCARD: Handle all OPTIONS requests instantly
// This answers every OPTIONS preflight request so browser stops blocking
app.options('*', cors(corsOptions));

// Apply CORS middleware to all routes
app.use(cors(corsOptions));

// =============================================================================
// MIDDLEWARE CONFIGURATION
// =============================================================================

// ✅ CRITICAL: Preserve raw body for webhook signature verification
// This custom verify function stores the raw Buffer before bodyParser parses it
app.use(bodyParser.json({
  limit: '10mb',
  verify: (req, res, buf, encoding) => {
    // Store raw buffer on request object for signature verification
    // This runs BEFORE json parsing, preserving exact bytes
    req.rawBody = buf;
  }
}));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Request ID middleware
app.use((req, res, next) => {
  req.requestId = require('crypto').randomUUID();
  req.startTime = Date.now();
  res.header('X-Request-ID', req.requestId);
  next();
});

// =============================================================================
// SECURITY HEADERS MIDDLEWARE - META COMPLIANCE & BEST PRACTICES
// =============================================================================
// Adds comprehensive security headers to all responses
// Required for Meta App Review and industry best practices

app.use((req, res, next) => {
  // Strict-Transport-Security (HSTS)
  // Forces HTTPS connections for 1 year, including subdomains
  // Prevents man-in-the-middle attacks
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // Content-Security-Policy (CSP)
  // Prevents XSS attacks by controlling which resources can be loaded
  // Allows Facebook SDK, Supabase, and our own domains
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://connect.facebook.net https://*.supabase.co",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://graph.facebook.com https://*.supabase.co https://api.ipify.org",
    "frame-src 'self' https://www.facebook.com https://web.facebook.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');
  res.setHeader('Content-Security-Policy', cspDirectives);

  // X-Frame-Options
  // Prevents clickjacking attacks
  // DENY = don't allow embedding in any iframe
  res.setHeader('X-Frame-Options', 'DENY');

  // X-Content-Type-Options
  // Prevents MIME-type sniffing
  // Forces browser to respect declared content type
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // X-XSS-Protection
  // Legacy XSS protection for older browsers
  // Modern browsers use CSP instead
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer-Policy
  // Controls how much referrer information is sent
  // strict-origin-when-cross-origin = full URL for same-origin, origin only for cross-origin
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions-Policy (formerly Feature-Policy)
  // Controls which browser features can be used
  // Restricts access to camera, microphone, geolocation, etc.
  const permissionsPolicy = [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'gyroscope=()',
    'accelerometer=()'
  ].join(', ');
  res.setHeader('Permissions-Policy', permissionsPolicy);

  // X-Permitted-Cross-Domain-Policies
  // Prevents Adobe Flash and PDF cross-domain requests
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

  // X-Download-Options
  // IE-specific header to prevent file download in browser context
  res.setHeader('X-Download-Options', 'noopen');

  // Cache-Control for API responses
  // Prevents sensitive data from being cached
  if (req.url.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

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

// Basic health check with proxy status (Phase 5)
app.get('/health', (req, res) => {
  const proxyHealth = getProxyHealth();

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
    },
    proxy: {
      enabled: proxyHealth.enabled,
      initialized: proxyHealth.initialized,
      httpAgent: proxyHealth.httpAgent,
      socksAgent: proxyHealth.socksAgent,
      staticIPs: proxyHealth.staticIPs,
      metrics: {
        requests: proxyHealth.metrics.requests,
        failures: proxyHealth.metrics.failures,
        avgResponseTime: proxyHealth.metrics.avgResponseTime,
        lastError: proxyHealth.metrics.lastError
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

// Dedicated proxy health endpoint (Phase 5)
app.get('/health/proxy', (req, res) => {
  const { getProxyMetrics } = require('./config/fixie-proxy');
  const metrics = getProxyMetrics();

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    proxy: metrics
  });
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
// ENVIRONMENT VARIABLE VALIDATION (v3)
// =============================================================================
// Validate Instagram API credentials at startup
// Follows Jan 20 staging fixes and Jan 11/19 error resolution patterns
// Prevents partial runs with missing credentials

function validateEnvCreds() {
  const requiredVars = [
    'INSTAGRAM_APP_ID',
    'INSTAGRAM_APP_SECRET',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY'
  ];

  const missing = [];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    console.error('❌ CRITICAL: Missing required environment variables:');
    missing.forEach(varName => {
      console.error(`   - ${varName}`);
    });
    console.error('\n📝 Add these to your .env file before starting the server');
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  console.log('✅ Environment variables validated');
  console.log('   Instagram App ID:', process.env.INSTAGRAM_APP_ID);
  console.log('   Instagram App Secret:', process.env.INSTAGRAM_APP_SECRET?.substring(0, 5) + '...');
  console.log('   Supabase URL:', process.env.SUPABASE_URL?.split('.')[0] + '...');
}

// Call validation before initializing services
try {
  validateEnvCreds();
} catch (error) {
  console.error(error.message);
  process.exit(1); // Exit with error code
}

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

// ✅ Instagram API routes with rate limiting (Phase 4.2)
try {
  const instagramAPIRoutes = require('./routes/instagram-api');
  app.use('/api/instagram', instagramAPIRoutes);
  console.log('✅ Instagram API routes loaded (rate limited)');
} catch (error) {
  console.error('❌ Failed to load Instagram API routes:', error.message);
}

// ✅ Authentication routes REMOVED (Phase 3.7)
// Native Supabase OAuth now handles authentication directly
// Backend auth.js deleted - signInWithIdToken() was incompatible with Facebook tokens
// See: .claude/resources/current-work.md - Phase 3.7 for details

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
      api_tunnel: 'api.888intelligenceautomation.in',
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

  // Initialize Fixie Static IP Proxy (Phase 5)
  console.log('\n🔒 Initializing Static IP Security...');
  const proxyInit = initializeFixieProxy();

  if (proxyInit.enabled) {
    console.log('✅ Fixie proxy enabled');
    console.log(`   Static IPs: ${proxyInit.staticIPs.join(', ')}`);
  } else {
    console.log(`ℹ️  Proxy not enabled: ${proxyInit.reason || 'Disabled in configuration'}`);
  }

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
  const server = app.listen(PORT, '0.0.0.0', async () => {
    console.log('\n' + '='.repeat(60));
    console.log('✅ Server Successfully Started!');
    console.log('='.repeat(60));
    console.log('\n📍 Access Points:');
    console.log(`   Production: https://api.888intelligenceautomation.in`);
    console.log(`   Port: ${PORT}`);
    console.log('\n🔗 Key Endpoints:');
    console.log('   Health: /health');
    console.log('   Database: /health/database');
    console.log('   Status: /status');
    console.log('   API Docs: /api');
    console.log('\n🔐 Security:');
    console.log('   CORS: Configured for allowed origins');
    console.log('   Database: Direct connection with IP whitelisting');
    console.log('   Encryption: ' + (process.env.ENCRYPTION_KEY ? 'Enabled' : 'Disabled'));

    // Validate static IP proxy in production (Phase 5)
    if (process.env.NODE_ENV === 'production' && process.env.USE_FIXIE_PROXY === 'true') {
      console.log('\n🧪 Validating static IP connection...');

      try {
        const validation = await validateProxyConnection();

        if (!validation.valid) {
          console.error('\n' + '='.repeat(60));
          console.error('❌ CRITICAL: STATIC IP VALIDATION FAILED!');
          console.error('='.repeat(60));
          console.error(`Reason: ${validation.reason}`);
          console.error(`Detected IP: ${validation.ip || 'Unknown'}`);
          console.error(`Expected IPs: ${validation.staticIPs?.join(', ') || 'None'}`);
          console.error('\n⚠️  YOUR DATABASE IS NOT PROTECTED!');
          console.error('⚠️  SERVER WILL SHUT DOWN IN 5 SECONDS...\n');

          // Give time to read the error
          await new Promise(resolve => setTimeout(resolve, 5000));
          process.exit(1);
        }

        console.log('\n✅ Static IP Validation Successful');
        console.log(`   Detected IP: ${validation.ip}`);
        console.log(`   Expected IPs: ${validation.staticIPs.join(', ')}`);
        console.log(`   Status: ${validation.reason}`);

      } catch (error) {
        console.error('❌ Proxy validation error:', error.message);

        if (process.env.NODE_ENV === 'production') {
          console.error('⚠️  Cannot start in production without proxy validation');
          process.exit(1);
        }
      }
    }

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