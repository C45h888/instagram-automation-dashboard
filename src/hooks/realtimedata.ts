import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// Optimized with debouncing and connection management
export function useRealtimeWorkflows() {
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthStore();
  const channelRef = useRef<RealtimeChannel | null>(null);
  
  useEffect(() => {
    if (!user) {
      setWorkflows([]);
      setLoading(false);
      return;
    }
    
    let mounted = true;
    
    const setupRealtime = async () => {
      try {
        // Initial fetch with error handling
        const { data, error: fetchError } = await supabase
          .from('automation_workflows')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        
        if (fetchError) throw fetchError;
        
        if (mounted) {
          setWorkflows(data || []);
          setLoading(false);
        }
        
        // Set up realtime subscription
        channelRef.current = supabase
          .channel(`workflows-${user.id}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'automation_workflows',
              filter: `user_id=eq.${user.id}`
            },
            (payload: RealtimePostgresChangesPayload<any>) => {
              if (!mounted) return;
              
              setWorkflows(prev => {
                switch (payload.eventType) {
                  case 'INSERT':
                    return [payload.new, ...prev];
                  case 'UPDATE':
                    return prev.map(w => 
                      w.id === payload.new.id ? payload.new : w
                    );
                  case 'DELETE':
                    return prev.filter(w => w.id !== payload.old.id);
                  default:
                    return prev;
                }
              });
            }
          )
          .subscribe();
      } catch (err: any) {
        console.error('Realtime setup error:', err);
        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    };
    
    setupRealtime();
    
    return () => {
      mounted = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [user]);
  
  const refetch = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('automation_workflows')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setWorkflows(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);
  
  return { workflows, loading, error, refetch };
}

// Analytics hook with caching
export function useRealtimeAnalytics(businessAccountId: string | null) {
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);
  
  const calculateSummary = useCallback((data: any[]) => {
    if (!data || data.length === 0) return null;
    
    return {
      totalFollowers: data[0]?.followers_count || 0,
      avgEngagement: data.reduce((acc, d) => acc + (d.engagement_rate || 0), 0) / data.length,
      totalImpressions: data.reduce((acc, d) => acc + (d.impressions_count || 0), 0),
      totalReach: data.reduce((acc, d) => acc + (d.reach_count || 0), 0),
      growthRate: data.length > 1 
        ? ((data[0].followers_count - data[data.length - 1].followers_count) / 
           data[data.length - 1].followers_count * 100)
        : 0,
      periodDays: data.length
    };
  }, []);
  
  useEffect(() => {
    if (!businessAccountId) {
      setAnalytics([]);
      setSummary(null);
      setLoading(false);
      return;
    }
    
    let mounted = true;
    
    const fetchAnalytics = async () => {
      try {
        const { data, error } = await supabase
          .from('daily_analytics')
          .select('*')
          .eq('business_account_id', businessAccountId)
          .order('date', { ascending: false })
          .limit(30);
        
        if (error) throw error;
        
        if (mounted && data) {
          setAnalytics(data);
          setSummary(calculateSummary(data));
          setLoading(false);
        }
      } catch (err) {
        console.error('Analytics fetch error:', err);
        if (mounted) setLoading(false);
      }
    };
    
    fetchAnalytics();
    
    // Subscribe to changes with debouncing
    let debounceTimer: NodeJS.Timeout;
    
    channelRef.current = supabase
      .channel(`analytics-${businessAccountId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_analytics',
          filter: `business_account_id=eq.${businessAccountId}`
        },
        () => {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            if (mounted) fetchAnalytics();
          }, 1000); // Debounce for 1 second
        }
      )
      .subscribe();
    
    return () => {
      mounted = false;
      clearTimeout(debounceTimer);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [businessAccountId, calculateSummary]);
  
  return { analytics, summary, loading };
}

// Workflow executions with pagination
export function useRealtimeExecutions(workflowId: string | null, pageSize = 20) {
  const [executions, setExecutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const channelRef = useRef<RealtimeChannel | null>(null);
  
  const loadMore = useCallback(async () => {
    if (!workflowId || loading) return;
    
    setLoading(true);
    try {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      
      const { data, error, count } = await supabase
        .from('workflow_executions')
        .select('*', { count: 'exact' })
        .eq('workflow_id', workflowId)
        .order('started_at', { ascending: false })
        .range(from, to);
      
      if (error) throw error;
      
      if (data) {
        setExecutions(prev => [...prev, ...data]);
        setHasMore((count || 0) > (page + 1) * pageSize);
        setPage(prev => prev + 1);
      }
    } catch (err) {
      console.error('Load more executions error:', err);
    } finally {
      setLoading(false);
    }
  }, [workflowId, page, pageSize, loading]);
  
  useEffect(() => {
    if (!workflowId) {
      setExecutions([]);
      setLoading(false);
      return;
    }
    
    let mounted = true;
    
    const fetchInitial = async () => {
      try {
        const { data, error, count } = await supabase
          .from('workflow_executions')
          .select('*', { count: 'exact' })
          .eq('workflow_id', workflowId)
          .order('started_at', { ascending: false })
          .limit(pageSize);
        
        if (error) throw error;
        
        if (mounted && data) {
          setExecutions(data);
          setHasMore((count || 0) > pageSize);
          setPage(1);
          setLoading(false);
        }
      } catch (err) {
        console.error('Fetch executions error:', err);
        if (mounted) setLoading(false);
      }
    };
    
    fetchInitial();
    
    // Subscribe to new executions only
    channelRef.current = supabase
      .channel(`executions-${workflowId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'workflow_executions',
          filter: `workflow_id=eq.${workflowId}`
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          if (mounted) {
            setExecutions(prev => [payload.new, ...prev]);
          }
        }
      )
      .subscribe();
    
    return () => {
      mounted = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [workflowId, pageSize]);
  
  return { executions, loading, hasMore, loadMore };
}