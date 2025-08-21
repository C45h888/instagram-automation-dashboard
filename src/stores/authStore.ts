import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  username: string;
  email?: string;
  role?: 'user' | 'admin';
  avatarUrl?: string;
  permissions: string[];
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  permissions: string[];
  login: (user: User, token: string) => void;
  adminLogin: (user: User, token: string) => void;
  logout: () => void;
  refreshToken: (token: string) => void;
  updateUser: (user: Partial<User>) => void;
  checkAdminAccess: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isAdmin: false,
      permissions: [],
      
      login: (user, token) => set({ 
        user, 
        token, 
        isAuthenticated: true, 
        isAdmin: false,
        permissions: user.permissions 
      }),
      
      adminLogin: (user, token) => set({ 
        user: { ...user, role: 'admin' }, 
        token, 
        isAuthenticated: true, 
        isAdmin: true,
        permissions: user.permissions 
      }),
      
      logout: () => {
        // Clear all auth state
        set({ 
          user: null, 
          token: null, 
          isAuthenticated: false, 
          isAdmin: false,
          permissions: [] 
        });
        
        // Clear localStorage
        localStorage.removeItem('instagram-auth');
        
        // Redirect to login
        window.location.href = '/login';
      },
      
      refreshToken: (token) => set((state) => ({ ...state, token })),
      
      updateUser: (userData) => set((state) => ({ 
        user: state.user ? { ...state.user, ...userData } : null 
      })),
      
      checkAdminAccess: () => {
        const state = get();
        return state.isAuthenticated && state.isAdmin && state.user?.role === 'admin';
      },
    }),
    {
      name: 'instagram-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        isAdmin: state.isAdmin,
        permissions: state.permissions,
      }),
    }
  )
);