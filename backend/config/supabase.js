// backend/config/supabase.js - Supabase client with Cloudflare Tunnel
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '../.env' });

// Use tunnel URL instead of direct Supabase URL
const supabaseUrl = process.env.SUPABASE_TUNNEL_URL || process.env.SUPABASE_CLIENT_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Validate configuration
if (!supabaseUrl) {
  console.error('❌ Missing SUPABASE_TUNNEL_URL or SUPABASE_URL');
  console.log('📋 Required environment variables:');
  console.log('   SUPABASE_TUNNEL_URL=https://db-secure.888intelligenceautomation.in');
  console.log('   SUPABASE_SERVICE_KEY=your_service_key');
  process.exit(1);
}

// Log connection info (without exposing keys)
console.log('🔐 Supabase Configuration:');
console.log(`   URL: ${supabaseUrl}`);
console.log(`   Using Tunnel: ${supabaseUrl.includes('db-secure') ? 'Yes ✅' : 'No ❌'}`);
console.log(`   Service Key: ${supabaseServiceKey ? '✅ Set' : '❌ Missing'}`);
console.log(`   Anon Key: ${supabaseAnonKey ? '✅ Set' : '❌ Missing'}`);

// Create admin client with service role key (for backend operations)
let supabaseAdmin = null;
if (supabaseServiceKey) {
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  console.log('✅ Supabase admin client initialized');
}

// Create anon client (for public operations)
let supabaseAnon = null;
if (supabaseAnonKey) {
  supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  });
  console.log('✅ Supabase anon client initialized');
}

// Helper functions for common operations
const supabaseHelpers = {
  // Test database connection
  async testConnection() {
    try {
      const { data, error } = await supabaseAdmin
        .from('user_profiles')
        .select('count', { count: 'exact', head: true });
      
      if (error) throw error;
      
      console.log('✅ Database connection successful');
      return true;
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      return false;
    }
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
      return { success: true, data };
    } catch (error) {
      console.error('Error linking Instagram account:', error);
      return { success: false, error: error.message };
    }
  },

  // Store encrypted Instagram credentials
  async storeInstagramCredentials(userId, businessAccountId, credentials) {
    try {
      // Note: In production, encrypt tokens before storing
      const { data, error } = await supabaseAdmin
        .from('instagram_credentials')
        .insert({
          user_id: userId,
          business_account_id: businessAccountId,
          access_token_encrypted: credentials.accessToken, // Should be encrypted
          refresh_token_encrypted: credentials.refreshToken,
          token_type: 'Bearer',
          scope: credentials.scope || [],
          expires_at: credentials.expiresAt,
          is_active: true
        })
        .select()
        .single();
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error storing credentials:', error);
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

  // Audit log entry
  async createAuditLog(userId, eventData) {
    try {
      const { data, error } = await supabaseAdmin
        .from('audit_log')
        .insert({
          user_id: userId,
          ...eventData,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error creating audit log:', error);
      return { success: false, error: error.message };
    }
  },

  // Delete user data (GDPR compliance)
  async deleteUserData(userId) {
    try {
      // Start a transaction-like operation
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
      await this.createAuditLog(userId, {
        event_type: 'user_data_deletion',
        action: 'delete_all',
        details: { tables_affected: tables },
        success: true
      });
      
      return { success: true, results };
    } catch (error) {
      console.error('Error deleting user data:', error);
      return { success: false, error: error.message };
    }
  }
};

// Export clients and helpers
module.exports = {
  supabaseAdmin,
  supabaseAnon,
  supabaseHelpers
};