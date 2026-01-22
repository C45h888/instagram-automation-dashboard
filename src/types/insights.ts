// =====================================
// INSTAGRAM INSIGHTS TYPES - v1.1
// TypeScript interfaces for Instagram Insights API data
//
// Matches Meta Graph API v23.0 response structure
// Includes enhanced types for:
// - Exponential backoff retry configuration
// - UTC-normalized daily data
// - Tooltip support for partial data
// =====================================

import type { ReactNode } from 'react';

/**
 * Single insight metric value from Instagram Graph API
 * Example: { value: 1234, end_time: "2024-01-15T00:00:00+0000" }
 */
export interface InsightMetricValue {
  value: number;
  end_time: string;
}

/**
 * Complete insight metric with values array from Instagram Graph API
 * Example: { name: 'impressions', period: 'day', values: [...] }
 */
export interface InsightMetric {
  name: string;
  period: string;
  values: InsightMetricValue[];
  title?: string;
  description?: string;
  id?: string;
}

/**
 * Aggregated insights data for metric cards (totals)
 */
export interface InsightsData {
  impressions: number;
  reach: number;
  profile_views: number;
  website_clicks: number;
}

/**
 * Daily breakdown data for chart visualization
 * UTC-normalized to prevent timezone issues
 */
export interface InsightsDailyData {
  date: string;           // UTC normalized: "2024-01-15"
  dateLabel: string;      // Display: "Mon", "Tue", etc.
  impressions: number;
  reach: number;
  profile_views: number;
  website_clicks: number;
}

/**
 * Metric card data for UI display
 * Includes tooltip for partial data explanations
 */
export interface MetricCardData {
  label: string;
  value: string | number;
  change: number;
  changeLabel: string;
  trend: 'up' | 'down' | 'neutral';
  icon: ReactNode;
  color: string;
  tooltip?: string;       // For partial data explanations
}

/**
 * Single trend calculation result
 */
export interface TrendData {
  change: number;
  trend: 'up' | 'down' | 'neutral';
}

/**
 * Trend calculations for all metrics
 */
export interface TrendsData {
  impressions: TrendData;
  reach: TrendData;
  profile_views: TrendData;
  website_clicks: TrendData;
}

/**
 * Retry configuration for exponential backoff
 * Used for rate limit handling (codes 17, 4, 32, 613)
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

/**
 * Return type for useInstagramInsights hook
 */
export interface UseInsightsResult {
  insights: InsightsData | null;
  metrics: MetricCardData[];
  dailyData: InsightsDailyData[];
  isLoading: boolean;
  error: string | null;
  isRetrying: boolean;    // For rate limit retry state
  retryCount: number;     // Current retry attempt
  refetch: () => void;
}

/**
 * Instagram Graph API response structure
 */
export interface InstagramInsightsApiResponse {
  success: boolean;
  data: InsightMetric[];
  error?: string;
  code?: number;          // Error code from Meta API
}

/**
 * Chart data structure for performance visualization
 */
export interface ChartDataset {
  label: string;
  data: number[];
  color: string;
  borderColor: string;
  backgroundColor: string;
}

export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}
