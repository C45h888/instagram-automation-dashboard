// =====================================
// PERMISSION BADGE COMPONENT
// Displays permission name with visual indicator
// Used across all permission demo components
// =====================================

import React from 'react';
import { CheckCircle, Radio, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface PermissionBadgeProps {
  permission: 'instagram_basic' | 'instagram_manage_comments' |
              'instagram_content_publish' | 'instagram_manage_messages' |
              'pages_read_user_content';  // ✅ NEW: UGC permission
  status?: 'granted' | 'requesting' | 'denied';
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  description?: string;  // ✅ NEW: Optional override for description
}

const PERMISSION_CONFIG = {
  instagram_basic: {
    label: 'instagram_basic',
    color: 'purple',
    description: 'Read profile info, followers, media'
  },
  instagram_manage_comments: {
    label: 'instagram_manage_comments',
    color: 'blue',
    description: 'Read, create, delete comments'
  },
  instagram_content_publish: {
    label: 'instagram_content_publish',
    color: 'green',
    description: 'Create media, publish content'
  },
  instagram_manage_messages: {
    label: 'instagram_manage_messages',
    color: 'pink',
    description: 'Send and receive direct messages'
  },
  // ✅ NEW: UGC permission (Phase 4)
  pages_read_user_content: {
    label: 'pages_read_user_content',
    color: 'purple',
    description: 'Read visitor posts and brand mentions on your Instagram Business account'
  }
} as const;

export const PermissionBadge: React.FC<PermissionBadgeProps> = ({
  permission,
  status = 'granted',
  showIcon = true,
  size = 'md',
  className = '',
  description  // ✅ NEW: Optional custom description
}) => {
  const config = PERMISSION_CONFIG[permission];

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2'
  };

  const colorClasses = {
    purple: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    blue: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    green: 'bg-green-500/20 text-green-300 border-green-500/30',
    pink: 'bg-pink-500/20 text-pink-300 border-pink-500/30'
  };

  const StatusIcon = {
    granted: CheckCircle,
    requesting: Radio,
    denied: AlertCircle
  }[status];

  const statusColor = {
    granted: 'text-green-400',
    requesting: 'text-yellow-400',
    denied: 'text-red-400'
  }[status];

  // ✅ Use custom description if provided, otherwise use config
  const displayDescription = description || config.description;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={`
        inline-flex items-center space-x-2 font-mono rounded-full border
        ${sizeClasses[size]}
        ${colorClasses[config.color]}
        ${className}
      `}
      title={displayDescription}
    >
      {showIcon && status && (
        <StatusIcon className={`w-4 h-4 ${statusColor}`} />
      )}
      <span className="font-semibold">📡 {config.label}</span>
    </motion.div>
  );
};

export default PermissionBadge;
