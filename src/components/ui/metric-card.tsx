import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string;
  change_percentage: number;
  trend_direction: 'up' | 'down';
  time_period: string;
  sparkline_data?: number[];
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change_percentage,
  trend_direction,
  time_period,
  sparkline_data = []
}) => {
  const isPositive = trend_direction === 'up';
  const changeColor = isPositive ? 'text-green-400' : 'text-red-400';
  const bgColor = isPositive ? 'bg-green-500/10' : 'bg-red-500/10';

  return (
    <div className="bg-white/10 backdrop-blur-xl p-6 rounded-2xl border border-white/20 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-gray-300 text-sm font-medium">{title}</h3>
        <div className={`p-2 rounded-lg ${bgColor}`}>
          {isPositive ? (
            <TrendingUp className="w-4 h-4 text-green-400" />
          ) : (
            <TrendingDown className="w-4 h-4 text-red-400" />
          )}
        </div>
      </div>
      
      <div className="mb-4">
        <div className="text-3xl font-bold text-white mb-1">{value}</div>
        <div className="flex items-center space-x-2">
          <span className={`text-sm font-medium ${changeColor}`}>
            {trend_direction === 'up' ? '+' : '-'}{Math.abs(change_percentage)}%
          </span>
          <span className="text-gray-400 text-sm">{time_period}</span>
        </div>
      </div>

      {sparkline_data.length > 0 && (
        <div className="h-12 flex items-end space-x-1">
          {sparkline_data.map((point, index) => {
            const maxValue = Math.max(...sparkline_data);
            const height = (point / maxValue) * 100;
            return (
              <div
                key={index}
                className={`flex-1 rounded-t ${isPositive ? 'bg-green-400/70' : 'bg-red-400/70'}`}
                style={{ height: `${height}%` }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MetricCard;