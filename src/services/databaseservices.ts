// =====================================
// SIMPLIFIED IMPORTS - Single clean entry point
// =====================================
import { supabase } from '../lib/supabase';
import type * as Types from '../lib/supabase';

// =====================================
// SERVICE RESPONSE TYPES
// =====================================

interface ServiceResponse<T> {
  success: boolean;
  data: T | null;
  error?: string;
}

interface ServiceListResponse<T> {
  success: boolean;
  data: T[];
  error?: string;
  count?: number;
}

interface DeleteResponse {
  success: boolean;
  error?: string;
  affected?: number;
}

interface PaginationOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

// =====================================
// DATABASE SERVICE CLASS
// =====================================

export class DatabaseService {
  
  // =====================================
  // USER PROFILE OPERATIONS
  // =====================================
  
  /**
   * Retrieves a user profile by user ID
   */
  static async getUserProfile(userId: string): Promise<ServiceResponse<Types.Database['public']['Tables']['user_profiles']['Row']>> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          return { success: false, error: 'Profile not found', data: null };
        }
        throw error;
      }
      
      return { success: true, data };
    } catch (error: any) {
      console.error('Get user profile error:', error);
      return { success: false, error: error.message || 'Unknown error', data: null };
    }
  }
  
  /**
   * Updates a user profile - TypeScript ensures only valid fields are passed
   */
  static async updateUserProfile(
    userId: string, 
    updates: Types.Database['public']['Tables']['user_profiles']['Update']
  ): Promise<ServiceResponse<Types.Database['public']['Tables']['user_profiles']['Row']>> {
    try {
      // Direct pass-through - TypeScript already ensures type safety
      const { data, error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('user_id', userId)
        .select()
        .single();
      
      if (error) throw error;
      
      await this.logAuditEvent(userId, 'profile_updated', 'update', { updates });
      
      return { success: true, data };
    } catch (error: any) {
      console.error('Update profile error:', error);
      return { success: false, error: error.message || 'Unknown error', data: null };
    }
  }
  
  // =====================================
  // INSTAGRAM BUSINESS ACCOUNT OPERATIONS
  // =====================================
  
  /**
   * Gets all business accounts for a user
   *
   * UPDATED: Now validates that userId is a valid UUID format
   * Prevents "invalid input syntax for type uuid" errors
   */
  static async getBusinessAccounts(userId: string): Promise<ServiceListResponse<Types.Database['public']['Tables']['instagram_business_accounts']['Row']>> {
    try {
      // ===== CRITICAL: Validate UUID format =====
      // This prevents the "invalid input syntax for type uuid" error
      // when Facebook ID is mistakenly used instead of Supabase UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (!uuidRegex.test(userId)) {
        console.error('❌ Invalid user_id format. Expected UUID, got:', userId);
        console.error('   This is likely a Facebook ID being used instead of Supabase UUID');
        console.error('   Hint: Ensure authStore.user.id contains UUID, not Facebook ID');

        return {
          success: false,
          error: 'Invalid user_id format. Expected UUID.',
          data: []
        };
      }

      const { data, error, count } = await supabase
        .from('instagram_business_accounts')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .eq('is_connected', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return {
        success: true,
        data: data || [],
        count: count || 0
      };
    } catch (error: any) {
      console.error('Get business accounts error:', error);
      return { success: false, error: error.message, data: [] };
    }
  }
  
  /**
   * Creates or updates a business account
   */
  static async connectBusinessAccount(
    accountData: Types.Database['public']['Tables']['instagram_business_accounts']['Insert']
  ): Promise<ServiceResponse<Types.Database['public']['Tables']['instagram_business_accounts']['Row']>> {
    try {
      const { data, error } = await supabase
        .from('instagram_business_accounts')
        .upsert([accountData])
        .select()
        .single();
      
      if (error) throw error;
      
      await this.logAuditEvent(
        accountData.user_id,
        'account_connected',
        'create',
        { account_id: data.id, username: accountData.username }
      );
      
      return { success: true, data };
    } catch (error: any) {
      console.error('Connect business account error:', error);
      return { success: false, error: error.message, data: null };
    }
  }
  
  // =====================================
  // WORKFLOW OPERATIONS
  // =====================================
  
  /**
   * Gets all workflows for a user
   */
  static async getWorkflows(
    userId: string,
    options?: PaginationOptions
  ): Promise<ServiceListResponse<Types.Database['public']['Tables']['automation_workflows']['Row']>> {
    try {
      let query = supabase
        .from('automation_workflows')
        .select('*', { count: 'exact' })
        .eq('user_id', userId);
      
      // Apply pagination
      if (options?.limit) {
        query = query.limit(options.limit);
      }
      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
      }
      
      // Apply ordering
      const orderBy = options?.orderBy || 'created_at';
      const ascending = options?.orderDirection === 'asc';
      query = query.order(orderBy, { ascending });
      
      const { data, error, count } = await query;
      
      if (error) throw error;
      
      return { 
        success: true, 
        data: data || [],
        count: count || 0
      };
    } catch (error: any) {
      console.error('Get workflows error:', error);
      return { success: false, error: error.message, data: [] };
    }
  }
  
  /**
   * Creates a new workflow
   */
  static async createWorkflow(
    workflowData: Types.Database['public']['Tables']['automation_workflows']['Insert']
  ): Promise<ServiceResponse<Types.Database['public']['Tables']['automation_workflows']['Row']>> {
    try {
      const { data, error } = await supabase
        .from('automation_workflows')
        .insert([workflowData])
        .select()
        .single();
      
      if (error) throw error;
      
      await this.logAuditEvent(
        workflowData.user_id,
        'workflow_created',
        'create',
        { 
          workflow_id: data.id,
          name: workflowData.name,
          type: workflowData.automation_type 
        }
      );
      
      if (data.n8n_webhook_url) {
        await this.triggerN8NWorkflow(data);
      }
      
      return { success: true, data };
    } catch (error: any) {
      console.error('Create workflow error:', error);
      return { success: false, error: error.message, data: null };
    }
  }
  
  /**
   * Updates workflow status
   */
  static async updateWorkflowStatus(
    workflowId: string, 
    status: Types.Database['public']['Tables']['automation_workflows']['Row']['status']
  ): Promise<ServiceResponse<Types.Database['public']['Tables']['automation_workflows']['Row']>> {
    try {
      const updateData: Types.Database['public']['Tables']['automation_workflows']['Update'] = {
        status,
        is_active: status === 'active',
        last_execution_at: new Date().toISOString()
      };
      
      const { data, error } = await supabase
        .from('automation_workflows')
        .update(updateData)
        .eq('id', workflowId)
        .select()
        .single();
      
      if (error) throw error;
      
      return { success: true, data };
    } catch (error: any) {
      console.error('Update workflow status error:', error);
      return { success: false, error: error.message, data: null };
    }
  }
  
  /**
   * Deletes a workflow
   */
  static async deleteWorkflow(workflowId: string, userId: string): Promise<DeleteResponse> {
    try {
      const { error, count } = await supabase
        .from('automation_workflows')
        .delete({ count: 'exact' })
        .eq('id', workflowId)
        .eq('user_id', userId);
      
      if (error) throw error;
      
      await this.logAuditEvent(
        userId, 
        'workflow_deleted', 
        'delete', 
        { workflow_id: workflowId }
      );
      
      return { success: true, affected: count || 0 };
    } catch (error: any) {
      console.error('Delete workflow error:', error);
      return { success: false, error: error.message };
    }
  }
  
  // =====================================
  // WORKFLOW EXECUTION OPERATIONS
  // =====================================
  
  /**
   * Creates a workflow execution record
   */
  static async createWorkflowExecution(
    executionData: Types.Database['public']['Tables']['workflow_executions']['Insert']
  ): Promise<ServiceResponse<Types.Database['public']['Tables']['workflow_executions']['Row']>> {
    try {
      const { data, error } = await supabase
        .from('workflow_executions')
        .insert([executionData])
        .select()
        .single();
      
      if (error) throw error;
      
      return { success: true, data };
    } catch (error: any) {
      console.error('Create workflow execution error:', error);
      return { success: false, error: error.message, data: null };
    }
  }
  
  /**
   * Gets workflow executions
   */
  static async getWorkflowExecutions(
    workflowId: string, 
    limit: number = 50
  ): Promise<ServiceListResponse<Types.Database['public']['Tables']['workflow_executions']['Row']>> {
    try {
      const { data, error, count } = await supabase
        .from('workflow_executions')
        .select('*', { count: 'exact' })
        .eq('workflow_id', workflowId)
        .order('started_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      
      return { 
        success: true, 
        data: data || [],
        count: count || 0
      };
    } catch (error: any) {
      console.error('Get workflow executions error:', error);
      return { success: false, error: error.message, data: [] };
    }
  }
  
  // =====================================
  // ANALYTICS OPERATIONS
  // =====================================
  
  /**
   * Gets daily analytics data
   */
  static async getDailyAnalytics(
    userId: string, 
    businessAccountId?: string, 
    days: number = 30
  ): Promise<ServiceListResponse<Types.Database['public']['Tables']['daily_analytics']['Row']>> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      let query = supabase
        .from('daily_analytics')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .gte('date', startDate.toISOString().split('T')[0])
        .order('date', { ascending: false });
      
      if (businessAccountId) {
        query = query.eq('business_account_id', businessAccountId);
      }
      
      const { data, error, count } = await query;
      
      if (error) throw error;
      
      return { 
        success: true, 
        data: data || [],
        count: count || 0
      };
    } catch (error: any) {
      console.error('Get analytics error:', error);
      return { success: false, error: error.message, data: [] };
    }
  }
  
  /**
   * Creates or updates daily analytics
   */
  static async upsertDailyAnalytics(
    analyticsData: Types.Database['public']['Tables']['daily_analytics']['Insert']
  ): Promise<ServiceResponse<Types.Database['public']['Tables']['daily_analytics']['Row']>> {
    try {
      const { data, error } = await supabase
        .from('daily_analytics')
        .upsert([analyticsData], {
          onConflict: 'business_account_id,date'
        })
        .select()
        .single();
      
      if (error) throw error;
      
      return { success: true, data };
    } catch (error: any) {
      console.error('Upsert daily analytics error:', error);
      return { success: false, error: error.message, data: null };
    }
  }
  
  // =====================================
  // AUDIT LOGGING
  // =====================================
  
  /**
   * Creates an audit log entry
   */
  private static async logAuditEvent(
    userId: string,
    eventType: string,
    action: string,
    details?: any
  ): Promise<void> {
    try {
      const auditEntry: Types.Database['public']['Tables']['audit_log']['Insert'] = {
        user_id: userId,
        event_type: eventType,
        action: action,
        details: details || {},
        ip_address: 'web-client',
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        success: true
      };
      
      const { error } = await supabase
        .from('audit_log')
        .insert([auditEntry]);
      
      if (error) {
        console.error('Audit log error:', error);
      }
    } catch (error) {
      console.error('Audit log exception:', error);
    }
  }
  
  /**
   * Gets audit logs for a user
   */
  static async getAuditLogs(
    userId: string, 
    limit: number = 100
  ): Promise<ServiceListResponse<Types.Database['public']['Tables']['audit_log']['Row']>> {
    try {
      const { data, error, count } = await supabase
        .from('audit_log')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      
      return { 
        success: true, 
        data: data || [],
        count: count || 0
      };
    } catch (error: any) {
      console.error('Get audit logs error:', error);
      return { success: false, error: error.message, data: [] };
    }
  }
  
  // =====================================
  // NOTIFICATIONS
  // =====================================
  
  /**
   * Creates a notification
   */
  static async createNotification(
    notificationData: Types.Database['public']['Tables']['notifications']['Insert']
  ): Promise<ServiceResponse<Types.Database['public']['Tables']['notifications']['Row']>> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert([notificationData])
        .select()
        .single();
      
      if (error) throw error;
      
      return { success: true, data };
    } catch (error: any) {
      console.error('Create notification error:', error);
      return { success: false, error: error.message, data: null };
    }
  }
  
  /**
   * Gets notifications for a user
   */
  static async getNotifications(
    userId: string,
    unreadOnly: boolean = false
  ): Promise<ServiceListResponse<Types.Database['public']['Tables']['notifications']['Row']>> {
    try {
      let query = supabase
        .from('notifications')
        .select('*', { count: 'exact' })
        .or(`user_id.eq.${userId},target_user_ids.cs.{${userId}}`)
        .order('created_at', { ascending: false });
      
      if (unreadOnly) {
        query = query.eq('is_read', false);
      }
      
      const { data, error, count } = await query;
      
      if (error) throw error;
      
      return { 
        success: true, 
        data: data || [],
        count: count || 0
      };
    } catch (error: any) {
      console.error('Get notifications error:', error);
      return { success: false, error: error.message, data: [] };
    }
  }
  
  // =====================================
  // API USAGE TRACKING
  // =====================================
  
  /**
   * Tracks API usage
   */
  static async trackApiUsage(
    userId: string,
    endpoint: string,
    method: string,
    responseTimeMs?: number,
    statusCode?: number,
    success: boolean = true,
    errorMessage?: string
  ): Promise<void> {
    try {
      const usageEntry: Types.Database['public']['Tables']['api_usage']['Insert'] = {
        user_id: userId,
        endpoint,
        method,
        hour_bucket: new Date().toISOString().slice(0, 13) + ':00:00',
        request_count: 1,
        response_time_ms: responseTimeMs,
        status_code: statusCode,
        success,
        error_message: errorMessage,
        credits_consumed: 1
      };
      
      const { error } = await supabase
        .from('api_usage')
        .upsert([usageEntry], {
          onConflict: 'user_id,business_account_id,endpoint,method,hour_bucket'
        });
      
      if (error) {
        console.error('API usage tracking error:', error);
      }
    } catch (error) {
      console.error('API usage tracking exception:', error);
    }
  }
  
  // =====================================
  // DATA PRIVACY (GDPR COMPLIANCE)
  // =====================================
  
  /**
   * Deletes user data for GDPR compliance
   */
  static async deleteUserData(
    userId: string, 
    options: {
      deleteProfile?: boolean;
      deleteAccounts?: boolean;
      deleteWorkflows?: boolean;
      deleteAnalytics?: boolean;
      deleteAuditLogs?: boolean;
      deleteNotifications?: boolean;
    } = {}
  ): Promise<{ success: boolean; results: Record<string, boolean>; error?: string }> {
    try {
      const results: Record<string, boolean> = {};
      
      // Delete in dependency order
      if (options.deleteWorkflows) {
        const { error } = await supabase
          .from('automation_workflows')
          .delete()
          .eq('user_id', userId);
        results.workflows = !error;
      }
      
      if (options.deleteAnalytics) {
        const { error } = await supabase
          .from('daily_analytics')
          .delete()
          .eq('user_id', userId);
        results.analytics = !error;
      }
      
      if (options.deleteAccounts) {
        const { error } = await supabase
          .from('instagram_business_accounts')
          .delete()
          .eq('user_id', userId);
        results.accounts = !error;
      }
      
      if (options.deleteNotifications) {
        const { error } = await supabase
          .from('notifications')
          .delete()
          .eq('user_id', userId);
        results.notifications = !error;
      }
      
      if (options.deleteAuditLogs) {
        const { error } = await supabase
          .from('audit_log')
          .delete()
          .eq('user_id', userId);
        results.auditLogs = !error;
      }
      
      if (options.deleteProfile) {
        const { error } = await supabase
          .from('user_profiles')
          .delete()
          .eq('user_id', userId);
        results.profile = !error;
      }
      
      await this.logAuditEvent(
        userId, 
        'data_deletion_requested', 
        'delete', 
        { options, results }
      );
      
      return { success: true, results };
    } catch (error: any) {
      console.error('Delete user data error:', error);
      return { success: false, error: error.message, results: {} };
    }
  }
  
  /**
   * Exports user data for GDPR compliance
   */
  static async exportUserData(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const [profile, accounts, workflows, analytics, auditLogs, notifications] = await Promise.all([
        this.getUserProfile(userId),
        this.getBusinessAccounts(userId),
        this.getWorkflows(userId),
        this.getDailyAnalytics(userId),
        this.getAuditLogs(userId),
        this.getNotifications(userId)
      ]);
      
      const exportData = {
        exportDate: new Date().toISOString(),
        userId,
        profile: profile.data,
        instagramAccounts: accounts.data,
        workflows: workflows.data,
        analytics: analytics.data,
        auditLogs: auditLogs.data,
        notifications: notifications.data
      };
      
      // Create and download JSON file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
        type: 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `user-data-export-${userId}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      await this.logAuditEvent(
        userId,
        'data_exported',
        'export',
        { timestamp: new Date().toISOString() }
      );
      
      return { success: true };
    } catch (error: any) {
      console.error('Export user data error:', error);
      return { success: false, error: error.message };
    }
  }
  
  // =====================================
  // HELPER METHODS
  // =====================================
  
  /**
   * Triggers an N8N workflow
   */
  private static async triggerN8NWorkflow(
    workflow: Types.Database['public']['Tables']['automation_workflows']['Row']
  ): Promise<void> {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'https://api.888intelligenceautomation.in';
      
      const response = await fetch(`${apiUrl}/webhook/trigger-workflow`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Webhook-Token': workflow.webhook_token || ''
        },
        body: JSON.stringify({
          workflow_type: workflow.automation_type,
          workflow_id: workflow.id,
          user_id: workflow.user_id,
          n8n_workflow_id: workflow.n8n_workflow_id,
          data: {
            configuration: workflow.configuration,
            trigger_conditions: workflow.trigger_conditions
          }
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('N8N trigger failed:', errorText);
      }
    } catch (error) {
      console.error('N8N trigger error:', error);
    }
  }
  
  /**
   * Checks if a user has the required role
   */
  static async checkUserPermission(
    userId: string, 
    requiredRole: Types.Database['public']['Tables']['user_profiles']['Row']['user_role']
  ): Promise<boolean> {
    try {
      const { data } = await this.getUserProfile(userId);
      
      if (!data) return false;
      
      const roleHierarchy: Record<string, number> = {
        user: 1,
        admin: 2,
        super_admin: 3
      };
      
      return roleHierarchy[data.user_role] >= roleHierarchy[requiredRole];
    } catch (error) {
      console.error('Check user permission error:', error);
      return false;
    }
  }
  
  /**
   * Validates if user can perform action on resource
   */
  static async validateResourceAccess(
    userId: string,
    resourceType: string,
    resourceId: string,
    _action: string
  ): Promise<boolean> {
    try {
      // Check if user is admin
      const isAdmin = await this.checkUserPermission(userId, 'admin');
      if (isAdmin) return true;
      
      // Check resource ownership based on type
      switch (resourceType) {
        case 'workflow':
          const { data: workflow } = await supabase
            .from('automation_workflows')
            .select('user_id')
            .eq('id', resourceId)
            .single();
          return workflow?.user_id === userId;
          
        case 'instagram_account':
          const { data: account } = await supabase
            .from('instagram_business_accounts')
            .select('user_id')
            .eq('id', resourceId)
            .single();
          return account?.user_id === userId;
          
        default:
          return false;
      }
    } catch (error) {
      console.error('Validate resource access error:', error);
      return false;
    }
  }
}