// =====================================
// USE INSTAGRAM PROFILE HOOK - PRODUCTION
// Fetches REAL Instagram profile data from Meta Graph API v23.0
// NO MOCK DATA, NO FALLBACKS
//
// ✅ UPDATED: Uses useInstagramAccount hook
// ✅ UPDATED: Passes userId + businessAccountId query params
// ✅ UPDATED: No Authorization header (backend handles tokens)
// ✅ UPDATED: Uses VITE_API_BASE_URL
// =====================================

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useInstagramAccount } from './useInstagramAccount';
import type { InstagramProfileData } from '../types/permissions';

interface UseInstagramProfileResult {
  profile: InstagramProfileData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook to fetch Instagram profile data
 * ✅ UPDATED: No longer takes businessAccountId parameter (gets from useInstagramAccount)
 */
export const useInstagramProfile = (): UseInstagramProfileResult => {
  // ✅ NEW: Get user ID from auth store (no token needed)
  const { user } = useAuthStore();

  // ✅ NEW: Get Instagram account IDs from useInstagramAccount hook
  const { businessAccountId, instagramBusinessId } = useInstagramAccount();

  const [profile, setProfile] = useState<InstagramProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    // ✅ UPDATED: Validate user ID and business account ID
    if (!user?.id || !businessAccountId || !instagramBusinessId) {
      setError('No Instagram Business Account connected. Please reconnect your account.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // ✅ UPDATED: Use VITE_API_BASE_URL from environment
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://api.888intelligenceautomation.in';

      // ✅ UPDATED: Build URL with full base URL and required query parameters
      const response = await fetch(
        `${apiBaseUrl}/api/instagram/profile/${instagramBusinessId}?userId=${user.id}&businessAccountId=${businessAccountId}`,
        {
          headers: {
            // ✅ REMOVED: Authorization header (backend retrieves token internally)
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API Error: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch profile');
      }

      setProfile(result.data);
      console.log('✅ Profile fetched:', result.data?.username);

    } catch (err: any) {
      console.error('❌ Profile fetch failed:', err);
      setError(err.message || 'Failed to fetch profile. Check console for details.');
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, businessAccountId, instagramBusinessId]); // ✅ UPDATED: Removed token, added user.id and instagramBusinessId

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return {
    profile,
    isLoading,
    error,
    refetch: fetchProfile
  };
};

export default useInstagramProfile;
