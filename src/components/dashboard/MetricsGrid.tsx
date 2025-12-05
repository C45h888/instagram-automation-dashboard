import React from 'react';
import { TrendingUp, TrendingDown, Minus, Users, Heart, Image, DollarSign } from 'lucide-react';
import type { MetricData } from '../../types/dashboard';

interface MetricCardProps extends MetricData {
  isLoading?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({ 
  title, 
  value, 
  change, 
  trend, 
  icon, 
  color,
  isLoading = false 
}) => {
  const getIcon = (iconName: string) => {
    const icons = {
      'users': Users,
      'heart': Heart,
      'image': Image,
      'dollar-sign': DollarSign
    };
    const IconComponent = icons[iconName as keyof typeof icons] || Users;
    return <IconComponent className={`w-5 h-5 ${color}`} />;
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'up': return 'text-green-400';
      case 'down': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return <TrendingUp className="w-4 h-4" />;
      case 'down': return <TrendingDown className="w-4 h-4" />;
      default: return <Minus className="w-4 h-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="glass-morphism-card p-6 rounded-xl animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-10 bg-white/10 rounded-lg"></div>
          <div className="w-16 h-4 bg-white/10 rounded"></div>
        </div>
        <div className="w-20 h-8 bg-white/10 rounded mb-2"></div>
        <div className="w-24 h-4 bg-white/10 rounded"></div>
      </div>
    );
  }

  return (
    <div className="glass-morphism-card p-6 rounded-xl hover:scale-105 transition-all duration-300 hover:bg-white/10">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 rounded-lg bg-white/10">
          {getIcon(icon)}
        </div>
        <span className={`text-sm font-medium flex items-center ${getTrendColor()}`}>
          {getTrendIcon()}
          <span className="ml-1">{change}</span>
        </span>
      </div>
      <h3 className="text-2xl font-bold text-white mb-1">{value}</h3>
      <p className="text-gray-400 text-sm">{title}</p>
    </div>
  );
};

interface MetricsGridProps {
  metrics: MetricData[];
  isLoading?: boolean;
}

const MetricsGrid: React.FC<MetricsGridProps> = ({ metrics, isLoading = false }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {isLoading ? (
        Array.from({ length: 4 }).map((_, index) => (
          <MetricCard key={index} {...{} as MetricData} isLoading={true} />
        ))
      ) : (
        metrics.map((metric, index) => (
          <MetricCard key={index} {...metric} />
        ))
      )}
    </div>
  );
};

export default MetricsGrid;