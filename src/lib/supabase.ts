// =====================================
// STEP 1: Re-export all types from the GENERATED file for the rest of the app
// =====================================
export * from './database.types';

// =====================================
// STEP 2: Import necessary dependencies
// =====================================
import { createClient } from '@supabase/supabase-js';

// Import the main Database type from the GENERATED file
import type { Database } from './database.types';

// =====================================
// STEP 3: ALL MANUAL DATABASE TYPES HAVE BEEN REMOVED
// The Database interface and all table types are now imported from database.types.ts
// =====================================

// =====================================
// UTILITY TYPE DEFINITIONS (These remain as they are not schema-specific)
// =====================================

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

export interface RealtimeSubscription {
  unsubscribe: () => void;
}

// =====================================
// SUPABASE CLIENT CONFIGURATION
// =====================================

// Environment variable validation
const supabaseUrl = 
  import.meta.env.VITE_SUPABASE_URL || 
  import.meta.env.VITE_SUPABASE_TUNNEL_URL || 
  import.meta.env.VITE_SUPABASE_DIRECT_URL;

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate required environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  const missingVars = [];
  if (!supabaseUrl) missingVars.push('VITE_SUPABASE_URL');
  if (!supabaseAnonKey) missingVars.push('VITE_SUPABASE_ANON_KEY');
  
  console.error('❌ Missing Supabase environment variables:', missingVars);
  throw new Error(`Missing required Supabase environment variables: ${missingVars.join(', ')}`);
}

// =====================================
// STEP 4: Create typed Supabase client using the imported Database type
// =====================================
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

// =====================================
// CONNECTION TESTING
// =====================================

export const testSupabaseConnection = async (): Promise<ConnectionTestResult> => {
  const startTime = Date.now();
  
  try {
    console.log('🔍 Testing frontend Supabase connection...');
    
    const { error } = await supabase
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

// =====================================
// AUDIT LOGGING
// =====================================

export const logAuditEvent = async (
  eventType: string,
  action: string,
  details?: any,
  options: AuditEventOptions = {}
): Promise<void> => {
  try {
    const auditEntry = {
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
      .insert([auditEntry]);
    
    if (error) {
      console.error('Audit log error:', error);
    }
    
  } catch (err) {
    console.error('Failed to log audit event:', err);
  }
};

// =====================================
// SESSION MANAGEMENT
// =====================================

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

export const getUserProfile = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
};

// =====================================
// REAL-TIME SUBSCRIPTIONS
// =====================================

export const subscribeToTable = <T extends keyof Database['public']['Tables']>(
  table: T,
  callback: (payload: any) => void,
  filter?: string,
  options: SubscriptionOptions = {}
): RealtimeSubscription => {
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

export const subscribeToUserWorkflows = (
  userId: string,
  callback: (payload: any) => void
): RealtimeSubscription => {
  return subscribeToTable(
    'automation_workflows',
    callback,
    `user_id=eq.${userId}`
  );
};

export const subscribeToWorkflowExecutions = (
  workflowId: string,
  callback: (payload: any) => void
): RealtimeSubscription => {
  return subscribeToTable(
    'workflow_executions',
    callback,
    `workflow_id=eq.${workflowId}`
  );
};

// =====================================
// UTILITY FUNCTIONS
// =====================================

export const checkUserRole = async (userId: string, requiredRole: string): Promise<boolean> => {
  try {
    const profile = await getUserProfile(userId);
    
    if (!profile || !profile.user_role) return false;
    
    const roleHierarchy: Record<string, number> = { 
      user: 1, 
      admin: 2, 
      super_admin: 3 
    };
    
    return roleHierarchy[profile.user_role] >= roleHierarchy[requiredRole];
  } catch (error) {
    console.error('Error checking user role:', error);
    return false;
  }
};

export const isUserAdmin = async (userId: string): Promise<boolean> => {
  return checkUserRole(userId, 'admin');
};

export const isUserSuperAdmin = async (userId: string): Promise<boolean> => {
  return checkUserRole(userId, 'super_admin');
};

// API request logging utility
export const logApiRequest = async (
  endpoint: string,
  method: string,
  responseTimeMs: number,
  statusCode: number,
  success: boolean,
  errorMessage?: string
): Promise<void> => {
  try {
    const user = await getCurrentUser();
    if (!user) return;
    
    const apiUsageEntry = {
      user_id: user.id,
      endpoint,
      method,
      response_time_ms: responseTimeMs,
      status_code: statusCode,
      success,
      error_message: errorMessage,
      hour_bucket: new Date().toISOString().slice(0, 13) + ':00:00',
      request_count: 1,
      credits_consumed: 1
    };
    
    await supabase
      .from('api_usage')
      .upsert([apiUsageEntry], {
        onConflict: 'user_id,business_account_id,endpoint,method,hour_bucket',
        ignoreDuplicates: false
      });
  } catch (error) {
    console.error('Failed to log API request:', error);
  }
};

// =====================================
// TYPE GUARD UTILITIES (Using generated types)
// =====================================

export const isUserProfile = (data: any): data is Database['public']['Tables']['user_profiles']['Row'] => {
  return data && typeof data.user_id === 'string' && 'user_role' in data;
};

export const isAdminUser = (data: any): data is Database['public']['Tables']['admin_users']['Row'] => {
  return data && typeof data.email === 'string' && 'role' in data;
};

export const isWorkflow = (data: any): data is Database['public']['Tables']['automation_workflows']['Row'] => {
  return data && typeof data.automation_type === 'string' && 'status' in data;
};

// =====================================
// EXPORTS
// =====================================

export default supabase;

// Alias export for compatibility
export {
   supabase as client
}