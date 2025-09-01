import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { supabase, logAuditEvent } from 'lib/supabase.ts';

interface User {
  id: string;
  username: string;
  email?: string;
  avatarUrl?: string;
  permissions: string[];
  role?: 'user' | 'admin' | 'super_admin';
  instagramConnected?: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  session: any | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  permissions: string[];
  
  // Legacy actions (keeping for compatibility)
  login: (user: User, token: string) => void;
  adminLogin: (user: User, token: string) => void;
  logout: () => void;
  refreshToken: (token: string) => void;
  updateUser: (user: Partial<User>) => void;
  checkAdminAccess: () => boolean;
  
  // Supabase actions
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInAsAdmin: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  checkSession: () => Promise<void>;
  createTestUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      session: null,
      isAuthenticated: false,
      isAdmin: false,
      isLoading: false,
      permissions: [],
      
      // Legacy methods (keeping for compatibility)
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
        get().signOut();
      },
      
      refreshToken: (token) => set((state) => ({ ...state, token })),
      
      updateUser: (user) => set((state) => ({ 
        user: { ...state.user, ...user } as User 
      })),
      
      checkAdminAccess: () => {
        const state = get();
        return state.isAuthenticated && state.isAdmin && 
               (state.user?.role === 'admin' || state.user?.role === 'super_admin');
      },
      
      // Supabase authentication methods
      signInWithEmail: async (email: string, password: string) => {
        set({ isLoading: true });
        
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
          });
          
          if (error) throw error;
          
          // Get user profile
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', data.user?.id)
            .single();
          
          if (profile) {
            const user: User = {
              id: data.user?.id || '',
              username: profile.username || email.split('@')[0],
              email: profile.email || email,
              avatarUrl: profile.avatar_url,
              permissions: ['dashboard', 'content', 'engagement', 'analytics', 'settings'],
              role: profile.user_role,
              instagramConnected: profile.instagram_connected
            };
            
            set({
              user,
              session: data.session,
              token: data.session?.access_token,
              isAuthenticated: true,
              isAdmin: profile.user_role === 'admin' || profile.user_role === 'super_admin',
              permissions: user.permissions,
              isLoading: false
            });
            
            // Log successful login
            await logAuditEvent('login', 'success', { email });
          }
        } catch (error: any) {
          console.error('Sign in error:', error);
          set({ isLoading: false });
          throw error;
        }
      },
      
      signInAsAdmin: async (email: string, password: string) => {
        set({ isLoading: true });
        
        try {
          // First try Supabase authentication
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
          });
          
          if (error) {
            // Fallback to hardcoded admin for development
            if (
              email === import.meta.env.VITE_ADMIN_EMAIL &&
              password === import.meta.env.VITE_ADMIN_PASSWORD
            ) {
              const mockAdmin: User = {
                id: 'admin-dev-001',
                username: 'admin',
                email: email,
                permissions: [
                  'dashboard', 'content', 'engagement', 'analytics', 
                  'settings', 'automations', 'admin', 'user-management'
                ],
                role: 'super_admin'
              };
              
              set({
                user: mockAdmin,
                token: 'dev-admin-token',
                isAuthenticated: true,
                isAdmin: true,
                permissions: mockAdmin.permissions,
                isLoading: false
              });
              
              console.log('📝 Development admin login');
              return;
            }
            
            throw error;
          }
          
          // Check if user is admin
          const { data: adminProfile } = await supabase
            .from('admin_users')
            .select('*')
            .eq('email', email)
            .single();
          
          if (!adminProfile || !adminProfile.is_active) {
            throw new Error('Unauthorized: Admin access required');
          }
          
          const user: User = {
            id: data.user?.id || '',
            username: adminProfile.full_name.toLowerCase().replace(' ', '_'),
            email: adminProfile.email,
            permissions: adminProfile.permissions || [],
            role: adminProfile.role
          };
          
          // Update last login
          await supabase
            .from('admin_users')
            .update({ 
              last_login_at: new Date().toISOString(),
              login_attempts: 0 
            })
            .eq('email', email);
          
          set({
            user,
            session: data.session,
            token: data.session?.access_token,
            isAuthenticated: true,
            isAdmin: true,
            permissions: user.permissions,
            isLoading: false
          });
          
          await logAuditEvent('admin_login', 'success', { email });
          
        } catch (error: any) {
          console.error('Admin sign in error:', error);
          set({ isLoading: false });
          
          // Log failed attempt
          await logAuditEvent('admin_login', 'failed', { 
            email, 
            error: error.message 
          });
          
          throw error;
        }
      },
      
      signOut: async () => {
        const userId = get().user?.id;
        
        try {
          await supabase.auth.signOut();
          
          if (userId && !userId.startsWith('admin-dev-')) {
            await logAuditEvent('logout', 'success', { userId });
          }
        } catch (error) {
          console.error('Sign out error:', error);
        }
        
        set({
          user: null,
          token: null,
          session: null,
          isAuthenticated: false,
          isAdmin: false,
          permissions: [],
          isLoading: false
        });
        
        // Clear localStorage
        localStorage.removeItem('instagram-auth');
        
        // Redirect to login
        window.location.href = '/login';
      },
      
      checkSession: async () => {
        set({ isLoading: true });
        
        try {
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session) {
            // Get user profile
            const { data: profile } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('user_id', session.user.id)
              .single();
            
            if (profile) {
              const user: User = {
                id: session.user.id,
                username: profile.username || session.user.email?.split('@')[0] || 'user',
                email: profile.email || session.user.email,
                avatarUrl: profile.avatar_url,
                permissions: ['dashboard', 'content', 'engagement', 'analytics', 'settings'],
                role: profile.user_role,
                instagramConnected: profile.instagram_connected
              };
              
              set({
                user,
                session,
                token: session.access_token,
                isAuthenticated: true,
                isAdmin: profile.user_role === 'admin' || profile.user_role === 'super_admin',
                permissions: user.permissions,
                isLoading: false
              });
              
              // Update last active
              await supabase
                .from('user_profiles')
                .update({ last_active_at: new Date().toISOString() })
                .eq('user_id', session.user.id);
            }
          } else {
            // Check for dev admin session
            const currentUser = get().user;
            if (currentUser?.id === 'admin-dev-001') {
              set({ isLoading: false });
              return;
            }
            
            set({ isLoading: false, isAuthenticated: false });
          }
        } catch (error) {
          console.error('Session check error:', error);
          set({ isLoading: false });
        }
      },
      
      createTestUser: async () => {
        try {
          const { data, error } = await supabase.auth.signUp({
            email: `test_${Date.now()}@888intelligence.com`,
            password: 'TestUser@2024!',
            options: {
              data: {
                username: `testuser_${Date.now()}`,
                full_name: 'Test User'
              }
            }
          });
          
          if (error) throw error;
          
          console.log('Test user created:', data.user?.email);
        } catch (error) {
          console.error('Create test user error:', error);
          throw error;
        }
      }
    }),
    {
      name: 'instagram-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        isAdmin: state.isAdmin,
        permissions: state.permissions
      })
    }
  )
);

// Listen to auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth state changed:', event);
  
  if (event === 'SIGNED_IN') {
    useAuthStore.getState().checkSession();
  } else if (event === 'SIGNED_OUT') {
    useAuthStore.setState({
      user: null,
      session: null,
      token: null,
      isAuthenticated: false,
      isAdmin: false,
      permissions: []
    });
  } else if (event === 'TOKEN_REFRESHED') {
    useAuthStore.setState({
      session,
      token: session?.access_token
    });
  }
});