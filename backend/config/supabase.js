// backend/config/supabase.js - Enhanced Supabase client with Cloudflare Tunnel + Phase 1 Features
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '../.env' });

// Configuration validation and setup
const supabaseUrl = process.env.SUPABASE_TUNNEL_URL || process.env.SUPABASE_CLIENT_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const encryptionKey = process.env.ENCRYPTION_KEY;

// Validate critical configuration
if (!supabaseUrl) {
  console.error('❌ Missing SUPABASE_TUNNEL_URL or SUPABASE_URL');
  console.log('📋 Required environment variables:');
  console.log('   SUPABASE_TUNNEL_URL=https://db-secure.888intelligenceautomation.in');
  console.log('   SUPABASE_SERVICE_KEY=your_service_key');
  console.log('   ENCRYPTION_KEY=32_byte_hex_string');
  process.exit(1);
}

if (!encryptionKey) {
  console.warn('⚠️  ENCRYPTION_KEY not set - Instagram credential encryption disabled');
}

// Log connection info (without exposing sensitive keys)
console.log('🔐 Supabase Configuration:');
console.log(`   URL: ${supabaseUrl}`);
console.log(`   Using Tunnel: ${supabaseUrl.includes('db-secure') ? 'Yes ✅' : 'No ❌'}`);
console.log(`   Service Key: ${supabaseServiceKey ? '✅ Set' : '❌ Missing'}`);
console.log(`   Anon Key: ${supabaseAnonKey ? '✅ Set' : '❌ Missing'}`);
console.log(`   Encryption: ${encryptionKey ? '✅ Enabled' : '⚠️  Disabled'}`);

// Create admin client with service role key (for backend operations)
let supabaseAdmin = null;
if (supabaseServiceKey) {
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    db: {
      schema: 'public'
    },
    global: {
      headers: {
        'X-Client-Info': 'instagram-automation-backend',
        'X-Client-Version': '1.0.0'
      }
    }
  });
  console.log('✅ Supabase admin client initialized');
}

// Create regular client for user operations (alias for compatibility)
let supabaseClient = null;
let supabaseAnon = null;
if (supabaseAnonKey) {
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
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
        'X-Client-Info': 'instagram-automation-backend-anon',
        'X-Client-Version': '1.0.0'
      }
    }
  });
  
  // Create alias for backward compatibility
  supabaseAnon = supabaseClient;
  console.log('✅ Supabase anon client initialized');
}

// =============================================================================
// PHASE 1 ENCRYPTION UTILITIES FOR INSTAGRAM CREDENTIALS
// =============================================================================

const algorithm = 'aes-256-gcm';
const key = encryptionKey ? Buffer.from(encryptionKey, 'hex') : null;

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
  // Handle unencrypted data (fallback)
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
// PHASE 1 CONNECTION TESTING
// =============================================================================

const testConnection = async () => {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ Supabase connection error:', error);
      return false;
    }
    
    console.log('✅ Backend connected to Supabase successfully');
    console.log('📊 Database: uromexjprcrjfmhkmgxa.supabase.co');
    return true;
  } catch (err) {
    console.error('❌ Connection test failed:', err);
    return false;
  }
};

// =============================================================================
// PHASE 1 API LOGGING FOR MONITORING
// =============================================================================

const logApiRequest = async (userId, endpoint, method, responseTime, statusCode, success) => {
  try {
    // Try to use RPC function first (if it exists in your schema)
    const { error: rpcError } = await supabaseAdmin.rpc('log_api_request', {
      p_user_id: userId,
      p_business_account_id: null,
      p_endpoint: endpoint,
      p_method: method,
      p_response_time_ms: responseTime,
      p_status_code: statusCode,
      p_success: success
    }).single();
    
    // If RPC fails, fall back to direct insert
    if (rpcError) {
      const { error: insertError } = await supabaseAdmin
        .from('api_usage')
        .insert({
          user_id: userId,
          endpoint: endpoint,
          method: method,
          response_time_ms: responseTime,
          status_code: statusCode,
          success: success,
          created_at: new Date().toISOString()
        });
      
      if (insertError) throw insertError;
    }
  } catch (error) {
    console.error('Failed to log API request:', error);
  }
};

// =============================================================================
// PHASE 1 AUDIT LOGGING HELPER
// =============================================================================

