// =====================================
// USE DASHBOARD DATA HOOK - PRODUCTION
// Fetches REAL dashboard statistics from Meta Graph API
// NO MOCK DATA, NO FALLBACKS
// =====================================

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import type { DashboardData } from '../types/dashboard';

/**
 * Hook to fetch dashboard statistics
 * @param businessAccountId - Instagram Business Account ID (optional)
 */
export const useDashboardData = (businessAccountId?: string): DashboardData => {
  const { token } = useAuthStore();
  const [data, setData] = useState<DashboardData>({
    metrics: [],
    activities: [],
    recentMedia: [],
    chartData: [],
    isLoading: true,
    error: null,
    lastUpdated: null
  });

  const fetchDashboardData = useCallback(async () => {
    if (!businessAccountId) {
      setData(prev => ({
        ...prev,
        isLoading: false,
        error: 'No Instagram Business Account connected. Please reconnect your account.'
      }));
      return;
    }

    setData(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // ✅ REAL API CALL - No fallback
      const response = await fetch(
        `/api/instagram/dashboard-stats/${businessAccountId}`,
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
        throw new Error(result.error || 'Failed to fetch dashboard data');
      }

      setData({
        metrics: result.data.metrics || [],
        activities: result.data.activities || [],
        recentMedia: result.data.recentMedia || [],
        chartData: result.data.chartData || [],
        isLoading: false,
        error: null,
        lastUpdated: new Date()
      });

      console.log('✅ Dashboard data fetched successfully');

    } catch (err: any) {
      console.error('❌ Dashboard data fetch failed:', err);
      // ✅ FAIL LOUDLY - Display error, don't fallback to mock data
      setData(prev => ({
        ...prev,
        isLoading: false,
        error: err.message || 'Failed to fetch dashboard data. Check console for details.'
      }));
    }
  }, [businessAccountId, token]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return data;
};

export default useDashboardData;
