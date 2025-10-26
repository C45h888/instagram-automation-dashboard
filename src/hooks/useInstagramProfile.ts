// =====================================
// USE INSTAGRAM PROFILE HOOK
// Fetches Instagram profile data
// Follows existing useDashboardData pattern
// =====================================

import { useState, useEffect } from 'react';
import { usePermissionDemoStore } from '../stores/permissionDemoStore';
import PermissionDemoService from '../services/permissionDemoService';
import type { InstagramProfileData } from '../types/permissions';

interface UseInstagramProfileResult {
  profile: InstagramProfileData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useInstagramProfile = (): UseInstagramProfileResult => {
  const { demoMode } = usePermissionDemoStore();
  const [profile, setProfile] = useState<InstagramProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (demoMode) {
        // Use demo data generator
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API delay
        const demoData = PermissionDemoService.generateDemoData({
          realistic: true,
          volume: 'medium',
          includeEdgeCases: false,
          timeRange: 'week'
        });
        setProfile(demoData.profiles[0]);
      } else {
        // Fetch real data from Supabase
        // TODO: Implement real data fetching from instagram_business_accounts table
        // const { data, error } = await supabase
        //   .from('instagram_business_accounts')
        //   .select('*')
        //   .single();

        // For now, fallback to demo data
        const demoData = PermissionDemoService.generateDemoData({
          realistic: true,
          volume: 'medium',
          includeEdgeCases: false,
          timeRange: 'week'
        });
        setProfile(demoData.profiles[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch profile data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [demoMode]);

  return {
    profile,
    isLoading,
    error,
    refetch: fetchProfile
  };
};
