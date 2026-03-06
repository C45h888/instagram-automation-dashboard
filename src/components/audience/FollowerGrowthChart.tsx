/**
 * FollowerGrowthChart.tsx
 *
 * Standard glass-morphism area chart for follower growth.
 * Uses Recharts with project color palette.
 */

import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Loader2 } from 'lucide-react';
import AnimatedCard from '../ui/AnimatedCard';

interface ChartDataPoint {
  date: string;
  followers: number | null;
  engagement?: number | null;
  impressions?: number | null;
  reach?: number | null;
}

interface FollowerGrowthChartProps {
  data: ChartDataPoint[];
  isLoading?: boolean;
  title?: string;
}

const FollowerGrowthChart: React.FC<FollowerGrowthChartProps> = ({
  data,
  isLoading = false,
  title = 'Follower Growth Trend',
}) => {
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-morphism-card p-4 rounded-lg border border-white/10 shadow-xl">
          <p className="text-white font-medium mb-2 text-sm">
            {formatDate(label)}
          </p>
          {payload.map((entry: any, index: number) => (
            <p
              key={index}
              className="text-sm"
              style={{ color: entry.color }}
            >
              {entry.name}: {entry.value !== null ? formatNumber(entry.value) : 'N/A'}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <AnimatedCard className="glass-morphism-card p-6" hoverEffect="glow">
        <h2 className="text-xl font-bold text-white mb-6">{title}</h2>
        <div className="h-80 flex items-center justify-center">
          <div className="flex items-center gap-2 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading chart data...</span>
          </div>
        </div>
      </AnimatedCard>
    );
  }

  if (!data || data.length === 0) {
    return (
      <AnimatedCard className="glass-morphism-card p-6" hoverEffect="glow">
        <h2 className="text-xl font-bold text-white mb-6">{title}</h2>
        <div className="h-80 flex items-center justify-center">
          <span className="text-gray-400 text-sm">
            No data available. Connect your Instagram account to see analytics.
          </span>
        </div>
      </AnimatedCard>
    );
  }

  return (
    <AnimatedCard className="glass-morphism-card p-6" hoverEffect="glow">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">{title}</h2>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-400"></div>
            <span className="text-gray-300">Followers</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-400"></div>
            <span className="text-gray-300">Engagement %</span>
          </div>
        </div>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="followersGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#60A5FA" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#60A5FA" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="engagementGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34D399" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#34D399" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis
              dataKey="date"
              stroke="#9CA3AF"
              fontSize={12}
              tickFormatter={formatDate}
              tick={{ fill: '#9CA3AF' }}
            />
            <YAxis
              yAxisId="left"
              stroke="#9CA3AF"
              fontSize={12}
              tickFormatter={formatNumber}
              tick={{ fill: '#9CA3AF' }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#9CA3AF"
              fontSize={12}
              tickFormatter={(value) => `${value}%`}
              tick={{ fill: '#9CA3AF' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="followers"
              name="Followers"
              stroke="#60A5FA"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#followersGradient)"
              connectNulls
            />
            <Area
              yAxisId="right"
              type="monotone"
              dataKey="engagement"
              name="Engagement"
              stroke="#34D399"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#engagementGradient)"
              connectNulls
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </AnimatedCard>
  );
};

export default FollowerGrowthChart;
