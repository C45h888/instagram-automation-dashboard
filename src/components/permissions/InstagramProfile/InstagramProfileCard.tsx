// =====================================
// INSTAGRAM PROFILE CARD COMPONENT
// Demonstrates instagram_basic permission
// Optimized with shared components
// =====================================

import React from 'react';
import { Instagram, ExternalLink, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { PermissionBadge } from '../shared/PermissionBadge';
import { ProfileStats } from './ProfileStats';
import type { InstagramProfileData } from '../../../types/permissions';

interface InstagramProfileCardProps {
  account: InstagramProfileData;
  className?: string;
}

export const InstagramProfileCard: React.FC<InstagramProfileCardProps> = ({
  account,
  className = ''
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`
        glass-morphism-card p-6 rounded-xl
        bg-gradient-to-br from-purple-500/10 to-pink-500/10
        border border-purple-500/30
        ${className}
      `}
    >
      {/* Permission Badge */}
      <div className="flex items-center justify-between mb-4">
        <PermissionBadge permission="instagram_basic" status="granted" />
        <CheckCircle className="w-5 h-5 text-green-400" />
      </div>

      {/* Profile Header */}
      <div className="flex items-center space-x-4 mb-6">
        {account.profile_picture_url ? (
          <img
            src={account.profile_picture_url}
            alt={account.username}
            className="w-20 h-20 rounded-full border-4 border-purple-500/50"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Instagram className="w-10 h-10 text-white" />
          </div>
        )}

        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <h2 className="text-2xl font-bold text-white">@{account.username}</h2>
            {account.is_verified && (
              <CheckCircle className="w-5 h-5 text-blue-400" fill="currentColor" />
            )}
          </div>
          <p className="text-gray-300">{account.name}</p>
          <span className="inline-block mt-1 px-2 py-0.5 bg-blue-500/20 text-blue-300 text-xs rounded">
            {account.account_type === 'business' ? '🏢 Business' :
             account.account_type === 'creator' ? '⭐ Creator' : '👤 Personal'}
          </span>
        </div>
      </div>

      {/* Biography */}
      {account.biography && (
        <div className="mb-4">
          <p className="text-gray-300 text-sm">{account.biography}</p>
        </div>
      )}

      {/* Website */}
      {account.website && (
        <div className="mb-4">
          <a
            href={account.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 text-sm flex items-center"
          >
            <ExternalLink className="w-4 h-4 mr-1" />
            {account.website}
          </a>
        </div>
      )}

      {/* Stats - Retrieved via instagram_basic */}
      <ProfileStats
        followers={account.followers_count}
        following={account.following_count}
        posts={account.media_count}
      />

      {/* Demo Note for Reviewers */}
      <div className="mt-4 pt-4 border-t border-purple-500/20">
        <p className="text-xs text-purple-300 text-center">
          ✓ Profile data retrieved using <span className="font-mono font-bold">instagram_basic</span> permission
        </p>
      </div>
    </motion.div>
  );
};

export default InstagramProfileCard;
