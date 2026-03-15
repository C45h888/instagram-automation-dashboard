// =====================================
// USE INSTAGRAM INSIGHTS HOOK - PRODUCTION v1.1
// Fetches REAL Instagram Insights data from Meta Graph API v23.0
// NO MOCK DATA, NO FALLBACKS
//
// ✅ OPTIMIZATIONS:
// - useMemo for dailyData parsing (reduces recomputes)
// - enabled guard prevents unnecessary fetches
// - Exponential backoff for rate limits (codes 17, 4, 32, 613)
// - UTC date normalization
// - Safe getters for partial data with tooltips
//
// ✅ PATTERN: Mirrors useInstagramProfile.ts structure
// ✅ UPDATED: Uses useInstagramAccount hook for IDs
// ✅ UPDATED: Passes userId + businessAccountId as query params
// =====================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useInstagramAccount } from './useInstagramAccount';
import { Users, User, MousePointer } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type {
  InsightsData,
  InsightsDailyData,
  MetricCardData,
  InsightMetric,
  InsightMetricTotal,
  UseInsightsResult,
  RetryConfig,
  TrendsData,
  TrendData
} from '../types/insights';

// =====================================
// CONSTANTS
// =====================================

// Default retry config for rate limits
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000
};

// Rate limit error codes from Meta API
const RATE_LIMIT_CODES = [17, 4, 32, 613];

// =====================================
// HELPER FUNCTIONS
// =====================================

/**
 * Get authentication headers with JWT Bearer token from Supabase session
 */
async function getAgentAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
  };
}

/**
 * Fetch with exponential backoff for rate limits
 */
const fetchWithRetry = async (
  url: string,
  config: RetryConfig,
  headers: Record<string, string>,
  attempt: number = 0,
  onRetry?: (attempt: number) => void
): Promise<any> => {
  try {
    const response = await fetch(url, { headers });

    const result = await response.json();

    // Check for rate limit errors
    if (!response.ok || !result.success) {
      const errorCode = result.code || response.status;

      if (RATE_LIMIT_CODES.includes(errorCode) && attempt < config.maxRetries) {
        const delay = Math.min(
          config.baseDelayMs * Math.pow(2, attempt),
          config.maxDelayMs
        );
        console.log(`⏳ Rate limit hit—retrying in ${delay}ms (attempt ${attempt + 1}/${config.maxRetries})`);

        if (onRetry) onRetry(attempt + 1);

        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchWithRetry(url, config, headers, attempt + 1, onRetry);
      }

      // Check for specific error codes
      if (errorCode === 190) {
        throw new Error('Instagram token expired. Please reconnect your account.');
      }
      if (errorCode === 100) {
        throw new Error('Missing insights permission. Reconnect with required permissions.');
      }

      throw new Error(result.error || `API Error: ${response.status}`);
    }

    return result;
  } catch (err: any) {
    // Network errors - retry if attempts remaining
    if (attempt < config.maxRetries && err.name === 'TypeError') {
      const delay = config.baseDelayMs * Math.pow(2, attempt);
      console.log(`🔄 Network error—retrying in ${delay}ms (attempt ${attempt + 1}/${config.maxRetries})`);

      if (onRetry) onRetry(attempt + 1);

      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, config, headers, attempt + 1, onRetry);
    }
    throw err;
  }
};

/**
 * Safe getter for metric values - returns 0 for missing metrics
 */
const safeGetMetricValue = (
  data: InsightMetric[],
  name: string,
  index: number
): number => {
  const metric = data.find(m => m.name === name);
  return metric?.values?.[index]?.value ?? 0;
};

/**
 * Aggregate v1 time-series and v2 total_value data into a single InsightsData object.
 * v1 (timeSeries): reach — daily values[] array, summed over the period
 * v2 (totals): accounts_engaged, profile_views, website_clicks — total_value.value
 */
