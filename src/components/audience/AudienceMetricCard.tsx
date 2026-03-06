/**
 * AudienceMetricCard.tsx
 *
 * Standard glass-morphism metric card for audience insights.
 * Follows project pattern using glass-morphism-card and AnimatedCard.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import AnimatedCard from '../ui/AnimatedCard';

interface AudienceMetricCardProps {
  label: string;
  value: string | number;
  change?: number | null;
  changeLabel?: string;
  icon?: React.ReactNode;
  isLoading?: boolean;
  color?: 'blue' | 'green' | 'purple' | 'yellow' | 'red';
}

const AudienceMetricCard: React.FC<AudienceMetricCardProps> = ({
  label,
  value,
  change,
  changeLabel = 'vs last period',
  icon,
  isLoading = false,
  color = 'green',
}) => {
  const colorClasses = {
    blue: 'text-blue-400 bg-blue-400/20',
    green: 'text-green-400 bg-green-400/20',
    purple: 'text-purple-400 bg-purple-400/20',
    yellow: 'text-yellow-400 bg-yellow-400/20',
    red: 'text-red-400 bg-red-400/20',
  };

  const getTrendColor = (changeValue: number | null | undefined): string => {
    if (changeValue === null || changeValue === undefined) return 'text-gray-400';
    if (changeValue > 0) return 'text-green-400';
    if (changeValue < 0) return 'text-red-400';
    return 'text-gray-400';
  };

  const getTrendIcon = (changeValue: number | null | undefined) => {
    if (changeValue === null || changeValue === undefined) return <Minus className="w-3 h-3" />;
    if (changeValue > 0) return <TrendingUp className="w-3 h-3" />;
    if (changeValue < 0) return <TrendingDown className="w-3 h-3" />;
    return <Minus className="w-3 h-3" />;
  };

  if (isLoading) {
    return (
      <AnimatedCard className="glass-morphism-card p-6" hoverEffect="lift">
        <div className="flex items-center justify-between mb-4">
          <span className="text-gray-400 text-xs font-medium uppercase tracking-wider">
            {label}
          </span>
          {icon && (
            <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
              {icon}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
          <span className="text-gray-400 text-sm">Loading...</span>
        </div>
      </AnimatedCard>
    );
  }

  return (
    <AnimatedCard className="glass-morphism-card p-6" hoverEffect="lift">
      <div className="flex items-center justify-between mb-4">
        <span className="text-gray-400 text-xs font-medium uppercase tracking-wider">
          {label}
        </span>
        {icon && (
          <motion.div 
            className={`p-2 rounded-lg ${colorClasses[color]}`}
            whileHover={{ scale: 1.1, rotate: 5 }}
          >
            {icon}
          </motion.div>
        )}
      </div>
      
      <motion.h3 
        className="text-2xl md:text-3xl font-bold text-white mb-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        {value}
      </motion.h3>
      
      {change !== null && change !== undefined && (
        <motion.div 
          className={`flex items-center gap-1 text-sm font-medium ${getTrendColor(change)}`}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          {getTrendIcon(change)}
          <span>{change > 0 ? '+' : ''}{change.toFixed(1)}%</span>
          <span className="text-gray-400 ml-1">{changeLabel}</span>
        </motion.div>
      )}
    </AnimatedCard>
  );
};

export default AudienceMetricCard;
