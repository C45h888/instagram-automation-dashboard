// =====================================
// PROFILE STATS COMPONENT
// Reusable stats display for followers, following, posts
// FIXED: Uses color mapping instead of dynamic Tailwind classes
// =====================================

import React from 'react';
import { Users, Image,  } from 'lucide-react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

interface ProfileStatsProps {
  followers?: number | null;
  following?: number | null;
  posts?: number | null;
  className?: string;
}

interface StatItem {
  icon: LucideIcon;
  label: string;
  value: number;
  color: 'purple' | 'pink' | 'blue';
}

// ✅ FIXED: Static color mapping for Tailwind JIT compatibility
const COLOR_CLASSES = {
  purple: 'text-purple-400',
  pink: 'text-pink-400',
  blue: 'text-blue-400'
} as const;

export const ProfileStats: React.FC<ProfileStatsProps> = ({
  followers,
  following,
  posts,
  className = ''
}) => {
  const stats: StatItem[] = [
    {
      icon: Users,
      label: 'Followers',
      value: followers ?? 0,
      color: 'purple'
    },
    {
      icon: Users,
      label: 'Following',
      value: following ?? 0,
      color: 'pink'
    },
    {
      icon: Image,
      label: 'Posts',
      value: posts ?? 0,
      color: 'blue'
    }
  ];

  return (
    <div className={`grid grid-cols-3 gap-4 ${className}`}>
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        const colorClass = COLOR_CLASSES[stat.color];

        return (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="text-center"
          >
            <Icon className={`w-5 h-5 ${colorClass} mx-auto mb-1`} />
            <p className="text-2xl font-bold text-white">
              {(stat.value ?? 0).toLocaleString()}
            </p>
            <p className="text-xs text-gray-400">{stat.label}</p>
          </motion.div>
        );
      })}
    </div>
  );
};

export default ProfileStats;
