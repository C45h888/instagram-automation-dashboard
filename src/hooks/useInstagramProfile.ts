// =====================================
// USE INSTAGRAM PROFILE HOOK - PRODUCTION
// Fetches REAL Instagram profile data from Meta Graph API
// NO MOCK DATA, NO FALLBACKS
// =====================================

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import type { InstagramProfileData } from '../types/permissions';

interface UseInstagramProfileResult {
  profile: InstagramProfileData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook to fetch Instagram profile data
 * @param businessAccountId - Instagram Business Account ID (optional)
 */
export const useInstagramProfile = (businessAccountId?: string): UseInstagramProfileResult => {
  const { user, token } = useAuthStore();
  const [profile, setProfile] = useState<InstagramProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!businessAccountId) {
      setError('No Instagram Business Account connected. Please reconnect your account.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // ✅ REAL API CALL - No fallback
      const response = await fetch(
        `/api/instagram/profile/${businessAccountId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
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
  }, [businessAccountId, token]);

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
