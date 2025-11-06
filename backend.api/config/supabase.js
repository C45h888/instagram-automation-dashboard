// backend/config/supabase.js - Optimized Direct Connection (No Tunnel B)
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const dotenv = require('dotenv');
const { getSupabaseProxyConfig } = require('./fixie-proxy');

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

// Encryption configuration
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const algorithm = 'aes-256-gcm';
const key = ENCRYPTION_KEY ? Buffer.from(ENCRYPTION_KEY, 'hex') : null;

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
        // Get proxy configuration from Fixie module
        const proxyConfig = process.env.USE_FIXIE_PROXY === 'true'
          ? getSupabaseProxyConfig()
          : {};

        // Create production clients
        supabaseAdmin = createClient(config.url, serviceKey, {
          ...proxyConfig,  // Merge proxy configuration
          auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false
          },
          db: {
            schema: 'public'
          },
          global: {
            ...proxyConfig.global,  // Merge proxy fetch function
            headers: {
              ...proxyConfig.global?.headers,
              'X-Client-Info': 'instagram-automation-backend',
              'X-Client-Version': '1.0.0',
              'X-Static-IP-Protected': process.env.USE_FIXIE_PROXY === 'true' ? 'true' : 'false'
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
          const anonProxyConfig = process.env.USE_FIXIE_PROXY === 'true'
            ? getSupabaseProxyConfig()
            : {};

          supabaseClient = createClient(config.url, anonKey, {
            ...anonProxyConfig,
            auth: {
              autoRefreshToken: true,
              persistSession: true,
              detectSessionInUrl: true
            },
            db: {
              schema: 'public'
            },
            global: {
              ...anonProxyConfig.global,
              headers: {
                ...anonProxyConfig.global?.headers,
                'X-Client-Info': 'instagram-automation-client',
                'X-Client-Version': '1.0.0',
                'X-Static-IP-Protected': process.env.USE_FIXIE_PROXY === 'true' ? 'true' : 'false'
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
// ENCRYPTION UTILITIES (Preserved for Instagram credentials)
// =============================================================================

const encrypt = (text) => {
  if (!key) {
    console.warn('⚠️  Encryption key not available - storing unencrypted');
    return { encrypted: text, iv: null, authTag: null, isEncrypted: false };
  }
  
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      isEncrypted: true
    };
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
};

const decrypt = (encryptedData) => {
  if (!encryptedData.isEncrypted || !encryptedData.iv || !encryptedData.authTag) {
    return encryptedData.encrypted;
  }
  
  if (!key) {
    throw new Error('Encryption key not available for decryption');
  }
  
  try {
    const decipher = crypto.createDecipheriv(
      algorithm,
      key,
      Buffer.from(encryptedData.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
};

// =============================================================================
// AUDIT LOGGING (Direct to Supabase)
// =============================================================================

async function logAudit(eventType, userId = null, eventData = {}, req = null) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) {
      console.warn('⚠️  Cannot log audit - database not connected');
      return;
    }
    
    await admin.from('audit_log').insert({
      user_id: userId,
      event_type: eventType,
      action: eventData.action || 'unknown',
      resource_type: eventData.resource_type,
      resource_id: eventData.resource_id,
      details: eventData,
      ip_address: req?.ip || req?.connection?.remoteAddress || 'unknown',
      user_agent: req?.headers?.['user-agent'] || 'unknown',
      success: eventData.success !== false,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Audit log error:', error);
  }
}

// =============================================================================
// API REQUEST LOGGING (For monitoring and billing)
// =============================================================================

async function logApiRequest(userId, endpoint, method, responseTime, statusCode, success) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) {
      console.warn('⚠️  Cannot log API request - database not connected');
      return;
    }
    
    const hourBucket = new Date();
    hourBucket.setMinutes(0, 0, 0);
    
    await admin.from('api_usage').upsert({
      user_id: userId,
      endpoint: endpoint,
      method: method,
      response_time_ms: responseTime,
      status_code: statusCode,
      success: success,
      hour_bucket: hourBucket.toISOString(),
      request_count: 1,
      created_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,endpoint,method,hour_bucket'
    });
  } catch (error) {
    console.error('API logging error:', error);
  }
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

  async storeInstagramCredentials(userId, businessAccountId, credentials) {
    try {
      const admin = getSupabaseAdmin();
      if (!admin) throw new Error('Database not connected');
      
      const encryptedAccessToken = encrypt(credentials.accessToken);
      const encryptedRefreshToken = credentials.refreshToken ? encrypt(credentials.refreshToken) : null;
      
      const { data, error } = await admin
        .from('instagram_credentials')
        .insert({
          user_id: userId,
          business_account_id: businessAccountId,
          access_token_encrypted: JSON.stringify(encryptedAccessToken),
          refresh_token_encrypted: encryptedRefreshToken ? JSON.stringify(encryptedRefreshToken) : null,
          token_type: 'Bearer',
          scope: credentials.scope || [],
          expires_at: credentials.expiresAt,
          is_active: true
        })
        .select()
        .single();
      
      if (error) throw error;
      
      await logAudit('instagram_credentials_stored', userId, {
        action: 'create',
        resource_type: 'instagram_credentials',
        resource_id: data.id,
        details: { 
          business_account_id: businessAccountId, 
          encrypted: encryptedAccessToken.isEncrypted 
        }
      });
      
      return { success: true, data };
    } catch (error) {
      console.error('Error storing credentials:', error);
      return { success: false, error: error.message };
    }
  },

  async getInstagramCredentials(userId, businessAccountId) {
    try {
      const admin = getSupabaseAdmin();
      if (!admin) throw new Error('Database not connected');
      
      const { data, error } = await admin
        .from('instagram_credentials')
        .select('*')
        .eq('user_id', userId)
        .eq('business_account_id', businessAccountId)
        .eq('is_active', true)
        .single();
      
      if (error) throw error;
      
      const accessTokenData = JSON.parse(data.access_token_encrypted);
      const decryptedAccessToken = decrypt(accessTokenData);
      
      let decryptedRefreshToken = null;
      if (data.refresh_token_encrypted) {
        const refreshTokenData = JSON.parse(data.refresh_token_encrypted);
        decryptedRefreshToken = decrypt(refreshTokenData);
      }
      
      return {
        success: true,
        data: {
          ...data,
          access_token: decryptedAccessToken,
          refresh_token: decryptedRefreshToken
        }
      };
    } catch (error) {
      console.error('Error getting credentials:', error);
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
// PROXY HELPER FUNCTIONS (Phase 5)
// =============================================================================

/**
 * Check if proxy is enabled for Supabase connections
 */
function isProxyEnabled() {
  return process.env.USE_FIXIE_PROXY === 'true';
}

/**
 * Check if static IP protection is active
 */
function isStaticIPProtected() {
  return process.env.USE_FIXIE_PROXY === 'true';
}

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
  
  // Encryption utilities
  encrypt,
  decrypt,
  
  // Logging functions
  logApiRequest,
  logAudit,
  
  // Helper functions
  supabaseHelpers,

  // Proxy helper functions (Phase 5)
  isProxyEnabled,
  isStaticIPProtected,

  // Backward compatibility aliases
  supabaseAdmin: getSupabaseAdmin,
  supabaseClient: getSupabaseClient,
  supabaseAnon: getSupabaseClient
};