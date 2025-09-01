import { createClient } from '@supabase/supabase-js';

// =============================================================================
// DATABASE TYPE DEFINITIONS - Complete Schema Definition
// =============================================================================

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          user_id: string;
          username: string | null;
          full_name: string | null;
          email: string | null;
          avatar_url: string | null;
          business_name: string | null;
          business_website: string | null;
          industry: string | null;
          company_size: string | null;
          user_role: 'user' | 'admin' | 'super_admin';
          status: 'active' | 'inactive' | 'suspended' | 'pending';
          subscription_plan: 'free' | 'basic' | 'pro' | 'enterprise';
          instagram_connected: boolean;
          instagram_username: string | null;
          instagram_user_id: string | null;
          timezone: string;
          notification_preferences: any;
          ui_preferences: any;
          onboarding_completed: boolean;
          terms_accepted_at: string | null;
          privacy_accepted_at: string | null;
          last_active_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['user_profiles']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['user_profiles']['Insert']>;
      };
      admin_users: {
        Row: {
          id: string;
          user_id: string | null;
          email: string;
          full_name: string;
          role: 'user' | 'admin' | 'super_admin';
          permissions: any;
          is_active: boolean;
          last_login_at: string | null;
          login_attempts: number;
          locked_until: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['admin_users']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['admin_users']['Insert']>;
      };
      instagram_business_accounts: {
        Row: {
          id: string;
          user_id: string;
          instagram_business_id: string;
          instagram_user_id: string | null;
          name: string;
          username: string;
          account_type: 'personal' | 'business' | 'creator';
          biography: string | null;
          website: string | null;
          profile_picture_url: string | null;
          followers_count: number;
          following_count: number;
          media_count: number;
          is_connected: boolean;
          connection_status: string;
          last_sync_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['instagram_business_accounts']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['instagram_business_accounts']['Insert']>;
      };
      automation_workflows: {
        Row: {
          id: string;
          user_id: string;
          business_account_id: string | null;
          name: string;
          description: string | null;
          automation_type: 'engagement_monitor' | 'analytics_pipeline' | 'sales_attribution' | 'ugc_collection' | 'customer_service';
          n8n_workflow_id: string | null;
          n8n_webhook_url: string | null;
          webhook_token: string | null;
          configuration: any;
          trigger_conditions: any;
          status: 'active' | 'inactive' | 'error' | 'pending';
          is_active: boolean;
          total_executions: number;
          successful_executions: number;
          failed_executions: number;
          last_execution_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['automation_workflows']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['automation_workflows']['Insert']>;
      };
      audit_log: {
        Row: {
          id: string;
          user_id: string | null;
          event_type: string;
          resource_type: string | null;
          resource_id: string | null;
          action: string;
          details: any;
          ip_address: string | null;
          user_agent: string | null;
          success: boolean;
          error_message: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['audit_log']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['audit_log']['Insert']>;
      };
    };
  };
}

// =============================================================================
// TYPE DEFINITIONS - Fixed Interface Definitions
// =============================================================================

export interface ConnectionTestResult {
  connected: boolean;
  tunnel_active?: boolean;
  response_time_ms?: number;
  error?: string;
  database_info?: {
    url: string;
    schema: string;
    tunnel_domain?: string;
  };
}

export interface AuditEventOptions {
  userId?: string | null;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  errorMessage?: string;
  success?: boolean;
}

export interface SubscriptionOptions {
  onError?: (error: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

// =============================================================================
// CONNECTION CONFIGURATION
// =============================================================================

const supabaseUrl = 
  import.meta.env.VITE_SUPABASE_URL || 
  import.meta.env.VITE_SUPABASE_TUNNEL_URL || 
  import.meta.env.VITE_SUPABASE_DIRECT_URL;

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  const missingVars = [];
  if (!supabaseUrl) missingVars.push('VITE_SUPABASE_URL');
  if (!supabaseAnonKey) missingVars.push('VITE_SUPABASE_ANON_KEY');
  
  console.error('❌ Missing Supabase environment variables:', missingVars);
  throw new Error(`Missing required Supabase environment variables: ${missingVars.join(', ')}`);
}

// Log connection info (development only)
if (import.meta.env.VITE_ENVIRONMENT === 'development') {
  console.log('🔐 Frontend Supabase Configuration:');
  console.log(`   URL: ${supabaseUrl}`);
  console.log(`   Using Tunnel: ${supabaseUrl.includes('db-secure') ? 'Yes ✅' : 'No ❌'}`);
  console.log(`   Environment: ${import.meta.env.VITE_ENVIRONMENT || 'production'}`);
}

// =============================================================================
// SUPABASE CLIENT INITIALIZATION
// =============================================================================

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: 'instagram-automation-auth',
    flowType: 'pkce',
    debug: import.meta.env.VITE_ENVIRONMENT === 'development'
  },
  db: {
    schema: 'public'
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  global: {
    headers: {
      'X-Client-Info': 'instagram-automation-dashboard',
      'X-Client-Version': '1.0.0',
      'X-Client-Platform': 'web-frontend'
    }
  }
});

