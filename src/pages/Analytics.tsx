// =====================================
// ANALYTICS PAGE - PRODUCTION v1.1
// Real Instagram Insights data from Meta Graph API v23.0
// NO MOCK DATA
//
// ✅ Uses useInstagramInsights hook for real data
// ✅ Shows 4 metrics: Impressions, Reach, Profile Views, Website Clicks
// ✅ 7-day performance chart with all 4 metrics
// ✅ Loading, error, and retry states
// ✅ Edge case handling (no account, no data, partial data)
// =====================================

import React from 'react';
import {
  Download, ChevronUp, ChevronDown, MoreVertical,
  RefreshCw, AlertCircle, Link2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useInstagramAccount } from '../hooks/useInstagramAccount';
import { useInstagramInsights } from '../hooks/useInstagramInsights';
import type { InsightsDailyData, MetricCardData, ChartData } from '../types/insights';

// =====================================
// CHART COMPONENT
// =====================================

interface SimpleLineChartProps {
  data: ChartData;
  isLoading?: boolean;
}

const SimpleLineChart: React.FC<SimpleLineChartProps> = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <div className="h-[300px] bg-white/5 rounded-lg animate-pulse flex items-center justify-center">
        <div className="text-gray-400">Loading chart...</div>
      </div>
    );
  }

  if (!data.datasets.length || !data.labels.length) {
    return (
      <div className="h-[300px] bg-white/5 rounded-lg flex items-center justify-center">
        <p className="text-gray-400">No chart data available</p>
      </div>
    );
  }

  const allValues = data.datasets.flatMap(d => d.data);
  const maxValue = Math.max(...allValues, 1); // Prevent division by zero

  return (
    <div className="relative h-[300px] w-full">
      {/* Y-axis labels */}
      <div className="absolute left-0 top-0 bottom-8 w-12 flex flex-col justify-between text-xs text-gray-400">
        <span>{(maxValue / 1000).toFixed(0)}k</span>
        <span>{(maxValue / 2000).toFixed(0)}k</span>
        <span>0</span>
      </div>

      {/* Chart area */}
      <div className="ml-14 h-[calc(100%-32px)] relative">
        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {data.datasets.map((dataset, idx) => {
            const points = dataset.data.map((value, index) => {
              const x = data.labels.length > 1
                ? (index / (data.labels.length - 1)) * 100
                : 50;
              const y = 100 - (value / maxValue) * 100;
              return `${x},${y}`;
            });

            return (
              <polyline
                key={idx}
                points={points.join(' ')}
                fill="none"
                stroke={dataset.color}
                strokeWidth="2"
                className="opacity-70 hover:opacity-100 transition-opacity"
              />
            );
          })}
        </svg>

        {/* X-axis labels */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-gray-400 h-8 items-end">
          {data.labels.map((label, idx) => (
            <span key={idx}>{label}</span>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="absolute top-0 right-0 flex flex-wrap gap-3">
        {data.datasets.map((dataset, idx) => (
          <div key={idx} className="flex items-center gap-1.5 text-xs">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: dataset.color }}
            />
            <span className="text-gray-400">{dataset.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// =====================================
// METRIC CARD COMPONENT
// =====================================

interface MetricCardProps {
  metric: MetricCardData;
  isLoading?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({ metric, isLoading }) => {
  if (isLoading) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 animate-pulse">
        <div className="flex items-center justify-between mb-3">
          <div className="w-12 h-12 bg-gray-700 rounded-lg" />
          <div className="w-4 h-4 bg-gray-700 rounded" />
        </div>
        <div className="h-8 bg-gray-700 rounded w-24 mb-1" />
        <div className="h-4 bg-gray-700 rounded w-32 mb-2" />
        <div className="h-4 bg-gray-700 rounded w-20" />
      </div>
    );
  }

  return (
    <div
      className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 hover:bg-gray-800/70 transition-all group relative"
      title={metric.tooltip}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`p-3 rounded-lg bg-gradient-to-r ${metric.color} bg-opacity-20`}>
          {metric.icon}
        </div>
        <button className="text-gray-400 hover:text-white">
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>
      <div className="text-3xl font-bold text-white mb-1">{metric.value}</div>
      <div className="text-sm text-gray-400 mb-2">{metric.label}</div>
      <div className="flex items-center gap-2">
        {metric.trend === 'up' ? (
          <ChevronUp className="w-4 h-4 text-green-400" />
        ) : metric.trend === 'down' ? (
          <ChevronDown className="w-4 h-4 text-red-400" />
        ) : (
          <span className="w-4 h-4 text-gray-400">—</span>
        )}
        <span className={`text-sm ${
          metric.trend === 'up' ? 'text-green-400' :
          metric.trend === 'down' ? 'text-red-400' :
          'text-gray-400'
        }`}>
          {metric.trend === 'neutral' ? '0' : Math.abs(metric.change)}%
        </span>
        <span className="text-xs text-gray-500">{metric.changeLabel}</span>
      </div>

      {/* Tooltip indicator for partial data */}
      {metric.tooltip && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <AlertCircle className="w-4 h-4 text-yellow-500" />
        </div>
      )}
    </div>
  );
};

// =====================================
// LOADING SKELETON
// =====================================

const MetricsGridSkeleton: React.FC = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    {[1, 2, 3, 4].map(i => (
      <MetricCard key={i} metric={{} as MetricCardData} isLoading={true} />
    ))}
  </div>
);

// =====================================
// HELPER: Transform dailyData to ChartData
// =====================================

const transformToChartData = (dailyData: InsightsDailyData[]): ChartData => {
  if (!dailyData.length) {
    return { labels: [], datasets: [] };
  }

  return {
    labels: dailyData.map(d => d.dateLabel),
    datasets: [
      {
        label: 'Impressions',
        data: dailyData.map(d => d.impressions),
        color: '#3b82f6',         // blue-500
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)'
      },
      {
        label: 'Reach',
        data: dailyData.map(d => d.reach),
        color: '#8b5cf6',         // purple-500
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.1)'
      },
      {
        label: 'Profile Views',
        data: dailyData.map(d => d.profile_views),
        color: '#ec4899',         // pink-500
        borderColor: '#ec4899',
        backgroundColor: 'rgba(236, 72, 153, 0.1)'
      },
      {
        label: 'Website Clicks',
        data: dailyData.map(d => d.website_clicks),
        color: '#22c55e',         // green-500
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34, 197, 94, 0.1)'
      }
    ]
  };
};

