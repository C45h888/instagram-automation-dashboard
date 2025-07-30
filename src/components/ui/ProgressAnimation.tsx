import React from 'react';
import { motion } from 'framer-motion';
import CountUpAnimation from './CountUpAnimation';

interface ProgressAnimationProps {
  value: number;
  max?: number;
  type?: 'linear' | 'circular';
  showPercentage?: boolean;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  animated?: boolean;
}

const ProgressAnimation: React.FC<ProgressAnimationProps> = ({
  value,
  max = 100,
  type = 'linear',
  showPercentage = true,
  color = 'from-purple-500 to-pink-500',
  size = 'md',
  className = '',
  animated = true
}) => {
  const percentage = Math.min((value / max) * 100, 100);
  
  const sizeClasses = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4'
  };

  const circularSizes = {
    sm: { size: 60, strokeWidth: 4 },
    md: { size: 80, strokeWidth: 6 },
    lg: { size: 100, strokeWidth: 8 }
  };

  if (type === 'circular') {
    const { size: circleSize, strokeWidth } = circularSizes[size];
    const radius = (circleSize - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDasharray = circumference;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
      <div className={`relative inline-flex items-center justify-center ${className}`}>
        <svg
          width={circleSize}
          height={circleSize}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={circleSize / 2}
            cy={circleSize / 2}
            r={radius}
            stroke="rgba(255, 255, 255, 0.1)"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress circle */}
          <motion.circle
            cx={circleSize / 2}
            cy={circleSize / 2}
            r={radius}
            stroke="url(#gradient)"
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeLinecap="round"
            strokeDasharray={strokeDasharray}
            initial={{ strokeDashoffset: circumference }}
            animate={animated ? { strokeDashoffset } : {}}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="#EC4899" />
            </linearGradient>
          </defs>
        </svg>
        {showPercentage && (
          <div className="absolute inset-0 flex items-center justify-center">
            <CountUpAnimation
              end={percentage}
              suffix="%"
              decimals={0}
              className="text-white font-semibold"
              triggerOnMount={animated}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      <div className={`w-full bg-white/10 rounded-full overflow-hidden ${sizeClasses[size]}`}>
        <motion.div
          className={`h-full bg-gradient-to-r ${color} rounded-full`}
          initial={{ width: 0 }}
          animate={animated ? { width: `${percentage}%` } : {}}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </div>
      {showPercentage && (
        <div className="mt-2 text-right">
          <CountUpAnimation
            end={percentage}
            suffix="%"
            decimals={1}
            className="text-white/70 text-sm"
            triggerOnMount={animated}
          />
        </div>
      )}
    </div>
  );
};

export default ProgressAnimation;