// =============================================================================
// CONNECTION TESTING - Fixed Implementation
// =============================================================================

export const testSupabaseConnection = async (): Promise<ConnectionTestResult> => {
  const startTime = Date.now();
  
  try {
    console.log('🔍 Testing frontend Supabase connection...');
    
    // Test basic connectivity with count query
    const { count, error } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error('❌ Supabase connection error:', error);
      return { 
        connected: false, 
        error: error.message,
        response_time_ms: Date.now() - startTime
      };
    }
    
    const responseTime = Date.now() - startTime;
    const tunnelActive = supabaseUrl.includes('db-secure') || supabaseUrl.includes('tunnel');
    
    console.log('✅ Frontend Supabase connected successfully');
    if (tunnelActive) {
      console.log('🔒 Connection secured via Cloudflare tunnel');
    }
    
    return {
      connected: true,
      tunnel_active: tunnelActive,
      response_time_ms: responseTime,
      database_info: {
        url: supabaseUrl,
        schema: 'public',
        tunnel_domain: tunnelActive ? 'db-secure.888intelligenceautomation.in' : undefined
      }
    };
    
  } catch (err: any) {
    console.error('❌ Connection test failed:', err);
    return { 
      connected: false, 
      error: err.message,
      response_time_ms: Date.now() - startTime
    };
  }
};

// =============================================================================
// AUDIT LOGGING - Fixed Implementation
// =============================================================================

export const logAuditEvent = async (
  eventType: string,
  action: string,
  details?: any,
  options: AuditEventOptions = {}
): Promise<void> => {
  try {
    // Build audit log entry with proper typing
    const auditEntry: Database['public']['Tables']['audit_log']['Insert'] = {
      user_id: options.userId || null,
      event_type: eventType,
      action: action,
      resource_type: options.resourceType || null,
      resource_id: options.resourceId || null,
      details: details || {},
      ip_address: options.ipAddress || 'web-client',
      user_agent: options.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'),
      success: options.success !== false,
      error_message: options.errorMessage || null
    };
    
    const { error } = await supabase
      .from('audit_log')
      .insert(auditEntry);
    
    if (error) {
      console.error('Audit log error:', error);
    } else if (import.meta.env.VITE_ENVIRONMENT === 'development') {
      console.log(`📝 Audit logged: ${eventType}/${action}`);
    }
    
  } catch (err) {
    console.error('Failed to log audit event:', err);
  }
};

// Convenience wrapper functions
export const logUserAction = async (
  action: string, 
  details?: any,
  userId?: string,
  resourceType?: string,
  resourceId?: string
): Promise<void> => {
  await logAuditEvent('user_action', action, details, {
    userId,
    resourceType,
    resourceId,
    success: true
  });
};

export const logAuthEvent = async (
  action: 'login' | 'logout' | 'signup' | 'password_reset',
  success: boolean,
  details?: any,
  userId?: string
): Promise<void> => {
  await logAuditEvent('authentication', action, details, {
    userId,
    success,
    errorMessage: success ? null : details?.error
  });
};