const aggregateInsights = (
  timeSeries: InsightMetric[],
  totals: InsightMetricTotal[]
): InsightsData => {
  const getTotal = (name: string): number =>
    totals.find(m => m.name === name)?.total_value?.value ?? 0;

  const sumTimeSeries = (name: string): number => {
    const metric = timeSeries.find(m => m.name === name);
    if (!metric?.values) return 0;
    return metric.values.reduce((sum, v) => sum + (v.value ?? 0), 0);
  };

  return {
    accounts_engaged: getTotal('accounts_engaged'),
    reach: sumTimeSeries('reach'),
    profile_views: getTotal('profile_views'),
    website_clicks: getTotal('website_clicks')
  };
};

/**
 * Parse daily reach data with UTC normalization.
 * Only reach has daily time-series data from Meta — other metrics are period totals only.
 */
const parseDailyDataWithUTC = (timeSeries: InsightMetric[]): InsightsDailyData[] => {
  // reach is the only v1 time-series metric — use it as the date anchor
  const reachMetric = timeSeries.find(m => m.name === 'reach');
  if (!reachMetric?.values?.length) return [];

  return reachMetric.values.map((v, index) => {
    // ✅ UTC NORMALIZATION: Consistent parsing across timezones
    const utcDate = new Date(v.end_time);
    return {
      date: utcDate.toISOString().split('T')[0],
      dateLabel: utcDate.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
      reach: safeGetMetricValue(timeSeries, 'reach', index)
    };
  });
};

/**
 * Calculate trends comparing current vs previous period
 */
const calculateTrends = (current: InsightsData, previous: InsightsData | null): TrendsData => {
  const calcTrend = (curr: number, prev: number | null): TrendData => {
    if (prev === null || prev === 0) {
      return { change: 0, trend: 'neutral' };
    }
    const change = ((curr - prev) / prev) * 100;
    return {
      change: Math.round(change * 10) / 10,
      trend: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral'
    };
  };

  return {
    accounts_engaged: calcTrend(current.accounts_engaged, previous?.accounts_engaged ?? null),
    reach: calcTrend(current.reach, previous?.reach ?? null),
    profile_views: calcTrend(current.profile_views, previous?.profile_views ?? null),
    website_clicks: calcTrend(current.website_clicks, previous?.website_clicks ?? null)
  };
};

/**
 * Format number for display (1.5K, 2.3M, etc.)
 */
const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

/**
 * Format metrics with icons, colors, and tooltips
 */
const formatMetricsWithTooltips = (
  insights: InsightsData,
  trends: TrendsData
): MetricCardData[] => {
  const createTooltip = (value: number, name: string): string | undefined => {
    if (value === 0) return `No ${name} data available for this period`;
    return undefined;
  };

  return [
    {
      label: 'Accounts Engaged',
      value: formatNumber(insights.accounts_engaged),
      change: trends.accounts_engaged.change,
      changeLabel: 'vs previous 7 days',
      trend: trends.accounts_engaged.trend,
      icon: <Users className="w-5 h-5" />,
      color: 'from-blue-500 to-cyan-500',
      tooltip: createTooltip(insights.accounts_engaged, 'engagement data')
    },
    {
      label: 'Reach',
      value: formatNumber(insights.reach),
      change: trends.reach.change,
      changeLabel: 'vs previous 7 days',
      trend: trends.reach.trend,
      icon: <Users className="w-5 h-5" />,
      color: 'from-purple-500 to-indigo-500',
      tooltip: createTooltip(insights.reach, 'reach')
    },
    {
      label: 'Profile Views',
      value: formatNumber(insights.profile_views),
      change: trends.profile_views.change,
      changeLabel: 'vs previous 7 days',
      trend: trends.profile_views.trend,
      icon: <User className="w-5 h-5" />,
      color: 'from-pink-500 to-rose-500',
      tooltip: createTooltip(insights.profile_views, 'profile views')
    },
    {
      label: 'Website Clicks',
      value: formatNumber(insights.website_clicks),
      change: trends.website_clicks.change,
      changeLabel: 'vs previous 7 days',
      trend: trends.website_clicks.trend,
      icon: <MousePointer className="w-5 h-5" />,
      color: 'from-green-500 to-emerald-500',
      tooltip: createTooltip(insights.website_clicks, 'website clicks')
    }
  ];
};

// =====================================
// MAIN HOOK
// =====================================

