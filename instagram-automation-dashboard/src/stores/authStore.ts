import { create } from 'zustand';

interface User {
  id: string;
  username: string;
  avatarUrl?: string;
  permissions: string[];
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  permissions: string[];
  login: (user: User, token: string) => void;
  logout: () => void;
  refreshToken: (token: string) => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  permissions: [],
  login: (user, token) => set({ user, token, isAuthenticated: true, permissions: user.permissions }),
  logout: () => set({ user: null, token: null, isAuthenticated: false, permissions: [] }),
  refreshToken: (token) => set((state) => ({ ...state, token })),
  updateUser: (user) => set((state) => ({ user: { ...state.user, ...user } as User })),
})); 