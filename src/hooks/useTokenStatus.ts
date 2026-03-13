// src/hooks/useTokenStatus.ts
// Polls /token-status for PAT + UAT health.
// Used by TokenWarningBanner to show proactive expiry warnings.

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useInstagramAccount } from './useInstagramAccount';

export interface UatStatus {
  status: 'valid' | 'warning' | 'critical' | 'expired' | 'missing';
  warning: string | null;
  expiresAt: string | null;
  dataAccessExpiresAt: string | null;
  lastRefreshedAt: string | null;
}

export interface PatStatus {
  status: 'valid' | 'missing';
  scope?: string[];
}

interface TokenStatusResult {
  pat: PatStatus | null;
  uat: UatStatus | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useTokenStatus = (): TokenStatusResult => {
  const { user } = useAuthStore();
  const { businessAccountId } = useInstagramAccount();

  const [pat, setPat] = useState<PatStatus | null>(null);
  const [uat, setUat] = useState<UatStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!user?.id || !businessAccountId) return;

    setIsLoading(true);
    setError(null);

    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://api.888intelligenceautomation.in';
      const res = await fetch(
        `${apiBaseUrl}/api/instagram/token-status?userId=${encodeURIComponent(user.id)}&businessAccountId=${encodeURIComponent(businessAccountId)}`
      );
      const data = await res.json();

      if (data.success) {
        setPat(data.pat ?? null);
        setUat(data.uat ?? null);
      } else {
        setError(data.error || 'Failed to fetch token status');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, businessAccountId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return { pat, uat, isLoading, error, refetch: fetchStatus };
};

export default useTokenStatus;
