import React, { forwardRef, useState } from 'react';
import { User, RefreshCw, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react';
import { useInstagramProfile } from '../../hooks/useInstagramProfile';
import { useInstagramAccount } from '../../hooks/useInstagramAccount';

const StatBlock: React.FC<{ label: string; value?: number | null }> = ({ label, value }) => (
  <div className="text-center">
    <p className="text-white text-lg font-bold">
      {value != null ? value.toLocaleString() : <span className="text-gray-500">—</span>}
    </p>
    <p className="text-gray-400 text-xs mt-0.5">{label}</p>
  </div>
);

const ProfileSkeleton: React.FC = () => (
  <div className="animate-pulse space-y-5">
    <div className="flex items-start gap-5">
      <div className="w-20 h-20 rounded-full bg-gray-700/60 flex-shrink-0" />
      <div className="flex-1 space-y-3 pt-1">
        <div className="h-5 bg-gray-700/60 rounded w-40" />
        <div className="h-4 bg-gray-700/40 rounded w-24" />
        <div className="h-4 bg-gray-700/40 rounded w-32" />
      </div>
    </div>
    <div className="grid grid-cols-3 gap-4">
      {[0,1,2].map(i => (
        <div key={i} className="text-center space-y-1.5">
          <div className="h-5 bg-gray-700/60 rounded mx-auto w-16" />
          <div className="h-3 bg-gray-700/40 rounded mx-auto w-12" />
        </div>
      ))}
    </div>
  </div>
);

const ProfilePreviewSection = forwardRef<HTMLDivElement>((_, ref) => {
  const { profile, isLoading, error, refetch } = useInstagramProfile();
  const { isLoading: accountLoading } = useInstagramAccount();
  const [bioExpanded, setBioExpanded] = useState(false);

  const loading = isLoading || accountLoading;
  const bio = profile?.biography || '';
  const bioTruncated = bio.length > 120 && !bioExpanded ? `${bio.slice(0, 120)}...` : bio;

  return (
    <div ref={ref} className="glass-morphism-card p-6 rounded-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-500/20 rounded-xl flex items-center justify-center">
            <User className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Profile Preview</h2>
            <p className="text-gray-400 text-sm">Your connected Instagram Business profile</p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700/50 hover:bg-gray-700 disabled:opacity-50 text-gray-300 hover:text-white text-xs font-medium rounded-lg transition-colors border border-gray-600"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Sync
        </button>
      </div>

      {loading && <ProfileSkeleton />}

      {!loading && error && (
        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-300 text-sm font-medium">Failed to load profile</p>
            <p className="text-red-400/70 text-xs mt-0.5">{error}</p>
            <button
              onClick={() => refetch()}
              className="text-red-400 text-xs underline mt-2 hover:text-red-300"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {!loading && !error && profile && (
        <>
          {/* Avatar + Name Row */}
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              {profile.profile_picture_url ? (
                <div className="w-20 h-20 rounded-full p-0.5 bg-gradient-to-tr from-yellow-500 to-yellow-300">
                  <img
                    src={profile.profile_picture_url}
                    alt={profile.username}
                    className="w-full h-full rounded-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-yellow-500 to-yellow-300 flex items-center justify-center">
                  <span className="text-2xl font-bold text-black">
                    {profile.username?.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              {profile.is_verified && (
                <div className="absolute -bottom-1 -right-1 bg-yellow-500 rounded-full p-0.5" title="Verified">
                  <CheckCircle className="w-4 h-4 text-black" />
                </div>
              )}
            </div>

            {/* Name + Badges */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-white font-bold text-lg">{profile.name || profile.username}</h3>
                {profile.account_type && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                    {profile.account_type}
                  </span>
                )}
              </div>
              <p className="text-gray-400 text-sm">@{profile.username}</p>

              {/* Bio */}
              {bio && (
                <div className="mt-2">
                  <p className="text-gray-300 text-sm leading-relaxed">{bioTruncated}</p>
                  {bio.length > 120 && (
                    <button
                      onClick={() => setBioExpanded(!bioExpanded)}
                      className="text-yellow-400 text-xs mt-1 hover:text-yellow-300"
                    >
                      {bioExpanded ? 'Show less' : 'Show more'}
                    </button>
                  )}
                </div>
              )}

              {/* Website */}
              {profile.website && (
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-400 text-xs mt-2 hover:text-blue-300"
                >
                  <ExternalLink className="w-3 h-3" />
                  {profile.website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-4 pt-2 border-t border-gray-700/50">
            <StatBlock label="Followers" value={profile.followers_count} />
            <StatBlock label="Following" value={profile.following_count} />
            <StatBlock label="Posts" value={profile.media_count} />
          </div>
        </>
      )}

      {!loading && !error && !profile && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <User className="w-10 h-10 text-gray-600" />
          <p className="text-gray-400 text-sm">No Instagram profile connected.</p>
          <p className="text-gray-500 text-xs">Connect your account in the Token Management section below.</p>
        </div>
      )}
    </div>
  );
});

ProfilePreviewSection.displayName = 'ProfilePreviewSection';

export default ProfilePreviewSection;
