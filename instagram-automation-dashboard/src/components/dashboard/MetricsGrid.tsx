import React from 'react';
import { TrendingUp, Users, MessageCircle, DollarSign } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string;
  change: number;
  icon: React.ReactNode;
  trend: 'up' | 'down' | 'neutral';
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, change, icon, trend }) => {
  const getTrendColor = () => {
    switch (trend) {
      case 'up': return 'text-green-400';
      case 'down': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="glass-morphism-card p-6 rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 rounded-lg bg-white/10">
          {icon}
        </div>
        <span className={`text-sm font-medium ${getTrendColor()}`}>
          {change > 0 ? '+' : ''}{change}%
        </span>
      </div>
      <h3 className="text-2xl font-bold text-white mb-1">{value}</h3>
      <p className="text-gray-400 text-sm">{title}</p>
    </div>
  );
};

const MetricsGrid: React.FC = () => {
  const metrics = [
    {
      title: 'Total Followers',
      value: '24.5K',
      change: 12.5,
      icon: <Users className="w-5 h-5 text-blue-400" />,
      trend: 'up' as const
    },
    {
      title: 'Engagement Rate',
      value: '4.2%',
      change: -2.1,
      icon: <MessageCircle className="w-5 h-5 text-purple-400" />,
      trend: 'down' as const
    },
    {
      title: 'Posts Today',
      value: '12',
      change: 0,
      icon: <TrendingUp className="w-5 h-5 text-green-400" />,
      trend: 'neutral' as const
    },
    {
      title: 'Revenue',
      value: '$3,240',
      change: 18.7,
      icon: <DollarSign className="w-5 h-5 text-yellow-400" />,
      trend: 'up' as const
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {metrics.map((metric, index) => (
        <MetricCard key={index} {...metric} />
      ))}
    </div>
  );
};

export default MetricsGrid;