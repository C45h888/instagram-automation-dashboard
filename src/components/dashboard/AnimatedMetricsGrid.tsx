import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, Users, Heart, Image, DollarSign } from 'lucide-react';
import CountUpAnimation from '../ui/CountUpAnimation';
import AnimatedCard from '../ui/AnimatedCard';
import type { MetricData } from '../../data/mockData';

interface AnimatedMetricCardProps extends MetricData {
  index: number;
}

const AnimatedMetricCard: React.FC<AnimatedMetricCardProps> = ({ 
  title, 
  value, 
  change, 
  trend, 
  icon, 
  color,
  index
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

  const numericValue = parseFloat(value.replace(/[^0-9.]/g, ''));
  const suffix = value.replace(/[0-9.]/g, '');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.5, 
        delay: index * 0.1,
        ease: 'easeOut'
      }}
    >
      <AnimatedCard 
        hoverEffect="lift"
        className="p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <motion.div 
            className="p-2 rounded-lg bg-white/10"
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ duration: 0.2 }}
          >
            {getIcon(icon)}
          </motion.div>
          <motion.span 
            className={`text-sm font-medium flex items-center ${getTrendColor()}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 + 0.3 }}
          >
            <motion.div
              animate={{ 
                y: trend === 'up' ? [-2, 0] : trend === 'down' ? [2, 0] : [0, 0]
              }}
              transition={{ 
                duration: 0.5, 
                delay: index * 0.1 + 0.5,
                ease: 'easeOut'
              }}
            >
              {getTrendIcon()}
            </motion.div>
            <span className="ml-1">{change}</span>
          </motion.span>
        </div>
        
        <motion.h3 
          className="text-2xl font-bold text-white mb-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: index * 0.1 + 0.2 }}
        >
          <CountUpAnimation
            end={numericValue}
            suffix={suffix}
            duration={1000}
            triggerOnMount
            decimals={suffix.includes('.') ? 1 : 0}
          />
        </motion.h3>
        
        <motion.p 
          className="text-gray-400 text-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: index * 0.1 + 0.4 }}
        >
          {title}
        </motion.p>
      </AnimatedCard>
    </motion.div>
  );
};

interface AnimatedMetricsGridProps {
  metrics: MetricData[];
  isLoading?: boolean;
}

const AnimatedMetricsGrid: React.FC<AnimatedMetricsGridProps> = ({ 
  metrics, 
  isLoading = false 
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, index) => (
          <motion.div
            key={index}
            className="glass-morphism-card p-6 rounded-xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            <div className="animate-pulse">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 bg-white/10 rounded-lg"></div>
                <div className="w-16 h-4 bg-white/10 rounded"></div>
              </div>
              <div className="w-20 h-8 bg-white/10 rounded mb-2"></div>
              <div className="w-24 h-4 bg-white/10 rounded"></div>
            </div>
          </motion.div>
        ))}
      </div>
    );
  }

  return (
    <motion.div 
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {metrics.map((metric, index) => (
        <AnimatedMetricCard key={index} {...metric} index={index} />
      ))}
    </motion.div>
  );
};

export default AnimatedMetricsGrid;