export const useInstagramInsights = (period: string = '7d'): UseInsightsResult => {
  // ✅ Get user from auth store
  const { user } = useAuthStore();

  // ✅ Get Instagram account IDs from useInstagramAccount hook
  const { businessAccountId, instagramBusinessId } = useInstagramAccount();

  // =====================================
  // STATE
  // =====================================
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [rawData, setRawData] = useState<InsightMetric[]>([]);
  const [trends, setTrends] = useState<TrendsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // =====================================
  // MEMOIZED DERIVED DATA
  // =====================================

  // ✅ OPTIMIZATION: useMemo for dailyData parsing
  const dailyData = useMemo(() => {
    if (!rawData.length) return [];
    return parseDailyDataWithUTC(rawData);
  }, [rawData]);

  // ✅ OPTIMIZATION: useMemo for formatted metrics
  const metrics = useMemo(() => {
    if (!insights || !trends) return [];
    return formatMetricsWithTooltips(insights, trends);
  }, [insights, trends]);

  // =====================================
  // FETCH FUNCTION
  // =====================================

  const fetchInsights = useCallback(async () => {
    // ✅ GUARD: Prevent fetch without required IDs
    if (!user?.id || !businessAccountId || !instagramBusinessId) {
      setError('No Instagram Business Account connected.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setRetryCount(0);

    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://api.888intelligenceautomation.in';

      // ✅ Get auth headers with JWT Bearer token
      const headers = await getAgentAuthHeaders();

      // Retry callback to update UI state
      const onRetry = (attempt: number) => {
        setIsRetrying(true);
        setRetryCount(attempt);
      };

      // ✅ Fetch current period (last 7 days)
      // Route: /account-insights?business_account_id=UUID — agent endpoint, calls Meta directly
      console.log('📊 Fetching current period insights...');
      const currentResponse = await fetchWithRetry(
        `${apiBaseUrl}/api/instagram/account-insights?business_account_id=${businessAccountId}`,
        DEFAULT_RETRY_CONFIG,
        headers,
        0,
        onRetry
      );

      // ✅ Fetch previous period (days 8-14) for trend comparison
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const untilTimestamp = Math.floor(sevenDaysAgo.getTime() / 1000);

      console.log('📊 Fetching previous period insights for trend comparison...');
      let previousResponse = null;
      try {
        previousResponse = await fetchWithRetry(
          `${apiBaseUrl}/api/instagram/account-insights?business_account_id=${businessAccountId}&until=${untilTimestamp}`,
          DEFAULT_RETRY_CONFIG,
          headers,
          0,
          onRetry
        );
      } catch (prevErr) {
        // Previous period may not exist for new accounts - that's OK
        console.log('ℹ️ Previous period data unavailable (new account or insufficient history)');
      }

      // ✅ Process responses — data is { time_series: InsightMetric[], totals: InsightMetricTotal[] }
      const currentData = currentResponse?.data;
      const previousData = previousResponse?.data;

      const currentTimeSeries = currentData?.time_series || [];
      const currentTotalValues = currentData?.totals || [];

      setRawData(currentTimeSeries);

      const currentTotals = aggregateInsights(currentTimeSeries, currentTotalValues);
      const previousTotals = previousData
        ? aggregateInsights(previousData.time_series || [], previousData.totals || [])
        : null;

      setInsights(currentTotals);
      setTrends(calculateTrends(currentTotals, previousTotals));

      console.log('✅ Insights fetched successfully:', currentTotals);

    } catch (err: any) {
      console.error('❌ Insights fetch failed:', err);
      setError(err.message || 'Failed to fetch insights');
    } finally {
      setIsLoading(false);
      setIsRetrying(false);
    }
  }, [user?.id, businessAccountId, instagramBusinessId, period]);

  // =====================================
  // EFFECT: Fetch on mount and dependency changes
  // =====================================

  useEffect(() => {
    // ✅ GUARD: Only fetch when IDs are available
    if (businessAccountId && instagramBusinessId) {
      fetchInsights();
    }
  }, [fetchInsights, businessAccountId, instagramBusinessId]);

  // =====================================
  // RETURN
  // =====================================

  return {
    insights,
    metrics,
    dailyData,
    isLoading,
    error,
    isRetrying,
    retryCount,
    refetch: fetchInsights
  };
};

export default useInstagramInsights;