// =====================================
// MAIN COMPONENT
// =====================================

const Analytics: React.FC = () => {
  const navigate = useNavigate();

  // ✅ Get Instagram account data
  const {
    businessAccountId,
    isLoading: accountLoading
  } = useInstagramAccount();

  // ✅ Get real insights data from hook
  const {
    metrics,
    dailyData,
    isLoading,
    error,
    isRetrying,
    retryCount,
    refetch
  } = useInstagramInsights('7d');

  // Combined loading state
  const isPageLoading = accountLoading || isLoading;

  // =====================================
  // EDGE CASE: No Account Connected
  // =====================================

  if (!accountLoading && !businessAccountId) {
    return (
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Analytics Dashboard</h1>
            <p className="text-gray-300 text-lg">Track your Instagram performance and growth</p>
          </div>
        </div>

        {/* No Account Banner */}
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-8 text-center">
          <Link2 className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Instagram Account Connected</h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Connect your Instagram Business Account to view analytics and track your performance.
          </p>
          <button
            onClick={() => navigate('/settings')}
            className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-black font-medium rounded-lg transition-all"
          >
            Connect Account
          </button>
        </div>
      </div>
    );
  }

  // =====================================
  // EDGE CASE: Token Expired or Permissions Error
  // =====================================

  if (error?.includes('token expired')) {
    return (
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Analytics Dashboard</h1>
            <p className="text-gray-300 text-lg">Track your Instagram performance and growth</p>
          </div>
        </div>

        {/* Token Expired Banner */}
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Instagram Token Expired</h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Your Instagram connection has expired. Please reconnect your account to continue viewing analytics.
          </p>
          <button
            onClick={() => navigate('/settings')}
            className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-all"
          >
            Reconnect Account
          </button>
        </div>
      </div>
    );
  }

  if (error?.includes('permission')) {
    return (
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Analytics Dashboard</h1>
            <p className="text-gray-300 text-lg">Track your Instagram performance and growth</p>
          </div>
        </div>

        {/* Permission Error Banner */}
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-orange-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Missing Insights Permission</h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Your account doesn't have the required permissions to view insights. Please reconnect with the necessary permissions.
          </p>
          <button
            onClick={() => navigate('/settings')}
            className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-all"
          >
            Update Permissions
          </button>
        </div>
      </div>
    );
  }

  // =====================================
  // MAIN RENDER
  // =====================================

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Analytics Dashboard</h1>
          <p className="text-gray-300 text-lg">Track your Instagram performance and growth</p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={refetch}
            disabled={isLoading}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-all flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Retry State Banner */}
      {isRetrying && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-center">
          <p className="text-blue-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Rate limit hit—retrying... (Attempt {retryCount}/3)
          </p>
        </div>
      )}

      {/* Error State Banner (Generic) */}
      {error && !error.includes('token expired') && !error.includes('permission') && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <p className="text-red-400">{error}</p>
            </div>
            <button
              onClick={refetch}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all text-sm"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      {isPageLoading ? (
        <MetricsGridSkeleton />
      ) : metrics.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {metrics.map((metric, index) => (
            <MetricCard key={index} metric={metric} />
          ))}
        </div>
      ) : !error && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6 text-center">
          <p className="text-yellow-400 mb-2">No insights data available</p>
          <p className="text-sm text-gray-400">
            Instagram needs 24-48 hours of account activity to generate insights.
          </p>
        </div>
      )}

      {/* Performance Chart */}
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-semibold text-white">Performance Trend</h3>
            <p className="text-sm text-gray-400 mt-1">Last 7 days</p>
          </div>
        </div>
        <SimpleLineChart
          data={transformToChartData(dailyData)}
          isLoading={isPageLoading}
        />
      </div>

      {/* Info Footer */}
      <div className="text-center text-sm text-gray-500">
        <p>Data refreshed from Instagram Insights API • Last 7 days</p>
      </div>
    </div>
  );
};

export default Analytics;
