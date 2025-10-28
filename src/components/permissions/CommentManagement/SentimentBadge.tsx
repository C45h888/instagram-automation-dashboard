// =====================================
// SENTIMENT BADGE COMPONENT
// Color-coded sentiment indicator for comments
// FIXED: Uses static color mapping for Tailwind JIT
// =====================================

import React from 'react';
import { Smile, Meh, Frown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface SentimentBadgeProps {
  sentiment: 'positive' | 'neutral' | 'negative';
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Static color mapping for Tailwind JIT compatibility
const SENTIMENT_STYLES = {
  positive: {
    bg: 'bg-green-500/20',
    text: 'text-green-300',
    border: 'border-green-500/30',
    icon: 'text-green-400',
    label: 'Positive'
  },
  neutral: {
    bg: 'bg-yellow-500/20',
    text: 'text-yellow-300',
    border: 'border-yellow-500/30',
    icon: 'text-yellow-400',
    label: 'Neutral'
  },
  negative: {
    bg: 'bg-red-500/20',
    text: 'text-red-300',
    border: 'border-red-500/30',
    icon: 'text-red-400',
    label: 'Negative'
  }
} as const;

const SENTIMENT_ICONS: Record<'positive' | 'neutral' | 'negative', LucideIcon> = {
  positive: Smile,
  neutral: Meh,
  negative: Frown
};

export const SentimentBadge: React.FC<SentimentBadgeProps> = ({
  sentiment,
  showIcon = true,
  size = 'md',
  className = ''
}) => {
  const style = SENTIMENT_STYLES[sentiment];
  const Icon = SENTIMENT_ICONS[sentiment];

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5'
  };

  const iconSizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  return (
    <span
      className={`
        inline-flex items-center space-x-1.5 rounded-full border font-medium
        ${style.bg} ${style.text} ${style.border}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {showIcon && <Icon className={`${iconSizeClasses[size]} ${style.icon}`} />}
      <span>{style.label}</span>
    </span>
  );
};

export default SentimentBadge;
