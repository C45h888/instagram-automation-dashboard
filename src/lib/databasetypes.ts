export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          user_id: string
          username: string | null
          full_name: string | null
          email: string | null
          avatar_url: string | null
          business_name: string | null
          business_website: string | null
          industry: string | null
          company_size: string | null
          user_role: 'user' | 'admin' | 'super_admin'
          status: 'active' | 'inactive' | 'suspended' | 'pending'
          subscription_plan: 'free' | 'basic' | 'pro' | 'enterprise'
          instagram_connected: boolean
          instagram_username: string | null
          instagram_user_id: string | null
          timezone: string
          notification_preferences: Json
          ui_preferences: Json
          onboarding_completed: boolean
          terms_accepted_at: string | null
          privacy_accepted_at: string | null
          last_active_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          username?: string | null
          full_name?: string | null
          email?: string | null
          avatar_url?: string | null
          business_name?: string | null
          business_website?: string | null
          industry?: string | null
          company_size?: string | null
          user_role?: 'user' | 'admin' | 'super_admin'
          status?: 'active' | 'inactive' | 'suspended' | 'pending'
          subscription_plan?: 'free' | 'basic' | 'pro' | 'enterprise'
          instagram_connected?: boolean
          instagram_username?: string | null
          instagram_user_id?: string | null
          timezone?: string
          notification_preferences?: Json
          ui_preferences?: Json
          onboarding_completed?: boolean
          terms_accepted_at?: string | null
          privacy_accepted_at?: string | null
          last_active_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          username?: string | null
          full_name?: string | null
          email?: string | null
          avatar_url?: string | null
          business_name?: string | null
          business_website?: string | null
          industry?: string | null
          company_size?: string | null
          user_role?: 'user' | 'admin' | 'super_admin'
          status?: 'active' | 'inactive' | 'suspended' | 'pending'
          subscription_plan?: 'free' | 'basic' | 'pro' | 'enterprise'
          instagram_connected?: boolean
          instagram_username?: string | null
          instagram_user_id?: string | null
          timezone?: string
          notification_preferences?: Json
          ui_preferences?: Json
          onboarding_completed?: boolean
          terms_accepted_at?: string | null
          privacy_accepted_at?: string | null
          last_active_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          id: string
          user_id: string | null
          email: string
          full_name: string
          role: 'user' | 'admin' | 'super_admin'
          permissions: Json
          is_active: boolean
          last_login_at: string | null
          login_attempts: number
          locked_until: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          email: string
          full_name: string
          role?: 'user' | 'admin' | 'super_admin'
          permissions?: Json
          is_active?: boolean
          last_login_at?: string | null
          login_attempts?: number
          locked_until?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          email?: string
          full_name?: string
          role?: 'user' | 'admin' | 'super_admin'
          permissions?: Json
          is_active?: boolean
          last_login_at?: string | null
          login_attempts?: number
          locked_until?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      instagram_business_accounts: {
        Row: {
          id: string
          user_id: string
          instagram_business_id: string
          name: string
          username: string
          biography: string | null
          website: string | null
          profile_picture_url: string | null
          account_type: 'personal' | 'business' | 'creator'
          followers_count: number
          following_count: number
          media_count: number
          is_connected: boolean
          connection_status: string
          last_synced_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          instagram_business_id: string
          name: string
          username: string
          biography?: string | null
          website?: string | null
          profile_picture_url?: string | null
          account_type?: 'personal' | 'business' | 'creator'
          followers_count?: number
          following_count?: number
          media_count?: number
          is_connected?: boolean
          connection_status?: string
          last_synced_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          instagram_business_id?: string
          name?: string
          username?: string
          biography?: string | null
          website?: string | null
          profile_picture_url?: string | null
          account_type?: 'personal' | 'business' | 'creator'
          followers_count?: number
          following_count?: number
          media_count?: number
          is_connected?: boolean
          connection_status?: string
          last_synced_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      instagram_credentials: {
        Row: {
          id: string
          user_id: string
          business_account_id: string
          access_token_encrypted: string
          refresh_token_encrypted: string | null
          expires_at: string | null
          scope: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          business_account_id: string
          access_token_encrypted: string
          refresh_token_encrypted?: string | null
          expires_at?: string | null
          scope?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          business_account_id?: string
          access_token_encrypted?: string
          refresh_token_encrypted?: string | null
          expires_at?: string | null
          scope?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      automation_workflows: {
        Row: {
          id: string
          user_id: string
          business_account_id: string | null
          name: string
          automation_type: 'engagement_monitor' | 'analytics_pipeline' | 'sales_attribution' | 'ugc_collection' | 'customer_service'
          status: 'active' | 'inactive' | 'error' | 'pending'
          is_active: boolean
          configuration: Json
          n8n_workflow_id: string | null
          webhook_token: string | null
          total_executions: number
          successful_executions: number
          last_executed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          business_account_id?: string | null
          name: string
          automation_type: 'engagement_monitor' | 'analytics_pipeline' | 'sales_attribution' | 'ugc_collection' | 'customer_service'
          status?: 'active' | 'inactive' | 'error' | 'pending'
          is_active?: boolean
          configuration?: Json
          n8n_workflow_id?: string | null
          webhook_token?: string | null
          total_executions?: number
          successful_executions?: number
          last_executed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          business_account_id?: string | null
          name?: string
          automation_type?: 'engagement_monitor' | 'analytics_pipeline' | 'sales_attribution' | 'ugc_collection' | 'customer_service'
          status?: 'active' | 'inactive' | 'error' | 'pending'
          is_active?: boolean
          configuration?: Json
          n8n_workflow_id?: string | null
          webhook_token?: string | null
          total_executions?: number
          successful_executions?: number
          last_executed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      workflow_executions: {
        Row: {
          id: string
          workflow_id: string
          user_id: string
          status: 'success' | 'error' | 'running' | 'cancelled'
          started_at: string
          completed_at: string | null
          execution_time_ms: number | null
          trigger_source: string | null
          error_message: string | null
          execution_data: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          workflow_id: string
          user_id: string
          status?: 'success' | 'error' | 'running' | 'cancelled'
          started_at?: string
          completed_at?: string | null
          execution_time_ms?: number | null
          trigger_source?: string | null
          error_message?: string | null
          execution_data?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          workflow_id?: string
          user_id?: string
          status?: 'success' | 'error' | 'running' | 'cancelled'
          started_at?: string
          completed_at?: string | null
          execution_time_ms?: number | null
          trigger_source?: string | null
          error_message?: string | null
          execution_data?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      instagram_media: {
        Row: {
          id: string
          business_account_id: string
          instagram_media_id: string
          media_type: string
          media_url: string | null
          thumbnail_url: string | null
          caption: string | null
          like_count: number
          comment_count: number
          published_at: string
          processed_by_automation: boolean
          automation_response: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_account_id: string
          instagram_media_id: string
          media_type: string
          media_url?: string | null
          thumbnail_url?: string | null
          caption?: string | null
          like_count?: number
          comment_count?: number
          published_at: string
          processed_by_automation?: boolean
          automation_response?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_account_id?: string
          instagram_media_id?: string
          media_type?: string
          media_url?: string | null
          thumbnail_url?: string | null
          caption?: string | null
          like_count?: number
          comment_count?: number
          published_at?: string
          processed_by_automation?: boolean
          automation_response?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      instagram_comments: {
        Row: {
          id: string
          media_id: string
          business_account_id: string
          instagram_comment_id: string
          from_username: string
          from_id: string
          text: string
          like_count: number
          reply_count: number
          is_hidden: boolean
          processed_by_automation: boolean
          automation_response: string | null
          sentiment_score: number | null
          priority: string
          published_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          media_id: string
          business_account_id: string
          instagram_comment_id: string
          from_username: string
          from_id: string
          text: string
          like_count?: number
          reply_count?: number
          is_hidden?: boolean
          processed_by_automation?: boolean
          automation_response?: string | null
          sentiment_score?: number | null
          priority?: string
          published_at: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          media_id?: string
          business_account_id?: string
          instagram_comment_id?: string
          from_username?: string
          from_id?: string
          text?: string
          like_count?: number
          reply_count?: number
          is_hidden?: boolean
          processed_by_automation?: boolean
          automation_response?: string | null
          sentiment_score?: number | null
          priority?: string
          published_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      daily_analytics: {
        Row: {
          id: string
          business_account_id: string
          user_id: string
          date: string
          followers_count: number
          following_count: number
          media_count: number
          engagement_rate: number | null
          impressions_count: number | null
          reach_count: number | null
          profile_views: number | null
          website_clicks: number | null
          email_contacts: number | null
          phone_calls: number | null
          get_directions: number | null
          text_messages: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_account_id: string
          user_id: string
          date: string
          followers_count: number
          following_count: number
          media_count: number
          engagement_rate?: number | null
          impressions_count?: number | null
          reach_count?: number | null
          profile_views?: number | null
          website_clicks?: number | null
          email_contacts?: number | null
          phone_calls?: number | null
          get_directions?: number | null
          text_messages?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_account_id?: string
          user_id?: string
          date?: string
          followers_count?: number
          following_count?: number
          media_count?: number
          engagement_rate?: number | null
          impressions_count?: number | null
          reach_count?: number | null
          profile_views?: number | null
          website_clicks?: number | null
          email_contacts?: number | null
          phone_calls?: number | null
          get_directions?: number | null
          text_messages?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          id: string
          user_id: string | null
          event_type: string
          action: string
          details: Json | null
          ip_address: string | null
          user_agent: string | null
          success: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          event_type: string
          action: string
          details?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          success?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          event_type?: string
          action?: string
          details?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          success?: boolean
          created_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          user_id: string | null
          title: string
          message: string
          type: string
          data: Json | null
          is_read: boolean
          target_user_ids: string[]
          target_roles: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          title: string
          message: string
          type: string
          data?: Json | null
          is_read?: boolean
          target_user_ids?: string[]
          target_roles?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          title?: string
          message?: string
          type?: string
          data?: Json | null
          is_read?: boolean
          target_user_ids?: string[]
          target_roles?: string[]
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      api_usage: {
        Row: {
          id: string
          user_id: string
          endpoint: string
          method: string
          hour_bucket: string
          request_count: number
          successful_requests: number
          failed_requests: number
          total_response_time_ms: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          endpoint: string
          method: string
          hour_bucket: string
          request_count?: number
          successful_requests?: number
          failed_requests?: number
          total_response_time_ms?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          endpoint?: string
          method?: string
          hour_bucket?: string
          request_count?: number
          successful_requests?: number
          failed_requests?: number
          total_response_time_ms?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      encrypt_instagram_token: {
        Args: {
          p_token: string
        }
        Returns: string
      }
      decrypt_instagram_token: {
        Args: {
          p_encrypted_token: string
        }
        Returns: string
      }
      log_api_usage: {
        Args: {
          p_user_id: string
          p_endpoint?: string
          p_method?: string
          p_response_time_ms?: number
          p_status_code?: number
          p_success?: boolean
        }
        Returns: undefined
      }
    }
    Enums: {
      user_role: 'user' | 'admin' | 'super_admin'
      user_status: 'active' | 'inactive' | 'suspended' | 'pending'
      subscription_plan: 'free' | 'basic' | 'pro' | 'enterprise'
      instagram_account_type: 'personal' | 'business' | 'creator'
      workflow_status: 'active' | 'inactive' | 'error' | 'pending'
      automation_type: 'engagement_monitor' | 'analytics_pipeline' | 'sales_attribution' | 'ugc_collection' | 'customer_service'
    }
  }
}