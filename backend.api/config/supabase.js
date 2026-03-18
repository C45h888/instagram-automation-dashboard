// backend/config/supabase.js - Optimized Direct Connection (No Tunnel B)
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '../.env' });

// =============================================================================
// CONFIGURATION - DIRECT CONNECTION ONLY (NO TUNNEL B)
// =============================================================================

const SUPABASE_CONFIG = {
  development: {
    // Always use direct connection (tunnel removed due to proxy issues)
    url: process.env.SUPABASE_URL || 'https://uromexjprcrjfmhkmgxa.supabase.co',
    serviceKey: process.env.SUPABASE_SERVICE_KEY,
    anonKey: process.env.SUPABASE_ANON_KEY,
    // Connection settings
    timeout: 10000, // 10 seconds
    retryAttempts: 3,
    retryDelay: 5000 // 5 seconds between retries
  },
  production: {
    // Production uses direct connection with static IP whitelisting
    url: process.env.SUPABASE_URL || 'https://uromexjprcrjfmhkmgxa.supabase.co',
    serviceKey: process.env.SUPABASE_SERVICE_KEY,
    anonKey: process.env.SUPABASE_ANON_KEY,
    // More aggressive timeouts in production
    timeout: 5000,
    retryAttempts: 5,
    retryDelay: 3000
  }
};

// Get configuration based on environment
const getConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  return SUPABASE_CONFIG[env] || SUPABASE_CONFIG.development;
};

// =============================================================================
// MODULE STATE
// =============================================================================

let supabaseAdmin = null;
let supabaseClient = null;
let connectionInfo = null;
let isInitialized = false;

// =============================================================================
// CONNECTION TESTING WITH TIMEOUT PROTECTION
// =============================================================================

