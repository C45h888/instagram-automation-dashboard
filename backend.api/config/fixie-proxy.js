// backend.api/config/fixie-proxy.js
/**
 * Fixie Static IP Proxy Configuration
 *
 * Provides static IP addresses for all outbound requests through Fixie proxy.
 * Critical for Supabase IP whitelisting and Meta API compliance.
 *
 * Architecture:
 * - HTTP Proxy: For REST API calls (Meta, N8N)
 * - SOCKS5 Proxy: For database connections (Supabase)
 * - Metrics: Request tracking and performance monitoring
 *
 * @module fixie-proxy
 */

const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');

// =============================================================================
// CONFIGURATION
// =============================================================================

const config = {
  // Core settings
  enabled: process.env.USE_FIXIE_PROXY === 'true',
  environment: process.env.NODE_ENV || 'development',

  // Proxy URLs
  httpProxyUrl: process.env.FIXIE_URL,
  socksProxyUrl: process.env.FIXIE_SOCKS_HOST,

  // Static IPs
  staticIPs: (process.env.FIXIE_STATIC_IPS || '')
    .split(',')
    .map(ip => ip.trim())
    .filter(Boolean),

  // Performance settings
  timeout: parseInt(process.env.PROXY_TIMEOUT || '30000', 10),
  retryAttempts: parseInt(process.env.PROXY_RETRY_ATTEMPTS || '3', 10),

  // Development mode bypass
  bypassInDevelopment: process.env.BYPASS_PROXY_IN_DEV !== 'false'
};

// =============================================================================
// PROXY AGENTS (Singleton Pattern)
// =============================================================================

let httpProxyAgent = null;
let socksProxyAgent = null;
let isInitialized = false;

// Metrics tracking
const metrics = {
  requestCount: 0,
  failureCount: 0,
  totalResponseTime: 0,
  lastRequestTime: null,
  lastError: null
};

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize Fixie proxy agents
 * Called once during server startup
 *
 * @returns {Object} Initialization result with status and agents
 */
function initializeFixieProxy() {
  // Check if proxy should be enabled
  if (!config.enabled) {
    console.log('ℹ️  Fixie proxy is disabled (USE_FIXIE_PROXY=false)');
    return {
      success: true,
      enabled: false,
      reason: 'Proxy disabled in configuration'
    };
  }

  // Development mode bypass
  if (config.environment === 'development' && config.bypassInDevelopment) {
    console.log('ℹ️  Fixie proxy bypassed in development mode');
    return {
      success: true,
      enabled: false,
      reason: 'Development mode bypass active'
    };
  }

  console.log('🔒 Initializing Fixie Static IP Proxy...');
  console.log(`   Environment: ${config.environment}`);
  console.log(`   Static IPs: ${config.staticIPs.join(', ')}`);

  try {
    // Validate configuration
    if (!config.httpProxyUrl) {
      throw new Error('FIXIE_URL not configured');
    }

    if (!config.socksProxyUrl) {
      throw new Error('FIXIE_SOCKS_HOST not configured');
    }

    if (config.staticIPs.length === 0) {
      throw new Error('FIXIE_STATIC_IPS not configured');
    }

    // Initialize HTTP proxy agent
    httpProxyAgent = new HttpsProxyAgent(config.httpProxyUrl, {
      timeout: config.timeout,
      keepAlive: true,
      keepAliveMsecs: 1000
    });
    console.log('✅ HTTP proxy agent initialized');

    // Initialize SOCKS5 proxy agent
    socksProxyAgent = new SocksProxyAgent(`socks5://${config.socksProxyUrl}`, {
      timeout: config.timeout
    });
    console.log('✅ SOCKS5 proxy agent initialized');

    isInitialized = true;

    return {
      success: true,
      enabled: true,
      httpAgent: !!httpProxyAgent,
      socksAgent: !!socksProxyAgent,
      staticIPs: config.staticIPs
    };

  } catch (error) {
    console.error('❌ Failed to initialize Fixie proxy:', error.message);

    // In production, this is fatal
    if (config.environment === 'production') {
      throw error;
    }

    // In development, log and continue
    console.warn('⚠️  Continuing without proxy (development mode)');
    return {
      success: false,
      enabled: false,
      error: error.message
    };
  }
}

// =============================================================================
// PROXIED HTTP CLIENT (for Meta API, N8N, etc.)
// =============================================================================

/**
 * Create axios instance with proxy configuration
 * Use this for all external HTTP/HTTPS requests
 *
 * @param {Object} options - Additional axios options
 * @returns {Object} Configured axios instance
 */