// =============================================================================
// SESSION MANAGEMENT
// =============================================================================

export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

export const getCurrentSession = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  } catch (error) {
    console.error('Error getting current session:', error);
    return null;
  }
};

// =============================================================================
// REAL-TIME SUBSCRIPTIONS
// =============================================================================

export const subscribeToTable = <T = any>(
  table: keyof Database['public']['Tables'],
  callback: (payload: any) => void,
  filter?: string,
  options: SubscriptionOptions = {}
) => {
  const channelName = `${table}-changes-${Date.now()}`;
  
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: table as string,
        filter: filter
      },
      (payload) => {
        try {
          callback(payload);
        } catch (error) {
          console.error(`Subscription callback error for ${table}:`, error);
          options.onError?.(error);
        }
      }
    )
    .subscribe((status) => {
      switch (status) {
        case 'SUBSCRIBED':
          console.log(`📡 Subscribed to ${table} changes`);
          options.onConnect?.();
          break;
        case 'CHANNEL_ERROR':
          console.error(`❌ Subscription error for ${table}`);
          options.onError?.(new Error(`Subscription failed for ${table}`));
          break;
        case 'CLOSED':
          console.log(`🔌 Subscription to ${table} closed`);
          options.onDisconnect?.();
          break;
      }
    });
  
  return {
    unsubscribe: () => {
      supabase.removeChannel(channel);
    }
  };
};

// =============================================================================
// UTILITY FUNCTIONS - Fixed Implementation
// =============================================================================

export const checkUserRole = async (userId: string, requiredRole: 'user' | 'admin' | 'super_admin'): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('user_role')
      .eq('user_id', userId)
      .single();
    
    if (error || !data) return false;
    
    // Fixed: Added null check and proper property access
    if (!data || !data.user_role) return false;
    
    const roleHierarchy: Record<string, number> = { 
      user: 1, 
      admin: 2, 
      super_admin: 3 
    };
    
    return roleHierarchy[data.user_role] >= roleHierarchy[requiredRole];
  } catch (error) {
    console.error('Error checking user role:', error);
    return false;
  }
};

export const batchInsert = async <T>(
  table: keyof Database['public']['Tables'],
  records: T[],
  batchSize: number = 100
): Promise<{ success: T[]; errors: any[] }> => {
  const success: T[] = [];
  const errors: any[] = [];
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    
    try {
      const { data, error } = await supabase
        .from(table as string)
        .insert(batch as any)
        .select();
      
      if (error) {
        errors.push({ batch: i / batchSize, error, records: batch });
      } else {
        success.push(...(data || []));
      }
    } catch (error) {
      errors.push({ batch: i / batchSize, error, records: batch });
    }
  }
  
  return { success, errors };
};

// =============================================================================
// CONNECTION HEALTH MONITORING
// =============================================================================

let connectionHealthInterval: NodeJS.Timeout | null = null;

export const startConnectionHealthMonitoring = (intervalMs: number = 30000) => {
  if (connectionHealthInterval) {
    clearInterval(connectionHealthInterval);
  }
  
  connectionHealthInterval = setInterval(async () => {
    try {
      await testSupabaseConnection();
    } catch (error) {
      console.warn('Connection health check failed:', error);
    }
  }, intervalMs);
};

export const stopConnectionHealthMonitoring = () => {
  if (connectionHealthInterval) {
    clearInterval(connectionHealthInterval);
    connectionHealthInterval = null;
  }
};

// =============================================================================
// EXPORTS - All Types Properly Defined
// =============================================================================

// Default export
export default supabase;

// Named exports for tree shaking
export {
  supabase as client,
  type Database,
  type ConnectionTestResult,
  type AuditEventOptions,
  type SubscriptionOptions
};

// Development helpers
if (import.meta.env.VITE_ENVIRONMENT === 'development') {
  (window as any).supabase = supabase;
  (window as any).testSupabaseConnection = testSupabaseConnection;
  console.log('🛠️ Development: Supabase client attached to window object');
}