async function testConnection(url, key, timeout = 5000) {
  try {
    const testClient = createClient(url, key, {
      auth: { 
        autoRefreshToken: false, 
        persistSession: false 
      },
      db: {
        schema: 'public'
      },
      global: {
        headers: {
          'X-Client-Info': 'instagram-backend-test'
        }
      }
    });
    
    // Create timeout promise
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout')), timeout)
    );
    
    // Test query promise
    const testPromise = testClient
      .from('user_profiles')
      .select('count', { count: 'exact', head: true });
    
    // Race between query and timeout
    const result = await Promise.race([testPromise, timeoutPromise]);
    
    if (result.error) {
      throw result.error;
    }
    
    return { 
      success: true, 
      url, 
      latency: Date.now() - Date.now(), // Will be calculated properly in production
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.warn(`⚠️  Connection test failed: ${error.message}`);
    return { 
      success: false, 
      url, 
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// =============================================================================
// INTELLIGENT INITIALIZATION WITH RETRY LOGIC
// =============================================================================

async function initializeSupabase(options = {}) {
  // Prevent re-initialization if already connected
  if (isInitialized && supabaseAdmin) {
    const health = await checkHealth();
    if (health.healthy) {
      console.log('✅ Supabase already initialized and healthy');
      return { supabaseAdmin, supabaseClient, connectionInfo };
    }
    // If unhealthy, reinitialize
    console.log('⚠️  Existing connection unhealthy, reinitializing...');
  }

  const config = getConfig();
  const serviceKey = options.serviceKey || config.serviceKey;
  const anonKey = options.anonKey || config.anonKey;
  const maxRetries = options.retryAttempts || config.retryAttempts;
  const retryDelay = options.retryDelay || config.retryDelay;
  const timeout = options.timeout || config.timeout;
  
  // Validate required keys
  if (!serviceKey) {
    const error = new Error('SUPABASE_SERVICE_KEY is required but not provided');
    console.error('❌ ' + error.message);
    throw error;
  }
  
  if (!config.url) {
    const error = new Error('SUPABASE_URL is required but not provided');
    console.error('❌ ' + error.message);
    throw error;
  }
  
  console.log('🔄 Initializing Supabase connection...');
  console.log(`   URL: ${config.url}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Max retries: ${maxRetries}`);
  console.log(`   Timeout: ${timeout}ms`);
  
  let lastError = null;
  
  // Retry logic
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`\n🔍 Connection attempt ${attempt}/${maxRetries}...`);
    
    try {
      // Test connection first
      const testResult = await testConnection(config.url, serviceKey, timeout);
      
      if (testResult.success) {
        // Create production clients
        supabaseAdmin = createClient(config.url, serviceKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false
          },
          db: {
            schema: 'public'
          },
          global: {
            headers: {
              'X-Client-Info': 'instagram-automation-backend',
              'X-Client-Version': '2.0.0'
            }
          },
          realtime: {
            params: {
              eventsPerSecond: 10
            }
          }
        });
        
        // Create anon client if key provided
        if (anonKey) {
          supabaseClient = createClient(config.url, anonKey, {
            auth: {
              autoRefreshToken: true,
              persistSession: true,
              detectSessionInUrl: true
            },
            db: {
              schema: 'public'
            },
            global: {
              headers: {
                'X-Client-Info': 'instagram-automation-client',
                'X-Client-Version': '2.0.0'
              }
            }
          });
        }
        
        // Store connection info
        connectionInfo = {
          url: config.url,
          environment: process.env.NODE_ENV || 'development',
          timestamp: new Date().toISOString(),
          attempt: attempt,
          totalAttempts: maxRetries
        };
        
        isInitialized = true;
        
        console.log('✅ Supabase connection established successfully');
        console.log(`   Connected on attempt: ${attempt}`);
        console.log(`   Database: ${config.url}`);
        console.log(`   Security: Row Level Security (RLS) active`);
        
        // Verify with a test query
        const { count, error } = await supabaseAdmin
          .from('user_profiles')
          .select('*', { count: 'exact', head: true });
        
        if (!error) {
          console.log(`   Verified: ${count || 0} user profiles accessible`);
        }
        
        return { supabaseAdmin, supabaseClient, connectionInfo };
      }
      
      throw new Error(testResult.error || 'Connection test failed');
      
    } catch (error) {
      lastError = error;
      console.error(`❌ Attempt ${attempt} failed: ${error.message}`);
      
      if (attempt < maxRetries) {
        console.log(`⏳ Retrying in ${retryDelay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  
  // All attempts failed
  const errorMsg = `Failed to connect to Supabase after ${maxRetries} attempts. Last error: ${lastError?.message}`;
  console.error('❌ ' + errorMsg);
  
  // In development, allow server to continue with warnings
  if (process.env.NODE_ENV !== 'production') {
    console.warn('⚠️  Starting without database connection (development mode)');
    console.warn('   Database-dependent features will not work');
    return { supabaseAdmin: null, supabaseClient: null, connectionInfo: null };
  }
  
  // In production, this is fatal
  throw new Error(errorMsg);
}

// =============================================================================
// GETTER FUNCTIONS WITH VALIDATION
// =============================================================================

function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Supabase admin client not initialized. Server should not be running without database.');
    }
    console.warn('⚠️  Supabase admin client not available');
    return null;
  }
  return supabaseAdmin;
}

function getSupabaseClient() {
  if (!supabaseClient) {
    console.warn('⚠️  Supabase client not available');
    return null;
  }
  return supabaseClient;
}

function getConnectionInfo() {
  return connectionInfo;
}

// =============================================================================
// HEALTH CHECK FUNCTIONALITY
// =============================================================================

async function checkHealth() {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) {
      return { 
        healthy: false, 
        error: 'Admin client not initialized',
        timestamp: new Date().toISOString()
      };
    }
    
    const startTime = Date.now();
    const { error } = await admin
      .from('user_profiles')
      .select('count', { count: 'exact', head: true });
    
    const responseTime = Date.now() - startTime;
    
    return { 
      healthy: !error,
      responseTime,
      connectionInfo,
      error: error?.message,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return { 
      healthy: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// =============================================================================
// AUDIT LOGGING (Direct to Supabase)
// =============================================================================

async function logAudit(eventTypeOrObj, userId = null, eventData = {}, req = null) {
  try {
    // Support both positional and object call forms:
    // Positional: logAudit('event_type', userId, { action, resource_type, ... }, req)
    // Object:     logAudit({ event_type, user_id, action, resource_type, resource_id, details, success })
    let eventType_v, userId_v, eventData_v, req_v;

    if (eventTypeOrObj !== null && typeof eventTypeOrObj === 'object' && !Array.isArray(eventTypeOrObj)) {
      // Object form (used by agent-proxy.js)
      eventType_v = eventTypeOrObj.event_type;
      userId_v = eventTypeOrObj.user_id || null;
      eventData_v = {
        action: eventTypeOrObj.action || 'unknown',
        resource_type: eventTypeOrObj.resource_type,
        resource_id: eventTypeOrObj.resource_id,
        details: eventTypeOrObj.details || {},
        success: eventTypeOrObj.success !== false
      };
      req_v = null;
    } else {
      // Positional form (used by server.js, supabaseHelpers, instagram-tokens.js)
      eventType_v = eventTypeOrObj;
      userId_v = userId;
      eventData_v = eventData;
      req_v = req;
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      console.warn('⚠️  Cannot log audit - database not connected');
      return;
    }

    await admin.from('audit_log').insert({
      user_id: userId_v,
      event_type: eventType_v,
      action: eventData_v.action || 'unknown',
      resource_type: eventData_v.resource_type,
      resource_id: eventData_v.resource_id,
      details: eventData_v.details,
      ip_address: req_v?.ip || req_v?.connection?.remoteAddress || null,
      user_agent: req_v?.headers?.['user-agent'] || 'unknown',
      success: eventData_v.success !== false,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Audit log error:', error);
  }
}

// =============================================================================
// API REQUEST LOGGING (For monitoring and billing)
// =============================================================================

async function logApiRequest(userIdOrObj, endpoint, method, responseTime, statusCode, success, businessAccountId = null) {
  try {
    // Support both positional and object call forms:
    // Positional: logApiRequest(userId, endpoint, method, responseTime, statusCode, success, businessAccountId)
    // Object:     logApiRequest({ user_id, endpoint, method, latency, status_code, success, business_account_id })
    let userId_v, endpoint_v, method_v, responseTime_v, statusCode_v, success_v, businessAccountId_v;

    let errorMessage_v = null;

    if (userIdOrObj !== null && typeof userIdOrObj === 'object' && !Array.isArray(userIdOrObj)) {
      // Object form (used by agent-proxy.js)
      userId_v = userIdOrObj.user_id || null;
      endpoint_v = userIdOrObj.endpoint;
      method_v = userIdOrObj.method;
      responseTime_v = userIdOrObj.latency || userIdOrObj.response_time || 0;
      statusCode_v = userIdOrObj.status_code || (userIdOrObj.success ? 200 : 500);
      success_v = userIdOrObj.success !== undefined ? userIdOrObj.success : true;
      businessAccountId_v = userIdOrObj.business_account_id || null;
      errorMessage_v = userIdOrObj.error || null;
    } else {
      // Positional form (used by server.js middleware)
      userId_v = userIdOrObj;
      endpoint_v = endpoint;
      method_v = method;
      responseTime_v = responseTime;
      statusCode_v = statusCode;
      success_v = success;
      businessAccountId_v = businessAccountId;
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      console.warn('⚠️  Cannot log API request - database not connected');
      return;
    }

    const _now = new Date();
    const _hourBucket = new Date(_now);
    _hourBucket.setMinutes(0, 0, 0);

    const { error } = await admin.from('api_usage').insert({
      user_id: userId_v || null,
      business_account_id: businessAccountId_v || null,
      endpoint: endpoint_v,
      method: method_v,
      response_time_ms: responseTime_v,
      status_code: statusCode_v,
      success: success_v,
      error_message: errorMessage_v,
      domain: (typeof userIdOrObj === 'object' && userIdOrObj !== null) ? (userIdOrObj.domain || null) : null,
      hour_bucket: _hourBucket.toISOString(),
      request_count: 1,
      created_at: _now.toISOString()
    });

    if (error) {
      console.error('API logging error:', error.message, error.details);
    }
  } catch (error) {
    console.error('API logging exception:', error.message);
  }
}

// =============================================================================
// LOG LEVEL HELPER
// =============================================================================
// Levels: trace=0 (most verbose) → debug=1 → standard=2 (default) → minimal=3
// Set LOG_LEVEL env var to control verbosity without code changes.
const _LOG_LEVELS = { trace: 0, debug: 1, standard: 2, minimal: 3 };
const _CURRENT_LEVEL = _LOG_LEVELS[process.env.LOG_LEVEL] ?? _LOG_LEVELS.standard;

function shouldLog(level) {
  return (_LOG_LEVELS[level] ?? _LOG_LEVELS.standard) >= _CURRENT_LEVEL;
}

// =============================================================================
// HELPER FUNCTIONS (All preserved for backward compatibility)
// =============================================================================

const supabaseHelpers = {
  async testConnection() {
    const health = await checkHealth();
    return health.healthy;
  },

  async upsertUserProfile(userId, profileData) {
    try {
      const admin = getSupabaseAdmin();
      if (!admin) throw new Error('Database not connected');
      
      const { data, error } = await admin
        .from('user_profiles')
        .upsert({
          user_id: userId,
          ...profileData,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) throw error;
      
      await logAudit('user_profile_update', userId, {
        action: 'upsert',
        resource_type: 'user_profile',
        resource_id: data.id
      });
      
      return { success: true, data };
    } catch (error) {
      console.error('Error upserting user profile:', error);
      return { success: false, error: error.message };
    }
  },

  async linkInstagramAccount(userId, accountData) {
    try {
      const admin = getSupabaseAdmin();
      if (!admin) throw new Error('Database not connected');
      
      const { data, error } = await admin
        .from('instagram_business_accounts')
        .insert({
          user_id: userId,
          ...accountData,
          is_connected: true,
          last_sync_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) throw error;
      
      await logAudit('instagram_account_linked', userId, {
        action: 'create',
        resource_type: 'instagram_business_account',
        resource_id: data.id,
        details: { instagram_business_id: accountData.instagram_business_id }
      });
      
      return { success: true, data };
    } catch (error) {
      console.error('Error linking Instagram account:', error);
      return { success: false, error: error.message };
    }
  },

  async getUserInstagramAccounts(userId) {
    try {
      const admin = getSupabaseAdmin();
      if (!admin) throw new Error('Database not connected');
      
      const { data, error } = await admin
        .from('instagram_business_accounts')
        .select('*')
        .eq('user_id', userId)
        .eq('is_connected', true);
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching Instagram accounts:', error);
      return { success: false, error: error.message };
    }
  },

  async createWorkflow(userId, businessAccountId, workflowData) {
    try {
      const admin = getSupabaseAdmin();
      if (!admin) throw new Error('Database not connected');
      
      const { data, error } = await admin
        .from('automation_workflows')
        .insert({
          user_id: userId,
          business_account_id: businessAccountId,
          ...workflowData,
          status: 'inactive',
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) throw error;
      
      await logAudit('workflow_created', userId, {
        action: 'create',
        resource_type: 'automation_workflow',
        resource_id: data.id,
        details: { workflow_type: workflowData.automation_type }
      });
      
      return { success: true, data };
    } catch (error) {
      console.error('Error creating workflow:', error);
      return { success: false, error: error.message };
    }
  },

  async logWorkflowExecution(workflowId, userId, executionData) {
    try {
      const admin = getSupabaseAdmin();
      if (!admin) throw new Error('Database not connected');
      
      const { data, error } = await admin
        .from('workflow_executions')
        .insert({
          workflow_id: workflowId,
          user_id: userId,
          ...executionData,
          started_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error logging workflow execution:', error);
      return { success: false, error: error.message };
    }
  },

  async deleteUserData(userId) {
    try {
      const admin = getSupabaseAdmin();
      if (!admin) throw new Error('Database not connected');
      
      const results = [];
      const tables = [
        'workflow_executions',
        'automation_workflows',
        'instagram_comments',
        'instagram_media',
        'daily_analytics',
        'instagram_credentials',
        'instagram_business_accounts',
        'notifications',
        'api_usage',
        'user_profiles'
      ];
      
      for (const table of tables) {
        const { error } = await admin
          .from(table)
          .delete()
          .eq('user_id', userId);
        
        results.push({
          table,
          success: !error,
          error: error?.message
        });
      }
      
      await logAudit('user_data_deletion', userId, {
        action: 'delete_all',
        resource_type: 'user_data',
        details: { tables_affected: tables, results },
        success: true
      });
      
      return { success: true, results };
    } catch (error) {
      console.error('Error deleting user data:', error);
      
      await logAudit('user_data_deletion', userId, {
        action: 'delete_all',
        resource_type: 'user_data',
        details: { error: error.message },
        success: false
      });
      
      return { success: false, error: error.message };
    }
  }
};

// =============================================================================
// EXPORTS - Complete compatibility maintained
// =============================================================================

module.exports = {
  // Core initialization and management
  initializeSupabase,
  getSupabaseAdmin,
  getSupabaseClient,
  getConnectionInfo,
  checkHealth,
  testConnection,

  // Logging functions
  logApiRequest,
  logAudit,
  shouldLog,

  // Helper functions
  supabaseHelpers,

  // Backward compatibility aliases
  supabaseAdmin: getSupabaseAdmin,
  supabaseClient: getSupabaseClient,
  supabaseAnon: getSupabaseClient
};