function createProxiedHttpClient(options = {}) {
  const axios = require('axios');

  // If proxy not enabled, return standard axios
  if (!config.enabled || !httpProxyAgent) {
    return axios.create(options);
  }

  // Create proxied instance
  return axios.create({
    ...options,
    httpsAgent: httpProxyAgent,
    httpAgent: httpProxyAgent,
    proxy: false, // Disable axios's internal proxy handling
    timeout: options.timeout || config.timeout,

    // Interceptors for metrics
    interceptors: {
      request: [
        (config) => {
          metrics.requestCount++;
          metrics.lastRequestTime = new Date();
          return config;
        }
      ],
      response: [
        (response) => {
          const responseTime = Date.now() - metrics.lastRequestTime.getTime();
          metrics.totalResponseTime += responseTime;
          return response;
        },
        (error) => {
          metrics.failureCount++;
          metrics.lastError = {
            message: error.message,
            timestamp: new Date(),
            url: error.config?.url
          };
          return Promise.reject(error);
        }
      ]
    }
  });
}

// =============================================================================
// SUPABASE PROXY CONFIGURATION
// =============================================================================

/**
 * Get proxy configuration for Supabase client
 * Integrates with existing Supabase configuration
 *
 * @returns {Object} Supabase-compatible proxy config
 */
function getSupabaseProxyConfig() {
  // If proxy not enabled, return empty config
  if (!config.enabled || !socksProxyAgent) {
    return {};
  }

  // Return custom fetch with SOCKS5 proxy
  return {
    global: {
      fetch: (url, options = {}) => {
        return fetch(url, {
          ...options,
          agent: socksProxyAgent
        });
      }
    }
  };
}

// =============================================================================
// VALIDATION & HEALTH CHECKS
// =============================================================================

/**
 * Validate proxy connection and verify static IP
 * Should be called on server startup in production
 *
 * @returns {Promise<Object>} Validation result
 */
async function validateProxyConnection() {
  if (!config.enabled) {
    return {
      valid: false,
      enabled: false,
      reason: 'Proxy disabled'
    };
  }

  if (!httpProxyAgent) {
    return {
      valid: false,
      enabled: true,
      reason: 'Proxy agent not initialized'
    };
  }

  try {
    const axios = require('axios');

    // Make request to IP check service through proxy
    const response = await axios.get('https://api.ipify.org?format=json', {
      httpsAgent: httpProxyAgent,
      proxy: false,
      timeout: 10000
    });

    const detectedIP = response.data.ip;
    const valid = config.staticIPs.includes(detectedIP);

    return {
      valid,
      enabled: true,
      ip: detectedIP,
      staticIPs: config.staticIPs,
      reason: valid ? 'IP matches expected static IP' : 'IP mismatch - proxy may not be working correctly'
    };

  } catch (error) {
    return {
      valid: false,
      enabled: true,
      reason: `Connection test failed: ${error.message}`,
      error: error.message
    };
  }
}

/**
 * Get proxy status for health checks
 * Extends existing health check endpoints
 *
 * @returns {Object} Proxy health status
 */
function getProxyHealth() {
  return {
    enabled: config.enabled,
    initialized: isInitialized,
    httpAgent: !!httpProxyAgent,
    socksAgent: !!socksProxyAgent,
    staticIPs: config.staticIPs,
    metrics: {
      requests: metrics.requestCount,
      failures: metrics.failureCount,
      avgResponseTime: metrics.requestCount > 0
        ? Math.round(metrics.totalResponseTime / metrics.requestCount)
        : 0,
      lastRequest: metrics.lastRequestTime,
      lastError: metrics.lastError
    }
  };
}

/**
 * Get proxy metrics for monitoring
 *
 * @returns {Object} Detailed metrics
 */
function getProxyMetrics() {
  return {
    configuration: {
      enabled: config.enabled,
      environment: config.environment,
      timeout: config.timeout,
      retryAttempts: config.retryAttempts,
      staticIPCount: config.staticIPs.length
    },
    status: {
      initialized: isInitialized,
      httpAgentActive: !!httpProxyAgent,
      socksAgentActive: !!socksProxyAgent
    },
    performance: {
      totalRequests: metrics.requestCount,
      failedRequests: metrics.failureCount,
      successRate: metrics.requestCount > 0
        ? ((metrics.requestCount - metrics.failureCount) / metrics.requestCount * 100).toFixed(2) + '%'
        : 'N/A',
      averageResponseTime: metrics.requestCount > 0
        ? Math.round(metrics.totalResponseTime / metrics.requestCount) + 'ms'
        : 'N/A',
      lastRequestTime: metrics.lastRequestTime
    },
    lastError: metrics.lastError
  };
}

/**
 * Reset metrics (for testing)
 */
function resetMetrics() {
  metrics.requestCount = 0;
  metrics.failureCount = 0;
  metrics.totalResponseTime = 0;
  metrics.lastRequestTime = null;
  metrics.lastError = null;
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Initialization
  initializeFixieProxy,

  // Client creation
  createProxiedHttpClient,
  getSupabaseProxyConfig,

  // Validation
  validateProxyConnection,

  // Health & Metrics
  getProxyHealth,
  getProxyMetrics,
  resetMetrics,

  // Configuration access (read-only)
  config: {
    isEnabled: () => config.enabled,
    getStaticIPs: () => [...config.staticIPs],
    getEnvironment: () => config.environment
  }
};
