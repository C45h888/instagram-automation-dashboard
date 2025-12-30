// =====================================
// PERMISSION DEMO TYPES
// TypeScript interfaces for permission demos
// Integrates with existing database types
// =====================================

import type { Database } from '../lib/database.types';

// Re-export database types for convenience
export type InstagramBusinessAccount = Database['public']['Tables']['instagram_business_accounts']['Row'];
export type InstagramComment = Database['public']['Tables']['instagram_comments']['Row'];
export type InstagramMedia = Database['public']['Tables']['instagram_media']['Row'];
export type DMConversation = Database['public']['Tables']['instagram_dm_conversations']['Row'];
export type DMMessage = Database['public']['Tables']['instagram_dm_messages']['Row'];

// Permission-specific types
export type InstagramPermission =
  | 'instagram_basic'
  | 'instagram_manage_comments'
  | 'instagram_content_publish'
  | 'instagram_manage_messages';

export interface PermissionScope {
  permission: InstagramPermission;
  granted: boolean;
  grantedAt?: Date;
  expiresAt?: Date;
  renewalRequired: boolean;
}

export interface InstagramProfileData {
  id: string;
  username: string;
  name: string;
  account_type: 'business' | 'creator' | 'personal';
  profile_picture_url?: string;
  followers_count: number;
  following_count: number;
  media_count: number;
  biography?: string;
  website?: string;
  is_verified?: boolean;
}

export interface CommentData extends Omit<InstagramComment, 'id' | 'created_at' | 'updated_at'> {
  id: string;
  post_title?: string;
  post_thumbnail?: string;
  sentiment_score?: number;
  priority_level: 'low' | 'medium' | 'high' | 'urgent';
  requires_response: boolean;
}

export interface MediaData extends Omit<InstagramMedia, 'id' | 'created_at' | 'updated_at'> {
  id: string;
  engagement_rate: number;
  best_time_posted?: boolean;
  performance_tier: 'low' | 'average' | 'high' | 'viral';
}

export interface ConversationData extends Omit<DMConversation, 'id' | 'created_at' | 'updated_at'> {
  id: string;
  window_remaining_hours: number;
  can_send_messages: boolean;
  requires_template: boolean;
  priority: 'low' | 'normal' | 'high' | 'urgent';
}

export interface DemoDataOptions {
  realistic: boolean;
  volume: 'low' | 'medium' | 'high';
  includeEdgeCases: boolean;
  timeRange: 'today' | 'week' | 'month';
}

export interface ScreencastConfig {
  mode: 'demo' | 'live';
  speed: 'slow' | 'normal' | 'fast';
  highlightActions: boolean;
  showExplanations: boolean;
  pausePoints: string[];
}

export interface MetaPolicyRequirement {
  id: string;
  policySection: string;
  requirement: string;
  demonstrated: boolean;
  evidenceComponent: string;
}

// Demo data generator response types
export interface GeneratedDemoData {
  profiles: InstagramProfileData[];
  comments: CommentData[];
  media: MediaData[];
  conversations: ConversationData[];
  messages: DMMessage[];
}

// API simulation types
export interface InstagramAPISimulation {
  endpoint: string;
  method: 'GET' | 'POST' | 'DELETE';
  permission: InstagramPermission;
  responseTime: number;
  rateLimitRemaining: number;
  mockResponse: any;
}

export interface PermissionDemoStats {
  totalDemos: number;
  completedDemos: number;
  failedDemos: number;
  averageResponseTime: number;
  policiesValidated: number;
}
