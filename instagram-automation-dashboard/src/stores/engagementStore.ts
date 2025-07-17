import { create } from 'zustand';

interface Engagement {
  id: string;
  type: string;
  content: string;
  timestamp: string;
}

interface EngagementState {
  liveEngagements: Engagement[];
  responseTemplates: string[];
  metrics: Record<string, number>;
  addEngagement: (engagement: Engagement) => void;
  respondToComment: (id: string, response: string) => void;
  updateTemplate: (index: number, template: string) => void;
}

export const useEngagementStore = create<EngagementState>((set) => ({
  liveEngagements: [],
  responseTemplates: [],
  metrics: {},
  addEngagement: (engagement) => set((state) => ({ liveEngagements: [...state.liveEngagements, engagement] })),
  respondToComment: (id, response) => set((state) => ({
    liveEngagements: state.liveEngagements.map((e) =>
      e.id === id ? { ...e, response } : e
    ),
  })),
  updateTemplate: (index, template) => set((state) => {
    const updated = [...state.responseTemplates];
    updated[index] = template;
    return { responseTemplates: updated };
  }),
})); 