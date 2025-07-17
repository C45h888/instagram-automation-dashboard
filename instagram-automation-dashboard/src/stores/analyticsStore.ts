import { create } from 'zustand';

interface AnalyticsState {
  metrics: Record<string, number>;
  timeRange: string;
  insights: string[];
  updateMetrics: (metrics: Record<string, number>) => void;
  setTimeRange: (range: string) => void;
  generateReport: () => void;
}

export const useAnalyticsStore = create<AnalyticsState>((set) => ({
  metrics: {},
  timeRange: '7d',
  insights: [],
  updateMetrics: (metrics) => set({ metrics }),
  setTimeRange: (range) => set({ timeRange: range }),
  generateReport: () => {
    // Placeholder for report generation logic
  },
})); 