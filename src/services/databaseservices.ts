import { supabase } from '../lib/supabase';
import type { Database } from '../lib/supabase';


// Type definitions from your schema
type Tables = Database['public']['Tables'];
type UserProfile = Tables['user_profiles']['Row'];
type UserProfileUpdate = Tables['user_profiles']['Update'];
type AuditLogInsert = Tables['audit_log']['Insert'];
type WorkflowRow = Tables['automation_workflows']['Row'];
type WorkflowType = 'engagement_monitor' | 'analytics_pipeline' | 'sales_attribution' | 'ugc_collection' | 'customer_service';
type WorkflowStatus = 'active' | 'inactive' | 'error' | 'pending';

export interface WorkflowInsert {
  user_id: string;
  business_account_id?: string;
  name: string;
  description?: string;
  automation_type: WorkflowType;
  n8n_workflow_id?: string;
  n8n_webhook_url?: string;
  webhook_token?: string;
  configuration?: any;
  trigger_conditions?: any;
  status?: WorkflowStatus;
  is_active?: boolean;
}

export interface ExecutionInsert {
  workflow_id: string;
  user_id: string;
  execution_id?: string;
  trigger_source?: string;
  status: string;
  started_at?: string;
  completed_at?: string;
  execution_time_ms?: number;
  input_data?: any;
  output_data?: any;
  error_data?: any;
}

export interface AnalyticsInsert {
  business_account_id: string;
  user_id: string;
  date: string;
  followers_count?: number;
  following_count?: number;
  media_count?: number;
  total_likes?: number;
  total_comments?: number;
  total_shares?: number;
  total_reach?: number;
  total_impressions?: number;
  engagement_rate?: number;
}

// Helper function to clean update objects
const cleanUpdateObject = <T extends Record<string, any>>(obj: T): Partial<T> => {
  const cleaned = { ...obj };
  // Remove auto-generated fields
  delete (cleaned as any).id;
  delete (cleaned as any).created_at;
  delete (cleaned as any).updated_at;
  return cleaned;
};

