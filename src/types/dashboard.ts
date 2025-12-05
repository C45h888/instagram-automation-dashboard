// =====================================
// DASHBOARD TYPES
// TypeScript interfaces for dashboard metrics and analytics
// Integrates with Instagram Graph API responses
// =====================================

// ==========================================
// LITERAL TYPES (for strict type checking)
// ==========================================

export type TrendType = 'up' | 'down' | 'neutral';
export type ActivityStatus = 'success' | 'error' | 'warning' | 'info';
export type ActivityType = 'post_published' | 'auto_reply' | 'error' | 'milestone' | 'schedule';
export type MediaItemType = 'post' | 'story' | 'reel';

// ==========================================
// METRIC INTERFACES
// ==========================================

/**
 * Dashboard metric card data
 * Displays key performance indicators
 */
export interface MetricData {
  title: string;
  value: string;
  change: string;
  trend: TrendType;
  icon: string;
  color: string;
}

// ==========================================
// ACTIVITY FEED INTERFACES
// ==========================================

/**
 * Activity feed item
 * Displays recent platform activities
 */
export interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: string;
  status: ActivityStatus;
}

// ==========================================
// MEDIA INTERFACES
// ==========================================

/**
 * Recent media item for dashboard display
 * Simplified view of Instagram media
 */
export interface MediaItem {
  id: string;
  imageUrl: string;
  likes: number;
  comments: number;
  engagement: string;
  timestamp: string;
  type: MediaItemType;
}

// ==========================================
// CHART DATA INTERFACES
// ==========================================

/**
 * Performance chart data point
 * Used for timeline visualizations
 */
export interface ChartDataPoint {
  date: string;
  followers: number;
  engagement: number;
  posts: number;
}

// ==========================================
// API RESPONSE INTERFACES
// ==========================================

/**
 * Dashboard statistics API response
 * Aggregated data from Meta Graph API
 */
export interface DashboardStatsResponse {
  success: boolean;
  data: {
    metrics: MetricData[];
    activities: ActivityItem[];
    recentMedia: MediaItem[];
    chartData: ChartDataPoint[];
  };
  rate_limit: {
    remaining: number | string;
    limit: number;
    window: string;
  };
  meta?: {
    response_time_ms: number;
    last_updated: string;
  };
  error?: string;
  code?: string;
}

// ==========================================
// DASHBOARD STATE INTERFACE
// ==========================================

/**
 * Complete dashboard data state
 * Used by useDashboardData hook
 */
export interface DashboardData {
  metrics: MetricData[];
  activities: ActivityItem[];
  recentMedia: MediaItem[];
  chartData: ChartDataPoint[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}