const logAudit = async (eventType, userId = null, eventData = {}, req = null) => {
  try {
    await supabaseAdmin.from('audit_log').insert({
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
};

// =============================================================================
// EXISTING HELPER FUNCTIONS (PRESERVED FOR BACKWARD COMPATIBILITY)
// =============================================================================

const supabaseHelpers = {
  // Test database connection (wrapper for backward compatibility)
  async testConnection() {
    return await testConnection();
  },

  // Create or update user profile
  async upsertUserProfile(userId, profileData) {
    try {
      const { data, error } = await supabaseAdmin
        .from('user_profiles')
        .upsert({
          user_id: userId,
          ...profileData,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Log the action
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

  // Link Instagram business account
  async linkInstagramAccount(userId, accountData) {
    try {
      const { data, error } = await supabaseAdmin
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
      
      // Log the action
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

  // Store encrypted Instagram credentials (ENHANCED WITH ENCRYPTION)
  async storeInstagramCredentials(userId, businessAccountId, credentials) {
    try {
      // Encrypt sensitive credentials
      const encryptedAccessToken = encrypt(credentials.accessToken);
      const encryptedRefreshToken = credentials.refreshToken ? encrypt(credentials.refreshToken) : null;
      
      const { data, error } = await supabaseAdmin
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
      
      // Log the action (without sensitive data)
      await logAudit('instagram_credentials_stored', userId, {
        action: 'create',
        resource_type: 'instagram_credentials',
        resource_id: data.id,
        details: { business_account_id: businessAccountId, encrypted: encryptedAccessToken.isEncrypted }
      });
      
      return { success: true, data };
    } catch (error) {
      console.error('Error storing credentials:', error);
      return { success: false, error: error.message };
    }
  },

  // Get decrypted Instagram credentials
  async getInstagramCredentials(userId, businessAccountId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('instagram_credentials')
        .select('*')
        .eq('user_id', userId)
        .eq('business_account_id', businessAccountId)
        .eq('is_active', true)
        .single();
      
      if (error) throw error;
      
      // Decrypt credentials
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

  // Get user's Instagram accounts
  async getUserInstagramAccounts(userId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('instagram_business_accounts')
        .select(`
          *,
          automation_workflows(count),
          daily_analytics(
            date,
            followers_count,
            engagement_rate
          )
        `)
        .eq('user_id', userId)
        .eq('is_connected', true);
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching Instagram accounts:', error);
      return { success: false, error: error.message };
    }
  },

  // Create automation workflow
  async createWorkflow(userId, businessAccountId, workflowData) {
    try {
      const { data, error } = await supabaseAdmin
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
      
      // Log the action
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

  // Log workflow execution
  async logWorkflowExecution(workflowId, userId, executionData) {
    try {
      const { data, error } = await supabaseAdmin
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

  // Cache Instagram media
  async cacheInstagramMedia(businessAccountId, mediaData) {
    try {
      const { data, error } = await supabaseAdmin
        .from('instagram_media')
        .upsert({
          business_account_id: businessAccountId,
          instagram_media_id: mediaData.id,
          ...mediaData,
          last_updated_at: new Date().toISOString()
        })
        .select();
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error caching media:', error);
      return { success: false, error: error.message };
    }
  },

  // Update daily analytics
  async updateDailyAnalytics(businessAccountId, userId, analyticsData) {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabaseAdmin
        .from('daily_analytics')
        .upsert({
          business_account_id: businessAccountId,
          user_id: userId,
          date: today,
          ...analyticsData,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error updating analytics:', error);
      return { success: false, error: error.message };
    }
  },

  // Audit log entry (wrapper for backward compatibility)
  async createAuditLog(userId, eventData) {
    return await logAudit(eventData.event_type, userId, eventData);
  },

  // Delete user data (GDPR compliance) - ENHANCED WITH AUDIT LOGGING
  async deleteUserData(userId) {
    try {
      const results = [];
      
      // Delete in reverse dependency order
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
        const { error } = await supabaseAdmin
          .from(table)
          .delete()
          .eq('user_id', userId);
        
        results.push({
          table,
          success: !error,
          error: error?.message
        });
      }
      
      // Log the deletion
      await logAudit('user_data_deletion', userId, {
        action: 'delete_all',
        resource_type: 'user_data',
        details: { tables_affected: tables, results },
        success: true
      });
      
      return { success: true, results };
    } catch (error) {
      console.error('Error deleting user data:', error);
      
      // Log the failed deletion attempt
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
// EXPORTS - PHASE 1 COMPATIBILITY + BACKWARD COMPATIBILITY
// =============================================================================

module.exports = {
  // Phase 1 exports (from implementation plan)
  supabaseAdmin,
  supabaseClient,
  encrypt,
  decrypt,
  testConnection,
  logApiRequest,
  logAudit,
  
  // Backward compatibility exports
  supabaseAnon,
  supabaseHelpers
};