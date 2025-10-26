// =====================================
// FEATURE HIGHLIGHT COMPONENT
// Highlights key features for Meta reviewers
// Reusable across all permission demos
// FIXED: Uses color mapping instead of dynamic Tailwind classes
// =====================================

import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface FeatureHighlightProps {
  features: Array<{
    icon: LucideIcon;
    title: string;
    description: string;
    color: 'purple' | 'blue' | 'green' | 'pink' | 'red' | 'yellow';
  }>;
  columns?: 2 | 3 | 4;
  className?: string;
}

// ✅ FIXED: Static color mapping for Tailwind JIT compatibility
const COLOR_STYLES = {
  purple: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    icon: 'text-purple-400',
    text: 'text-purple-300'
  },
  blue: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    icon: 'text-blue-400',
    text: 'text-blue-300'
  },
  green: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    icon: 'text-green-400',
    text: 'text-green-300'
  },
  pink: {
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/30',
    icon: 'text-pink-400',
    text: 'text-pink-300'
  },
  red: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    icon: 'text-red-400',
    text: 'text-red-300'
  },
  yellow: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    icon: 'text-yellow-400',
    text: 'text-yellow-300'
  }
} as const;

export const FeatureHighlight: React.FC<FeatureHighlightProps> = ({
  features,
  columns = 3,
  className = ''
}) => {
  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4'
  }[columns];

  return (
    <div className={`grid ${gridCols} gap-4 ${className}`}>
      {features.map((feature, index) => {
        const Icon = feature.icon;
        const colorStyle = COLOR_STYLES[feature.color];

        return (
          <div
            key={index}
            className={`${colorStyle.bg} border ${colorStyle.border} rounded-lg p-4`}
          >
            <Icon className={`w-6 h-6 ${colorStyle.icon} mb-2`} />
            <p className={`${colorStyle.text} font-semibold mb-1`}>
              {feature.title}
            </p>
            <p className="text-xs text-gray-400">
              {feature.description}
            </p>
          </div>
        );
      })}
    </div>
  );
};

export default FeatureHighlight;
