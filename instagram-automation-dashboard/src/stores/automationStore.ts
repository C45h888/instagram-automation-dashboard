import { create } from 'zustand';

interface Workflow {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'error';
  lastRun: string;
  errors?: string[];
}

interface AutomationState {
  workflows: Workflow[];
  status: string;
  lastRun: string | null;
  errors: string[];
  toggleWorkflow: (id: string) => void;
  updateStatus: (status: string) => void;
  clearErrors: () => void;
}

export const useAutomationStore = create<AutomationState>((set, get) => ({
  workflows: [],
  status: '',
  lastRun: null,
  errors: [],
  toggleWorkflow: (id) => set((state) => ({
    workflows: state.workflows.map((w) =>
      w.id === id ? { ...w, status: w.status === 'active' ? 'inactive' : 'active' } : w
    ),
  })),
  updateStatus: (status) => set({ status }),
  clearErrors: () => set({ errors: [] }),
})); 