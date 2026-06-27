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
 * v1 time-series metric from Instagram Graph API (period=day, no metric_type)
 * Example: { name: 'reach', period: 'day', values: [{value: 123, end_time: '...'}] }
 * Used for: reach (daily chart data)
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
 * v2 total_value metric from Instagram Graph API (metric_type=total_value)
 * Example: { name: 'accounts_engaged', period: 'day', total_value: { value: 847 } }
 * Used for: accounts_engaged, profile_views, website_clicks
 */
export interface InsightMetricTotal {
  name: string;
  period: string;
  title?: string;
  id?: string;
  total_value: { value: number };
}

/**
 * Aggregated insights data for metric cards (totals for the period)
 */
export interface InsightsData {
  accounts_engaged: number;  // v2 total — was: impressions (removed from Meta account-level API)
  reach: number;             // v1 sum over period
  profile_views: number;     // v2 total
  website_clicks: number;    // v2 total (0 if account has no website URL)
}

/**
 * Daily breakdown data for chart visualization — reach only.
 * UTC-normalized to prevent timezone issues.
 * Note: only reach has daily data from Meta; other metrics are period totals only.
 */
export interface InsightsDailyData {
  date: string;       // UTC normalized: "2024-01-15"
  dateLabel: string;  // Display: "Mon", "Tue", etc.
  reach: number;      // daily value — the only account-level metric Meta returns as time-series
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
  accounts_engaged: TrendData;  // was: impressions
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
 * Instagram Graph API response structure — structured with v1 and v2 data separate.
 * time_series: v1 metrics (reach) with daily values[] arrays
 * totals: v2 metrics (accounts_engaged, profile_views, website_clicks) with total_value
 */
export interface InstagramInsightsApiResponse {
  success: boolean;
  data: {
    time_series: InsightMetric[];    // v1: [{name, values:[{value,end_time}]}]
    totals: InsightMetricTotal[];    // v2: [{name, total_value:{value:N}}]
  };
  error?: string;
  code?: number;
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
