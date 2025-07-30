import { useState, useEffect } from 'react';
import { mockMetrics, mockActivities, mockRecentMedia, mockChartData } from '../data/mockData';
import type { MetricData, ActivityItem, MediaItem, ChartDataPoint } from '../data/mockData';

interface DashboardData {
  metrics: MetricData[];
  activities: ActivityItem[];
  recentMedia: MediaItem[];
  chartData: ChartDataPoint[];
  isLoading: boolean;
  error: string | null;
}

export const useDashboardData = (): DashboardData => {
  const [data, setData] = useState<DashboardData>({
    metrics: [],
    activities: [],
    recentMedia: [],
    chartData: [],
    isLoading: true,
    error: null
  });

  useEffect(() => {
    // Simulate API loading delay
    const loadData = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setData({
          metrics: mockMetrics,
          activities: mockActivities,
          recentMedia: mockRecentMedia,
          chartData: mockChartData,
          isLoading: false,
          error: null
        });
      } catch (error) {
        setData(prev => ({
          ...prev,
          isLoading: false,
          error: 'Failed to load dashboard data'
        }));
      }
    };

    loadData();
  }, []);

  return data;
};