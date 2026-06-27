// =====================================
// PERMISSION DEMO TYPES
// TypeScript interfaces for permission demos
// Integrates with existing database types
// =====================================

import type { Database } from '../../substrates/supabase/database.types';

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
  followers_count?: number | null;
  following_count?: number | null;
  media_count?: number | null;
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

/**
 * MediaData — Instagram media with computed analytics fields.
 *
 * NOTE: `engagement_rate`, `best_time_posted`, and `performance_tier` are
 * COMPUTED values derived by the frontend analytics layer — they do NOT exist
 * as columns in the `instagram_media` DB table. They are added here for
 * convenience when the API returns enriched media data.
 *
 * DB columns (instagram_media table):
 *   id, business_account_id, instagram_media_id, caption, media_type, media_url,
 *   thumbnail_url, permalink, hashtags, mentions, like_count, comments_count,
 *   reach, impressions, saves, shares_count, scheduled_for, published_at,
 *   status, created_at, updated_at, last_updated_at
 *
 * Computed fields added here:
 *   engagement_rate, best_time_posted, performance_tier
 */
export interface MediaData extends Omit<InstagramMedia, 'id' | 'created_at' | 'updated_at'> {
  /** Internal UUID primary key (same as InstagramMedia.id) */
  id: string;
  /** Computed: (like_count + comments_count) / reach * 100 — NOT a DB column */
  engagement_rate: number;
  /** Computed: whether this is an optimal posting time — NOT a DB column */
  best_time_posted?: boolean;
  /** Computed: tier classification based on engagement — NOT a DB column */
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
