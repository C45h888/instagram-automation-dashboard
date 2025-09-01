import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';
import toast from 'react-hot-toast';

type Tables = Database['public']['Tables'];
type WorkflowType = Tables['automation_workflows']['Row']['automation_type'];
type WorkflowStatus = Tables['automation_workflows']['Row']['status'];

// Performance optimized batch operations
const BATCH_SIZE = 50;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Simple in-memory cache for frequently accessed data
const cache = new Map<string, { data: any; timestamp: number }>();

export class DatabaseService {
  // ============= CACHE MANAGEMENT =============
  private static getCached<T>(key: string): T | null {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data as T;
    }
    cache.delete(key);
    return null;
  }

  private static setCache(key: string, data: any): void {
    cache.set(key, { data, timestamp: Date.now() });
  }

  // ============= USER PROFILE OPERATIONS =============
  static async getUserProfile(userId: string) {
    const cacheKey = `profile_${userId}`;
    const cached = this.getCached(cacheKey);
    if (cached) return { success: true, data: cached };

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error) throw error;
      
      this.setCache(cacheKey, data);
      return { success: true, data };
    } catch (error: any) {
      console.error('Get user profile error:', error);
      return { success: false, error: error.message };
    }
  }

  static async updateUserProfile(
    userId: string, 
    updates: Partial<Tables['user_profiles']['Update']>
  ) {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .select()
        .single();
      
      if (error) throw error;
      
      // Invalidate cache
      cache.delete(`profile_${userId}`);
      
      await this.logAudit('profile_updated', userId, { updates });
      toast.success('Profile updated successfully');
      return { success: true, data };
    } catch (error: any) {
      console.error('Update profile error:', error);
      toast.error('Failed to update profile');
      return { success: false, error: error.message };
    }
  }

  // ============= WORKFLOW OPERATIONS (OPTIMIZED) =============
  static async getWorkflows(userId: string) {
    const cacheKey = `workflows_${userId}`;
    const cached = this.getCached(cacheKey);
    if (cached) return { success: true, data: cached };

    try {
      const { data, error } = await supabase
        .from('automation_workflows')
        .select(`
          *,
          workflow_executions (
            id,
            status,
            started_at,
            completed_at,
            execution_time_ms
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(BATCH_SIZE);
      
      if (error) throw error;
      
      this.setCache(cacheKey, data);
      return { success: true, data };
    } catch (error: any) {
      console.error('Get workflows error:', error);
      return { success: false, error: error.message };
    }
  }

  static async createWorkflow(workflowData: {
    user_id: string;
    name: string;
    automation_type: WorkflowType;
    configuration?: any;
    business_account_id?: string;
  }) {
    try {
      const { data, error } = await supabase
        .from('automation_workflows')
        .insert({
          ...workflowData,
          status: 'pending',
          is_active: false,
          n8n_workflow_id: `n8n_${workflowData.automation_type}_${Date.now()}`,
          webhook_token: crypto.randomUUID()
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Invalidate cache
      cache.delete(`workflows_${workflowData.user_id}`);
      
      await this.logAudit('workflow_created', workflowData.user_id, {
        workflow_id: data.id,
        name: workflowData.name
      });
      
      // Trigger N8N webhook asynchronously
      this.triggerN8NWorkflow(data).catch(console.error);
      
      toast.success(`Workflow "${workflowData.name}" created`);
      return { success: true, data };
    } catch (error: any) {
      console.error('Create workflow error:', error);
      toast.error('Failed to create workflow');
      return { success: false, error: error.message };
    }
  }

  static async updateWorkflowStatus(
    workflowId: string, 
    status: WorkflowStatus,
    userId: string
  ) {
    try {
      const { data, error } = await supabase
        .from('automation_workflows')
        .update({ 
          status,
          is_active: status === 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', workflowId)
        .eq('user_id', userId) // Extra security check
        .select()
        .single();
      
      if (error) throw error;
      
      cache.delete(`workflows_${userId}`);
      
      const message = status === 'active' ? 'Workflow activated' : 
                     status === 'inactive' ? 'Workflow paused' : 
                     'Workflow status updated';
      toast.success(message);
      return { success: true, data };
    } catch (error: any) {
      console.error('Update workflow status error:', error);
      toast.error('Failed to update workflow status');
      return { success: false, error: error.message };
    }
  }

  static async deleteWorkflow(workflowId: string, userId: string) {
    try {
      // First, delete all executions (cascade)
      await supabase
        .from('workflow_executions')
        .delete()
        .eq('workflow_id', workflowId);
      
      // Then delete the workflow
      const { error } = await supabase
        .from('automation_workflows')
        .delete()
        .eq('id', workflowId)
        .eq('user_id', userId);
      
      if (error) throw error;
      
      cache.delete(`workflows_${userId}`);
      
      await this.logAudit('workflow_deleted', userId, { workflow_id: workflowId });
      toast.success('Workflow deleted');
      return { success: true };
    } catch (error: any) {
      console.error('Delete workflow error:', error);
      toast.error('Failed to delete workflow');
      return { success: false, error: error.message };
    }
  }

  // ============= ANALYTICS OPERATIONS (OPTIMIZED) =============
  static async getDailyAnalytics(businessAccountId: string, days: number = 30) {
    const cacheKey = `analytics_${businessAccountId}_${days}`;
    const cached = this.getCached(cacheKey);
    if (cached) return { success: true, data: cached };

    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const { data, error } = await supabase
        .from('daily_analytics')
        .select('*')
        .eq('business_account_id', businessAccountId)
        .gte('date', startDate.toISOString().split('T')[0])
        .order('date', { ascending: false });
      
      if (error) throw error;
      
      this.setCache(cacheKey, data);
      return { success: true, data };
    } catch (error: any) {
      console.error('Get analytics error:', error);
      return { success: false, error: error.message };
    }
  }

  static async getAnalyticsSummary(businessAccountId: string) {
    const result = await this.getDailyAnalytics(businessAccountId, 30);
    
    if (!result.success || !result.data || result.data.length === 0) {
      return { success: true, summary: null };
    }
    
    const data = result.data;
    
    // Optimized calculation
    const summary = {
      currentFollowers: data[0].followers_count,
      followerGrowth: data[0].followers_count - (data[data.length - 1]?.followers_count || 0),
      avgEngagement: data.reduce((acc, d) => acc + (d.engagement_rate || 0), 0) / data.length,
      totalImpressions: data.reduce((acc, d) => acc + (d.impressions_count || 0), 0),
      totalReach: data.reduce((acc, d) => acc + (d.reach_count || 0), 0),
      periodDays: data.length,
      growthRate: data.length > 1 
        ? ((data[0].followers_count - data[data.length - 1].followers_count) / 
           data[data.length - 1].followers_count * 100)
        : 0
    };
    
    return { success: true, summary };
  }

  // ============= DATA DELETION (GDPR COMPLIANT) =============
  static async deleteUserData(userId: string, options: {
    deleteProfile?: boolean;
    deleteAccounts?: boolean;
    deleteWorkflows?: boolean;
    deleteAnalytics?: boolean;
    deleteAuditLogs?: boolean;
  } = {}) {
    const results: Record<string, boolean> = {};
    
    try {
      // Use transaction-like approach with error handling
      const operations = [];
      
      if (options.deleteAccounts) {
        operations.push(
          supabase
            .from('instagram_business_accounts')
            .delete()
            .eq('user_id', userId)
            .then(() => { results.accounts = true; })
            .catch(() => { results.accounts = false; })
        );
      }
      
      if (options.deleteWorkflows) {
        // Delete executions first
        operations.push(
          supabase
            .from('workflow_executions')
            .delete()
            .eq('user_id', userId)
            .then(() => 
              supabase
                .from('automation_workflows')
                .delete()
                .eq('user_id', userId)
            )
            .then(() => { results.workflows = true; })
            .catch(() => { results.workflows = false; })
        );
      }
      
      if (options.deleteAnalytics) {
        operations.push(
          supabase
            .from('daily_analytics')
            .delete()
            .eq('user_id', userId)
            .then(() => { results.analytics = true; })
            .catch(() => { results.analytics = false; })
        );
      }
      
      await Promise.all(operations);
      
      // Delete profile last
      if (options.deleteProfile) {
        const { error } = await supabase
          .from('user_profiles')
          .delete()
          .eq('user_id', userId);
        
        results.profile = !error;
      }
      
      await this.logAudit('data_deletion_completed', userId, { options, results });
      
      toast.success('Data deletion completed');
      return { success: true, results };
    } catch (error: any) {
      console.error('Delete user data error:', error);
      toast.error('Failed to delete user data');
      return { success: false, error: error.message, results };
    }
  }

  // ============= HELPER METHODS =============
  private static async logAudit(
    eventType: string,
    userId: string | null,
    details: any = {}
  ) {
    try {
      await supabase.from('audit_log').insert({
        user_id: userId,
        event_type: eventType,
        action: details.action || eventType.split('_')[0],
        details,
        ip_address: 'web-client',
        user_agent: navigator.userAgent,
        success: true
      });
    } catch (error) {
      console.error('Audit log error:', error);
    }
  }

  private static async triggerN8NWorkflow(workflow: any) {
    const apiUrl = import.meta.env.VITE_API_URL || 'https://instagram-backend.888intelligenceautomation.in';
    
    try {
      const response = await fetch(`${apiUrl}/webhook/trigger-workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow_type: workflow.automation_type,
          workflow_id: workflow.id,
          n8n_workflow_id: workflow.n8n_workflow_id,
          webhook_token: workflow.webhook_token
        })
      });
      
      if (!response.ok) {
        console.error('N8N trigger failed:', await response.text());
      }
    } catch (error) {
      console.error('N8N trigger error:', error);
    }
  }

  // Batch operations for performance
  static async batchGetWorkflows(userIds: string[]) {
    try {
      const { data, error } = await supabase
        .from('automation_workflows')
        .select('*')
        .in('user_id', userIds)
        .limit(500);
      
      if (error) throw error;
      
      // Group by user_id
      const grouped = data.reduce((acc, workflow) => {
        if (!acc[workflow.user_id]) acc[workflow.user_id] = [];
        acc[workflow.user_id].push(workflow);
        return acc;
      }, {} as Record<string, any[]>);
      
      return { success: true, data: grouped };
    } catch (error: any) {
      console.error('Batch get workflows error:', error);
      return { success: false, error: error.message };
    }
  }
}