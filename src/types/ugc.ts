// =====================================
// UGC MANAGEMENT TYPES
// TypeScript interfaces for User-Generated Content
// Integrates with database types from Supabase
// =====================================

import type { Database } from '../lib/database.types';

// ==========================================
// DATABASE TYPES (Re-exported from Supabase)
// ==========================================

export type UGCContent = Database['public']['Tables']['ugc_content']['Row'];
export type UGCPermission = Database['public']['Tables']['ugc_permissions']['Row'];
export type UGCCampaign = Database['public']['Tables']['ugc_campaigns']['Row'];

// Insert types (for mutations)
export type UGCContentInsert = Database['public']['Tables']['ugc_content']['Insert'];
export type UGCPermissionInsert = Database['public']['Tables']['ugc_permissions']['Insert'];
export type UGCCampaignInsert = Database['public']['Tables']['ugc_campaigns']['Insert'];

// Update types (for mutations)
export type UGCContentUpdate = Database['public']['Tables']['ugc_content']['Update'];
export type UGCPermissionUpdate = Database['public']['Tables']['ugc_permissions']['Update'];
export type UGCCampaignUpdate = Database['public']['Tables']['ugc_campaigns']['Update'];

// ==========================================
// FRONTEND-SPECIFIC TYPES
// ==========================================

// Frontend convenience type (alias to database type)
export type VisitorPost = UGCContent;

// Sentiment type (literal union for strict type checking)
export type SentimentType = 'positive' | 'neutral' | 'negative' | 'unknown';

// Priority type (literal union for strict type checking)
export type PriorityType = 'low' | 'medium' | 'high' | 'urgent';

// Media type (literal union for strict type checking)
export type MediaType = 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | 'TEXT';

// Permission status type
export type PermissionStatus = 'pending' | 'granted' | 'denied' | 'expired';

// Permission type
export type PermissionTypeValue = 'one_time' | 'perpetual' | 'campaign_specific';

// Request method type
export type RequestedVia = 'dm' | 'comment' | 'email' | 'manual';

// Campaign status type
export type CampaignStatus = 'planning' | 'active' | 'completed' | 'archived';

// ==========================================
// STATS & ANALYTICS INTERFACES
// ==========================================

export interface UGCStats {
  totalPosts: number;
  postsThisWeek: number;
  postsThisMonth: number;
  sentimentBreakdown: {
    positive: number;
    neutral: number;
    negative: number;
  };
  featuredCount: number;
  permissionsPending: number;
  permissionsGranted: number;
  topTags: Array<{ tag: string; count: number }>;
  engagementTotal: {
    likes: number;
    comments: number;
    shares: number;
  };
}

// ==========================================
// FILTER INTERFACES
// ==========================================

export interface UGCFilterState {
  sentiment: 'all' | SentimentType;
  priority: 'all' | PriorityType;
  featured: 'all' | 'featured' | 'not_featured';
  mediaType: 'all' | MediaType;
  search: string;
}

// Default filter state (for initialization)
export const DEFAULT_UGC_FILTERS: UGCFilterState = {
  sentiment: 'all',
  priority: 'all',
  featured: 'all',
  mediaType: 'all',
  search: ''
};

// ==========================================
// FORM INTERFACES
// ==========================================

export interface PermissionRequestForm {
  ugcContentId: string;
  requestMessage: string;
  permissionType: PermissionTypeValue;
  requestedVia: RequestedVia;
}

export interface CampaignForm {
  campaignName: string;
  campaignHashtag: string;
  description?: string;
  startDate: string; // ISO date string
  endDate?: string; // ISO date string
  status: CampaignStatus;
}

// ==========================================
// API RESPONSE INTERFACES
// ==========================================

export interface VisitorPostsResponse {
  success: boolean;
  data: VisitorPost[];
  paging: {
    cursors?: {
      before?: string;
      after?: string;
    };
    next?: string;
    previous?: string;
  };
  stats: UGCStats;
  rate_limit: {
    remaining: number | string;
    limit: number;
    window: string;
  };
  meta?: {
    response_time_ms: number;
  };
  error?: string;
  code?: string;
}

export interface FeatureToggleResponse {
  success: boolean;
  data: VisitorPost;
  rate_limit: {
    remaining: number | string;
    limit: number;
    window: string;
  };
  error?: string;
  code?: string;
}

export interface PermissionRequestResponse {
  success: boolean;
  permission: UGCPermission;
  message: string;
  rate_limit: {
    remaining: number | string;
    limit: number;
    window: string;
  };
  error?: string;
  code?: string;
}

// ==========================================
// UTILITY INTERFACES
// ==========================================

export interface UGCContentWithPermission extends UGCContent {
  permission?: UGCPermission;
}

export interface CampaignWithStats extends UGCCampaign {
  totalPosts: number;
  avgEngagement: number;
  topPerformers: VisitorPost[];
}
