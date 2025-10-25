export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string | null
          created_by: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          last_login_at: string | null
          locked_until: string | null
          login_attempts: number | null
          permissions: Json | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          email: string
          full_name: string
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          locked_until?: string | null
          login_attempts?: number | null
          permissions?: Json | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          locked_until?: string | null
          login_attempts?: number | null
          permissions?: Json | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      api_usage: {
        Row: {
          business_account_id: string | null
          created_at: string | null
          credits_consumed: number | null
          endpoint: string
          error_message: string | null
          hour_bucket: string
          id: string
          method: string
          request_count: number | null
          response_time_ms: number | null
          status_code: number | null
          success: boolean | null
          user_id: string
        }
        Insert: {
          business_account_id?: string | null
          created_at?: string | null
          credits_consumed?: number | null
          endpoint: string
          error_message?: string | null
          hour_bucket: string
          id?: string
          method: string
          request_count?: number | null
          response_time_ms?: number | null
          status_code?: number | null
          success?: boolean | null
          user_id: string
        }
        Update: {
          business_account_id?: string | null
          created_at?: string | null
          credits_consumed?: number | null
          endpoint?: string
          error_message?: string | null
          hour_bucket?: string
          id?: string
          method?: string
          request_count?: number | null
          response_time_ms?: number | null
          status_code?: number | null
          success?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_business_account_id_fkey"
            columns: ["business_account_id"]
            isOneToOne: false
            referencedRelation: "instagram_business_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          error_message: string | null
          event_type: string
          id: string
          ip_address: unknown | null
          resource_id: string | null
          resource_type: string | null
          success: boolean | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          error_message?: string | null
          event_type: string
          id?: string
          ip_address?: unknown | null
          resource_id?: string | null
          resource_type?: string | null
          success?: boolean | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          error_message?: string | null
          event_type?: string
          id?: string
          ip_address?: unknown | null
          resource_id?: string | null
          resource_type?: string | null
          success?: boolean | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      automation_workflows: {
        Row: {
          automation_type: Database["public"]["Enums"]["automation_type"]
          average_execution_time: number | null
          business_account_id: string | null
          configuration: Json | null
          created_at: string | null
          description: string | null
          failed_executions: number | null
          id: string
          is_active: boolean | null
          last_error_at: string | null
          last_error_message: string | null
          last_execution_at: string | null
          last_success_at: string | null
          monthly_api_calls: number | null
          n8n_webhook_url: string | null
          n8n_workflow_id: string | null
          name: string
          next_run_at: string | null
          schedule_cron: string | null
          schedule_enabled: boolean | null
          status: Database["public"]["Enums"]["workflow_status"] | null
          successful_executions: number | null
          total_api_calls: number | null
          total_executions: number | null
          trigger_conditions: Json | null
          updated_at: string | null
          user_id: string
          webhook_token: string | null
        }
        Insert: {
          automation_type: Database["public"]["Enums"]["automation_type"]
          average_execution_time?: number | null
          business_account_id?: string | null
          configuration?: Json | null
          created_at?: string | null
          description?: string | null
          failed_executions?: number | null
          id?: string
          is_active?: boolean | null
          last_error_at?: string | null
          last_error_message?: string | null
          last_execution_at?: string | null
          last_success_at?: string | null
          monthly_api_calls?: number | null
          n8n_webhook_url?: string | null
          n8n_workflow_id?: string | null
          name: string
          next_run_at?: string | null
          schedule_cron?: string | null
          schedule_enabled?: boolean | null
          status?: Database["public"]["Enums"]["workflow_status"] | null
          successful_executions?: number | null
          total_api_calls?: number | null
          total_executions?: number | null
          trigger_conditions?: Json | null
          updated_at?: string | null
          user_id: string
          webhook_token?: string | null
        }
        Update: {
          automation_type?: Database["public"]["Enums"]["automation_type"]
          average_execution_time?: number | null
          business_account_id?: string | null
          configuration?: Json | null
          created_at?: string | null
          description?: string | null
          failed_executions?: number | null
          id?: string
          is_active?: boolean | null
          last_error_at?: string | null
          last_error_message?: string | null
          last_execution_at?: string | null
          last_success_at?: string | null
          monthly_api_calls?: number | null
          n8n_webhook_url?: string | null
          n8n_workflow_id?: string | null
          name?: string
          next_run_at?: string | null
          schedule_cron?: string | null
          schedule_enabled?: boolean | null
          status?: Database["public"]["Enums"]["workflow_status"] | null
          successful_executions?: number | null
          total_api_calls?: number | null
          total_executions?: number | null
          trigger_conditions?: Json | null
          updated_at?: string | null
          user_id?: string
          webhook_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_workflows_business_account_id_fkey"
            columns: ["business_account_id"]
            isOneToOne: false
            referencedRelation: "instagram_business_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_analytics: {
        Row: {
          automated_responses_sent: number | null
          automation_execution_count: number | null
          business_account_id: string
          created_at: string | null
          date: string
          engagement_rate: number | null
          followers_count: number | null
          following_count: number | null
          id: string
          media_count: number | null
          response_rate: number | null
          total_comments: number | null
          total_impressions: number | null
          total_likes: number | null
          total_reach: number | null
          total_shares: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          automated_responses_sent?: number | null
          automation_execution_count?: number | null
          business_account_id: string
          created_at?: string | null
          date: string
          engagement_rate?: number | null
          followers_count?: number | null
          following_count?: number | null
          id?: string
          media_count?: number | null
          response_rate?: number | null
          total_comments?: number | null
          total_impressions?: number | null
          total_likes?: number | null
          total_reach?: number | null
          total_shares?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          automated_responses_sent?: number | null
          automation_execution_count?: number | null
          business_account_id?: string
          created_at?: string | null
          date?: string
          engagement_rate?: number | null
          followers_count?: number | null
          following_count?: number | null
          id?: string
          media_count?: number | null
          response_rate?: number | null
          total_comments?: number | null
          total_impressions?: number | null
          total_likes?: number | null
          total_reach?: number | null
          total_shares?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_analytics_business_account_id_fkey"
            columns: ["business_account_id"]
            isOneToOne: false
            referencedRelation: "instagram_business_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      data_deletion_requests: {
        Row: {
          completed_at: string | null
          confirmation_code: string
          error_message: string | null
          id: string
          meta_user_id: string
          payload: Json | null
          requested_at: string
          status: string
          status_url: string | null
        }
        Insert: {
          completed_at?: string | null
          confirmation_code: string
          error_message?: string | null
          id?: string
          meta_user_id: string
          payload?: Json | null
          requested_at?: string
          status?: string
          status_url?: string | null
        }
        Update: {
          completed_at?: string | null
          confirmation_code?: string
          error_message?: string | null
          id?: string
          meta_user_id?: string
          payload?: Json | null
          requested_at?: string
          status?: string
          status_url?: string | null
        }
        Relationships: []
      }
      instagram_business_accounts: {
        Row: {
          account_type:
            | Database["public"]["Enums"]["instagram_account_type"]
            | null
          address: Json | null
          biography: string | null
          category: string | null
          connection_status: string | null
          contact_email: string | null
          created_at: string | null
          followers_count: number | null
          following_count: number | null
          granted_permissions: Json | null
          id: string
          instagram_business_id: string
          instagram_user_id: string | null
          is_connected: boolean | null
          last_sync_at: string | null
          media_count: number | null
          name: string
          phone_number: string | null
          profile_picture_url: string | null
          required_permissions: Json | null
          updated_at: string | null
          user_id: string
          username: string
          website: string | null
        }
        Insert: {
          account_type?:
            | Database["public"]["Enums"]["instagram_account_type"]
            | null
          address?: Json | null
          biography?: string | null
          category?: string | null
          connection_status?: string | null
          contact_email?: string | null
          created_at?: string | null
          followers_count?: number | null
          following_count?: number | null
          granted_permissions?: Json | null
          id?: string
          instagram_business_id: string
          instagram_user_id?: string | null
          is_connected?: boolean | null
          last_sync_at?: string | null
          media_count?: number | null
          name: string
          phone_number?: string | null
          profile_picture_url?: string | null
          required_permissions?: Json | null
          updated_at?: string | null
          user_id: string
          username: string
          website?: string | null
        }
        Update: {
          account_type?:
            | Database["public"]["Enums"]["instagram_account_type"]
            | null
          address?: Json | null
          biography?: string | null
          category?: string | null
          connection_status?: string | null
          contact_email?: string | null
          created_at?: string | null
          followers_count?: number | null
          following_count?: number | null
          granted_permissions?: Json | null
          id?: string
          instagram_business_id?: string
          instagram_user_id?: string | null
          is_connected?: boolean | null
          last_sync_at?: string | null
          media_count?: number | null
          name?: string
          phone_number?: string | null
          profile_picture_url?: string | null
          required_permissions?: Json | null
          updated_at?: string | null
          user_id?: string
          username?: string
          website?: string | null
        }
        Relationships: []
      }
      instagram_comments: {
        Row: {
          author_instagram_id: string | null
          author_name: string | null
          author_username: string | null
          automated_response_sent: boolean | null
          business_account_id: string
          category: string | null
          created_at: string | null
          id: string
          instagram_comment_id: string
          like_count: number | null
          media_id: string | null
          parent_comment_id: string | null
          priority: string | null
          processed_by_automation: boolean | null
          published_at: string | null
          reply_count: number | null
          response_sent_at: string | null
          response_text: string | null
          sentiment: string | null
          text: string
          updated_at: string | null
        }
        Insert: {
          author_instagram_id?: string | null
          author_name?: string | null
          author_username?: string | null
          automated_response_sent?: boolean | null
          business_account_id: string
          category?: string | null
          created_at?: string | null
          id?: string
          instagram_comment_id: string
          like_count?: number | null
          media_id?: string | null
          parent_comment_id?: string | null
          priority?: string | null
          processed_by_automation?: boolean | null
          published_at?: string | null
          reply_count?: number | null
          response_sent_at?: string | null
          response_text?: string | null
          sentiment?: string | null
          text: string
          updated_at?: string | null
        }
        Update: {
          author_instagram_id?: string | null
          author_name?: string | null
          author_username?: string | null
          automated_response_sent?: boolean | null
          business_account_id?: string
          category?: string | null
          created_at?: string | null
          id?: string
          instagram_comment_id?: string
          like_count?: number | null
          media_id?: string | null
          parent_comment_id?: string | null
          priority?: string | null
          processed_by_automation?: boolean | null
          published_at?: string | null
          reply_count?: number | null
          response_sent_at?: string | null
          response_text?: string | null
          sentiment?: string | null
          text?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instagram_comments_business_account_id_fkey"
            columns: ["business_account_id"]
            isOneToOne: false
            referencedRelation: "instagram_business_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_comments_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "instagram_media"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_credentials: {
        Row: {
          access_token_encrypted: string
          business_account_id: string | null
          created_at: string | null
          encryption_key_id: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          issued_at: string | null
          last_refreshed_at: string | null
          refresh_token_encrypted: string | null
          revoked_at: string | null
          revoked_reason: string | null
          scope: string[] | null
          token_hash: string | null
          token_type: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token_encrypted: string
          business_account_id?: string | null
          created_at?: string | null
          encryption_key_id?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          issued_at?: string | null
          last_refreshed_at?: string | null
          refresh_token_encrypted?: string | null
          revoked_at?: string | null
          revoked_reason?: string | null
          scope?: string[] | null
          token_hash?: string | null
          token_type?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token_encrypted?: string
          business_account_id?: string | null
          created_at?: string | null
          encryption_key_id?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          issued_at?: string | null
          last_refreshed_at?: string | null
          refresh_token_encrypted?: string | null
          revoked_at?: string | null
          revoked_reason?: string | null
          scope?: string[] | null
          token_hash?: string | null
          token_type?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_credentials_business_account_id_fkey"
            columns: ["business_account_id"]
            isOneToOne: false
            referencedRelation: "instagram_business_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_media: {
        Row: {
          business_account_id: string
          caption: string | null
          comments_count: number | null
          created_at: string | null
          hashtags: string[] | null
          id: string
          impressions: number | null
          instagram_media_id: string
          last_updated_at: string | null
          like_count: number | null
          media_type: string | null
          media_url: string | null
          mentions: string[] | null
          permalink: string | null
          published_at: string | null
          reach: number | null
          shares_count: number | null
          thumbnail_url: string | null
          updated_at: string | null
        }
        Insert: {
          business_account_id: string
          caption?: string | null
          comments_count?: number | null
          created_at?: string | null
          hashtags?: string[] | null
          id?: string
          impressions?: number | null
          instagram_media_id: string
          last_updated_at?: string | null
          like_count?: number | null
          media_type?: string | null
          media_url?: string | null
          mentions?: string[] | null
          permalink?: string | null
          published_at?: string | null
          reach?: number | null
          shares_count?: number | null
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Update: {
          business_account_id?: string
          caption?: string | null
          comments_count?: number | null
          created_at?: string | null
          hashtags?: string[] | null
          id?: string
          impressions?: number | null
          instagram_media_id?: string
          last_updated_at?: string | null
          like_count?: number | null
          media_type?: string | null
          media_url?: string | null
          mentions?: string[] | null
          permalink?: string | null
          published_at?: string | null
          reach?: number | null
          shares_count?: number | null
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instagram_media_business_account_id_fkey"
            columns: ["business_account_id"]
            isOneToOne: false
            referencedRelation: "instagram_business_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_label: string | null
          action_url: string | null
          created_at: string | null
          delivered_at: string | null
          delivery_method: string[] | null
          expires_at: string | null
          id: string
          is_read: boolean | null
          message: string
          read_at: string | null
          target_roles: Database["public"]["Enums"]["user_role"][] | null
          target_user_ids: string[] | null
          title: string
          type: string | null
          user_id: string | null
        }
        Insert: {
          action_label?: string | null
          action_url?: string | null
          created_at?: string | null
          delivered_at?: string | null
          delivery_method?: string[] | null
          expires_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          read_at?: string | null
          target_roles?: Database["public"]["Enums"]["user_role"][] | null
          target_user_ids?: string[] | null
          title: string
          type?: string | null
          user_id?: string | null
        }
        Update: {
          action_label?: string | null
          action_url?: string | null
          created_at?: string | null
          delivered_at?: string | null
          delivery_method?: string[] | null
          expires_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          read_at?: string | null
          target_roles?: Database["public"]["Enums"]["user_role"][] | null
          target_user_ids?: string[] | null
          title?: string
          type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_consents: {
        Row: {
          consent_given: boolean
          consent_type: string
          consented_at: string
          id: string
          ip_address: unknown | null
          privacy_policy_version: string | null
          terms_version: string | null
          user_agent: string | null
        }
        Insert: {
          consent_given: boolean
          consent_type: string
          consented_at?: string
          id?: string
          ip_address?: unknown | null
          privacy_policy_version?: string | null
          terms_version?: string | null
          user_agent?: string | null
        }
        Update: {
          consent_given?: boolean
          consent_type?: string
          consented_at?: string
          id?: string
          ip_address?: unknown | null
          privacy_policy_version?: string | null
          terms_version?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          business_name: string | null
          business_website: string | null
          company_size: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          industry: string | null
          instagram_connected: boolean | null
          instagram_user_id: string | null
          instagram_username: string | null
          last_active_at: string | null
          notification_preferences: Json | null
          onboarding_completed: boolean | null
          privacy_accepted_at: string | null
          status: Database["public"]["Enums"]["user_status"]
          subscription_plan: Database["public"]["Enums"]["subscription_plan"]
          terms_accepted_at: string | null
          timezone: string | null
          ui_preferences: Json | null
          updated_at: string | null
          user_id: string
          user_role: Database["public"]["Enums"]["user_role"]
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          business_name?: string | null
          business_website?: string | null
          company_size?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          industry?: string | null
          instagram_connected?: boolean | null
          instagram_user_id?: string | null
          instagram_username?: string | null
          last_active_at?: string | null
          notification_preferences?: Json | null
          onboarding_completed?: boolean | null
          privacy_accepted_at?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          subscription_plan?: Database["public"]["Enums"]["subscription_plan"]
          terms_accepted_at?: string | null
          timezone?: string | null
          ui_preferences?: Json | null
          updated_at?: string | null
          user_id: string
          user_role?: Database["public"]["Enums"]["user_role"]
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          business_name?: string | null
          business_website?: string | null
          company_size?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          industry?: string | null
          instagram_connected?: boolean | null
          instagram_user_id?: string | null
          instagram_username?: string | null
          last_active_at?: string | null
          notification_preferences?: Json | null
          onboarding_completed?: boolean | null
          privacy_accepted_at?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          subscription_plan?: Database["public"]["Enums"]["subscription_plan"]
          terms_accepted_at?: string | null
          timezone?: string | null
          ui_preferences?: Json | null
          updated_at?: string | null
          user_id?: string
          user_role?: Database["public"]["Enums"]["user_role"]
          username?: string | null
        }
        Relationships: []
      }
      workflow_executions: {
        Row: {
          api_calls_count: number | null
          completed_at: string | null
          created_at: string | null
          credits_consumed: number | null
          error_data: Json | null
          execution_id: string | null
          execution_time_ms: number | null
          id: string
          input_data: Json | null
          output_data: Json | null
          started_at: string | null
          status: string
          trigger_source: string | null
          user_id: string
          workflow_id: string
        }
        Insert: {
          api_calls_count?: number | null
          completed_at?: string | null
          created_at?: string | null
          credits_consumed?: number | null
          error_data?: Json | null
          execution_id?: string | null
          execution_time_ms?: number | null
          id?: string
          input_data?: Json | null
          output_data?: Json | null
          started_at?: string | null
          status: string
          trigger_source?: string | null
          user_id: string
          workflow_id: string
        }
        Update: {
          api_calls_count?: number | null
          completed_at?: string | null
          created_at?: string | null
          credits_consumed?: number | null
          error_data?: Json | null
          execution_id?: string | null
          execution_time_ms?: number | null
          id?: string
          input_data?: Json | null
          output_data?: Json | null
          started_at?: string | null
          status?: string
          trigger_source?: string | null
          user_id?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_executions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "automation_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      decrypt_instagram_token: {
        Args: { encrypted_token: string }
        Returns: string
      }
      encrypt_instagram_token: {
        Args: { token: string }
        Returns: string
      }
    }
    Enums: {
      automation_type:
        | "engagement_monitor"
        | "analytics_pipeline"
        | "sales_attribution"
        | "ugc_collection"
        | "customer_service"
      instagram_account_type: "personal" | "business" | "creator"
      subscription_plan: "free" | "basic" | "pro" | "enterprise"
      user_role: "user" | "admin" | "super_admin"
      user_status: "active" | "inactive" | "suspended" | "pending"
      workflow_status: "active" | "inactive" | "error" | "pending"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      automation_type: [
        "engagement_monitor",
        "analytics_pipeline",
        "sales_attribution",
        "ugc_collection",
        "customer_service",
      ],
      instagram_account_type: ["personal", "business", "creator"],
      subscription_plan: ["free", "basic", "pro", "enterprise"],
      user_role: ["user", "admin", "super_admin"],
      user_status: ["active", "inactive", "suspended", "pending"],
      workflow_status: ["active", "inactive", "error", "pending"],
    },
  },
} as const
