import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import type { ChartDataPoint } from '../../data/mockData';

interface PerformanceChartProps {
  data: ChartDataPoint[];
  isLoading?: boolean;
}

const PerformanceChart: React.FC<PerformanceChartProps> = ({ data, isLoading = false }) => {
  if (isLoading) {
    return (
      <div className="glass-morphism-card p-6 rounded-2xl">
        <h2 className="text-xl font-bold text-white mb-6">Performance Overview</h2>
        <div className="h-80 bg-white/5 rounded-lg animate-pulse flex items-center justify-center">
          <div className="text-gray-400">Loading chart...</div>
        </div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-morphism-card p-4 rounded-lg border border-white/20">
          <p className="text-white font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
              {entry.dataKey === 'engagement' ? '%' : entry.dataKey === 'followers' ? '' : ''}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="glass-morphism-card p-6 rounded-2xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Performance Overview</h2>
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-blue-400"></div>
            <span className="text-gray-300">Followers</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-green-400"></div>
            <span className="text-gray-300">Engagement</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-purple-400"></div>
            <span className="text-gray-300">Posts</span>
          </div>
        </div>
      </div>
      
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="followersGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#60A5FA" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#60A5FA" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="engagementGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34D399" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#34D399" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis 
              dataKey="date" 
              stroke="#9CA3AF"
              fontSize={12}
            />
            <YAxis 
              stroke="#9CA3AF"
              fontSize={12}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="followers"
              stroke="#60A5FA"
              fillOpacity={1}
              fill="url(#followersGradient)"
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="engagement"
              stroke="#34D399"
              strokeWidth={2}
              dot={{ fill: '#34D399', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: '#34D399', strokeWidth: 2 }}
            />
            <Line
              type="monotone"
              dataKey="posts"
              stroke="#A78BFA"
              strokeWidth={2}
              dot={{ fill: '#A78BFA', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: '#A78BFA', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default PerformanceChart;