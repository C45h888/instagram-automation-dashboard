// src/hooks/useInstagramAccount.ts
// ============================================
// PHASE 3: MODERNIZED WITH TANSTACK QUERY
// Fixes: BLOCKER-03 (no retry logic)
// Added: Retry (3x), caching (5min), better errors
// Reference: current-work.md Phase 3
// ============================================

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { DatabaseService } from '../services/databaseservices';
import type { Database } from '../lib/database.types';

type InstagramBusinessAccount = Database['public']['Tables']['instagram_business_accounts']['Row'];

interface UseInstagramAccountResult {
  accounts: InstagramBusinessAccount[];
  businessAccountId: string | null;  // UUID for backend token retrieval
  instagramBusinessId: string | null;  // Meta's ID for API :accountId param
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useInstagramAccount = (): UseInstagramAccountResult => {
  const userId = useAuthStore(state => state.user?.id);

  // ============================================
  // TANSTACK QUERY SETUP (Replaces manual useState/useEffect)
  // ============================================
  const {
    data: accounts = [],
    error: queryError,
    isLoading,
    refetch
  } = useQuery({
    // Unique key for this query (invalidate when userId changes)
    queryKey: ['instagram-accounts', userId],

    // Query function - async fetch logic
    queryFn: async () => {
      if (!userId) {
        throw new Error('User not authenticated');
      }

      console.log('🔍 Fetching business accounts for UUID:', userId);

      // Fetch from database service
      const result = await DatabaseService.getBusinessAccounts(userId);

      // Log raw response for debugging
      console.log('📦 Raw API response:', JSON.stringify(result, null, 2));

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch accounts');
      }

      if (!result.data || result.data.length === 0) {
        // Detailed error logging for troubleshooting
        console.warn('⚠️ No Instagram accounts connected');
        console.warn('   Possible causes:');
        console.warn('   1. Missing OAuth scopes (business_management, pages_manage_metadata)');
        console.warn('   2. Instagram Business Account not linked to Facebook Page');
        console.warn('   3. Token exchange failed - check backend logs');
        console.warn('   4. User declined required permissions during OAuth');

        throw new Error(
          'No Instagram accounts found. Please ensure:\n' +
          '1. Your Facebook Page is connected to an Instagram Business Account\n' +
          '2. You granted all required permissions during login'
        );
      }

      console.log(`✅ Found ${result.data.length} Instagram account(s)`);
      return result.data;
    },

    // ============================================
    // TANSTACK QUERY OPTIONS (BLOCKER-03 FIX)
    // ============================================

    // Retry failed requests 3 times with exponential backoff
    // Backoff: 1s, 2s, 4s (total 7s max wait)
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

    // Cache data for 5 minutes (reduces API calls)
    staleTime: 5 * 60 * 1000,

    // Keep data in cache for 10 minutes even if component unmounts
    // NOTE: TanStack Query v5 renamed cacheTime → gcTime (garbage collection time)
    gcTime: 10 * 60 * 1000,

    // Don't refetch on window focus (too aggressive for this use case)
    refetchOnWindowFocus: false,

    // Only run query if userId exists
    enabled: !!userId,
  });

  // ============================================
  // DERIVE STATE FROM QUERY
  // ============================================
  // Use first account as primary (future: allow user to select)
  const primaryAccount = accounts[0];

  return {
    accounts,
    businessAccountId: primaryAccount?.id || null,  // UUID for backend
    instagramBusinessId: primaryAccount?.instagram_business_id || null,  // For API :accountId
    isLoading,
    // ✅ PHASE 1 FIX: Safe error handling - prevents crash if queryError is not an Error instance
    error: queryError
      ? (queryError instanceof Error ? queryError.message : String(queryError))
      : null,
    refetch: () => {
      console.log('🔄 Manual refetch triggered');
      refetch();
    }
  };
};
