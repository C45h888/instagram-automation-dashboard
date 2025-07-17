import { create } from 'zustand';

interface Post {
  id: string;
  content: string;
  scheduledAt: string;
}

interface ContentState {
  scheduledPosts: Post[];
  contentLibrary: Post[];
  templates: string[];
  schedulePost: (post: Post) => void;
  updateContent: (id: string, content: string) => void;
  deletePost: (id: string) => void;
}

export const useContentStore = create<ContentState>((set) => ({
  scheduledPosts: [],
  contentLibrary: [],
  templates: [],
  schedulePost: (post) => set((state) => ({ scheduledPosts: [...state.scheduledPosts, post] })),
  updateContent: (id, content) => set((state) => ({
    contentLibrary: state.contentLibrary.map((p) => (p.id === id ? { ...p, content } : p)),
  })),
  deletePost: (id) => set((state) => ({
    scheduledPosts: state.scheduledPosts.filter((p) => p.id !== id),
    contentLibrary: state.contentLibrary.filter((p) => p.id !== id),
  })),
})); 