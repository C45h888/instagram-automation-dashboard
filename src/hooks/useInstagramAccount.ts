// src/hooks/useInstagramAccount.ts
import { useState, useEffect } from 'react';
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
  const [accounts, setAccounts] = useState<InstagramBusinessAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = async () => {
    if (!userId) {
      setIsLoading(false);
      setError('User not authenticated');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // IMPORTANT: userId here is user.id (UUID from Supabase Auth)
      // user.facebook_id is ONLY for Meta Graph API calls, NEVER for database queries
      console.log('🔍 Fetching business accounts for UUID:', userId);

      const result = await DatabaseService.getBusinessAccounts(userId);

      if (result.success && result.data) {
        setAccounts(result.data);

        if (result.data.length === 0) {
          console.warn('⚠️ No Instagram accounts connected');
          setError('No Instagram accounts connected. Please connect an account first.');
        } else {
          console.log(`✅ Found ${result.data.length} Instagram account(s)`);
        }
      } else {
        console.error('❌ Failed to fetch business accounts:', result.error);
        setError(result.error || 'Failed to fetch Instagram accounts');
      }
    } catch (err: any) {
      console.error('❌ Failed to fetch Instagram accounts:', err);
      setError(err.message || 'An error occurred while fetching accounts');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [userId]);

  // Use first account as primary (future: allow user to select)
  const primaryAccount = accounts[0];

  return {
    accounts,
    businessAccountId: primaryAccount?.id || null,  // UUID for backend
    instagramBusinessId: primaryAccount?.instagram_business_id || null,  // For API :accountId
    isLoading,
    error,
    refetch: fetchAccounts
  };
};