export class DatabaseService {
  // User Profile Operations
  static async getUserProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return { success: true, data };
    } catch (error: any) {
      console.error('Get user profile error:', error);
      return { success: false, error: error.message, data: null };
    }
  }
  
  static async updateUserProfile(userId: string, updates: Partial<UserProfileUpdate>) {
    try {
      // Clean the updates object to remove auto-generated fields
      const cleanedUpdates = cleanUpdateObject(updates);
      
      const { data, error } = await supabase
        .from('user_profiles')
        .update(cleanedUpdates)
        .eq('user_id', userId)
        .select()
        .single();
      
      if (error) throw error;
      
      await this.logAuditEvent(userId, 'profile_updated', 'update', { updates: cleanedUpdates });
      
      return { success: true, data };
    } catch (error: any) {
      console.error('Update profile error:', error);
      return { success: false, error: error.message, data: null };
    }
  }
  
  // Instagram Business Account Operations
  static async getBusinessAccounts(userId: string) {
    try {
      const { data, error } = await supabase
        .from('instagram_business_accounts')
        .select('*')
        .eq('user_id', userId)
        .eq('is_connected', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error: any) {
      console.error('Get business accounts error:', error);
      return { success: false, error: error.message, data: [] };
    }
  }
  
  // Workflow Operations
  static async getWorkflows(userId: string) {
    try {
      const { data, error } = await supabase
        .from('automation_workflows')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error: any) {
      console.error('Get workflows error:', error);
      return { success: false, error: error.message, data: [] };
    }
  }
  
  static async createWorkflow(workflowData: WorkflowInsert) {
    try {
      // Ensure the workflow data doesn't include auto-generated fields
      const insertData = {
        user_id: workflowData.user_id,
        business_account_id: workflowData.business_account_id || null,
        name: workflowData.name,
        description: workflowData.description || null,
        automation_type: workflowData.automation_type,
        n8n_workflow_id: workflowData.n8n_workflow_id || null,
        n8n_webhook_url: workflowData.n8n_webhook_url || null,
        webhook_token: workflowData.webhook_token || null,
        configuration: workflowData.configuration || {},
        trigger_conditions: workflowData.trigger_conditions || {},
        status: workflowData.status || 'inactive',
        is_active: workflowData.is_active || false
      };
      
      const { data, error } = await supabase
        .from('automation_workflows')
        .insert(insertData)
        .select()
        .single();
      
      if (error) throw error;
      
      const workflow = data as WorkflowRow;
      
      await this.logAuditEvent(
        workflowData.user_id,
        'workflow_created',
        'create',
        { 
          workflow_id: workflow.id,
          name: workflowData.name,
          type: workflowData.automation_type 
        }
      );
      
      if (workflowData.n8n_webhook_url) {
        await this.triggerN8NWorkflow(workflow);
      }
      
      return { success: true, data: workflow };
    } catch (error: any) {
      console.error('Create workflow error:', error);
      return { success: false, error: error.message, data: null };
    }
  }
  
  static async updateWorkflowStatus(workflowId: string, status: WorkflowStatus) {
    try {
      // Only update fields that should be modified
      const updateData = {
        status,
        is_active: status === 'active'
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
  
  static async deleteWorkflow(workflowId: string, userId: string) {
    try {
      const { error } = await supabase
        .from('automation_workflows')
        .delete()
        .eq('id', workflowId)
        .eq('user_id', userId);
      
      if (error) throw error;
      
      await this.logAuditEvent(userId, 'workflow_deleted', 'delete', { workflow_id: workflowId });
      
      return { success: true };
    } catch (error: any) {
      console.error('Delete workflow error:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Analytics Operations
  static async getDailyAnalytics(userId: string, businessAccountId?: string, days: number = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      let query = supabase
        .from('daily_analytics')
        .select('*')
        .eq('user_id', userId)
        .gte('date', startDate.toISOString().split('T')[0])
        .order('date', { ascending: false });
      
      if (businessAccountId) {
        query = query.eq('business_account_id', businessAccountId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error: any) {
      console.error('Get analytics error:', error);
      return { success: false, error: error.message, data: [] };
    }
  }
  
  // Data Deletion (GDPR)
  static async deleteUserData(userId: string, options: {
    deleteProfile?: boolean;
    deleteAccounts?: boolean;
    deleteWorkflows?: boolean;
    deleteAnalytics?: boolean;
    deleteAuditLogs?: boolean;
  } = {}) {
    try {
      const results: Record<string, boolean> = {};
      
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
      
      await this.logAuditEvent(userId, 'data_deletion_requested', 'delete', { options, results });
      
      return { success: true, results };
    } catch (error: any) {
      console.error('Delete user data error:', error);
      return { success: false, error: error.message, results: {} };
    }
  }
  
  static async exportUserData(userId: string) {
    try {
      const [profile, accounts, workflows, analytics, auditLogs] = await Promise.all([
        this.getUserProfile(userId),
        this.getBusinessAccounts(userId),
        this.getWorkflows(userId),
        this.getDailyAnalytics(userId),
        this.getAuditLogs(userId)
      ]);
      
      const exportData = {
        exportDate: new Date().toISOString(),
        userId,
        profile: profile.data,
        instagramAccounts: accounts.data,
        workflows: workflows.data,
        analytics: analytics.data,
        auditLogs: auditLogs.data
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `user-data-export-${userId}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      return { success: true };
    } catch (error: any) {
      console.error('Export user data error:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Helper Methods
  private static async logAuditEvent(
    userId: string,
    eventType: string,
    action: string,
    details?: any,
    resourceType?: string | null,
    resourceId?: string | null
  ) {
    try {
      // Create properly typed audit entry matching the schema
      const auditEntry: AuditLogInsert = {
        user_id: userId,
        event_type: eventType,
        action: action,
        resource_type: resourceType || null,
        resource_id: resourceId || null,
        details: details || {},
        ip_address: 'web-client',
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        success: true,
        error_message: null
      };
      
      const { error } = await supabase
        .from('audit_log')
        .insert([auditEntry]);
      
      if (error) console.error('Audit log error:', error);
    } catch (error) {
      console.error('Audit log error:', error);
    }
  }
  
  static async getAuditLogs(userId: string, limit: number = 100) {
    try {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error: any) {
      console.error('Get audit logs error:', error);
      return { success: false, error: error.message, data: [] };
    }
  }
  
  private static async triggerN8NWorkflow(workflow: WorkflowRow) {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'https://instagram-backend.888intelligenceautomation.in';
      const response = await fetch(`${apiUrl}/webhook/trigger-workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow_type: workflow.automation_type,
          workflow_id: workflow.id,
          user_id: workflow.user_id,
          data: workflow
        })
      });
      
      if (!response.ok) {
        console.error('N8N trigger failed');
      }
    } catch (error) {
      console.error('N8N trigger error:', error);
    }
  }
}