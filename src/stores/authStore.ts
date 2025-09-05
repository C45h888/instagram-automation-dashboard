import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { devtools } from 'zustand/middleware';
import { supabase, logAuditEvent } from '../lib/supabase';
import type { AuthChangeEvent, Session, User as SupabaseUser } from '@supabase/supabase-js';

// Import types from the generated database.types.ts
import type { Database } from '../lib/database.types';

// =====================================
// TYPE DEFINITIONS
// =====================================

// Database type aliases
type UserProfile = Database['public']['Tables']['user_profiles']['Row'];
type AdminUser = Database['public']['Tables']['admin_users']['Row'];
type AdminUserUpdate = Database['public']['Tables']['admin_users']['Update'];

// Legacy User interface for backward compatibility
interface User {
  id: string;
  username: string;
  email?: string;
  avatarUrl?: string;
  permissions: string[];
  role?: 'user' | 'admin' | 'super_admin';
  instagramConnected?: boolean;
}

// Complete AuthState interface with ALL legacy properties
interface AuthState {
  // Core state
  user: User | null;
  token: string | null;  // ✅ Legacy property for RequireAuth.tsx
  session: Session | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  permissions: string[];
  error: string | null;
  
  // ✅ FIXED Legacy actions - now with correct signatures
  login: (user: User, token: string) => void;  // Legacy signature for Login.tsx
  adminLogin: (user: User, token: string) => void;  // Legacy signature for AdminLogin.tsx
  logout: () => Promise<void>;
  refreshToken: (token: string) => void;
  updateUser: (user: Partial<User>) => void;
  checkAdminAccess: () => boolean;
  
  // Modern Supabase actions
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInAsAdmin: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  checkSession: () => Promise<void>;
  createTestUser: () => Promise<void>;
  clearError: () => void;
}

// =====================================
// HELPER FUNCTIONS
// =====================================

/**
 * Safely extracts username from email
 */
const getUsernameFromEmail = (email: string | null | undefined): string => {
  if (!email || typeof email !== 'string') return 'user';
  const parts = email.split('@');
  return parts[0] || 'user';
};

/**
 * Formats username from full name
 */
const formatUsername = (fullName: string | null | undefined): string => {
  if (!fullName || typeof fullName !== 'string') return 'admin';
  return fullName.toLowerCase().replace(/\s+/g, '_');
};

/**
 * Gets permissions array from JSON
 */
const getPermissions = (permissions: any): string[] => {
  if (Array.isArray(permissions)) {
    return permissions.filter((p): p is string => typeof p === 'string');
  }
  return ['dashboard', 'content', 'engagement', 'analytics', 'settings'];
};

/**
 * Maps database user to app user
 */
const mapToUser = (
  supabaseUser: SupabaseUser | null,
  profile: UserProfile | null,
  adminProfile?: AdminUser | null
): User | null => {
  if (!supabaseUser) return null;
  
  const email = profile?.email || supabaseUser.email || undefined;
  const username = profile?.username || 
                  (adminProfile?.full_name ? formatUsername(adminProfile.full_name) : null) ||
                  getUsernameFromEmail(email);
  
  return {
    id: supabaseUser.id,
    username,
    email,
    avatarUrl: profile?.avatar_url || undefined,
    permissions: adminProfile 
      ? getPermissions(adminProfile.permissions)
      : ['dashboard', 'content', 'engagement', 'analytics', 'settings'],
    role: adminProfile?.role || profile?.user_role || 'user',
    instagramConnected: profile?.instagram_connected || false
  };
};

// =====================================
// AUTH STORE IMPLEMENTATION
// =====================================

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        user: null,
        token: null,
        session: null,
        isAuthenticated: false,
        isAdmin: false,
        isLoading: false,
        permissions: [],
        error: null,
        
        // =====================================
        // LEGACY METHODS (fixed for backward compatibility)
        // =====================================
        
        /**
         * Legacy login method - accepts user object and token
         * Used by Login.tsx
         */
        login: (user: User, token: string) => {
          // Direct state update for legacy compatibility
          set({
            user,
            token,
            isAuthenticated: true,
            isAdmin: user.role === 'admin' || user.role === 'super_admin',
            permissions: user.permissions,
            error: null
          });
          
          console.log('Legacy login successful:', user.username);
        },
        
        /**
         * Legacy admin login method - accepts user object and token
         * Used by AdminLogin.tsx
         */
        adminLogin: (user: User, token: string) => {
          // Direct state update for legacy compatibility
          set({
            user,
            token,
            isAuthenticated: true,
            isAdmin: true,
            permissions: user.permissions,
            error: null
          });
          
          console.log('Legacy admin login successful:', user.username);
        },
        
        /**
         * Legacy logout method - redirects to signOut
         */
        logout: async () => {
          await get().signOut();
        },
        
        /**
         * Legacy refresh token method
         */
        refreshToken: (token: string) => {
          set({ token });
        },
        
        /**
         * Legacy update user method
         */
        updateUser: (updates: Partial<User>) => {
          set((state) => ({
            user: state.user ? { ...state.user, ...updates } : null
          }));
        },
        
        /**
         * Legacy admin access check
         */
        checkAdminAccess: () => {
          const state = get();
          return state.isAuthenticated && 
                 state.isAdmin && 
                 (state.user?.role === 'admin' || state.user?.role === 'super_admin');
        },
        
        // =====================================
        // MODERN SUPABASE METHODS
        // =====================================
        
        /**
         * Sign in with email and password
         */
        signInWithEmail: async (email: string, password: string) => {
          set({ isLoading: true, error: null });
          
          try {
            // Authenticate with Supabase
            const { data, error } = await supabase.auth.signInWithPassword({
              email,
              password
            });
            
            if (error) throw error;
            if (!data.user || !data.session) {
              throw new Error('Login failed - no user data returned');
            }
            
            // Get user profile
            const { data: profile, error: profileError } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('user_id', data.user.id)
              .single();
            
            // Handle profile not found gracefully
            if (profileError && profileError.code !== 'PGRST116') {
              console.error('Profile fetch error:', profileError);
            }
            
            // Map to user object
            const user = mapToUser(data.user, profile);
            
            if (!user) {
              throw new Error('Failed to create user object');
            }
            
            // Update state with all necessary properties
            set({
              user,
              session: data.session,
              token: data.session.access_token,  // ✅ Set token for legacy components
              isAuthenticated: true,
              isAdmin: user.role === 'admin' || user.role === 'super_admin',
              permissions: user.permissions,
              isLoading: false,
              error: null
            });
            
            // Log successful login
            await logAuditEvent('user_login', 'success', { email });
            
            // Update last active if profile exists
            if (profile) {
              await supabase
                .from('user_profiles')
                .update({ last_active_at: new Date().toISOString() })
                .eq('user_id', data.user.id);
            }
            
          } catch (error: any) {
            console.error('Sign in error:', error);
            
            const errorMessage = error?.message || 'Login failed';
            set({ 
              isLoading: false, 
              error: errorMessage,
              isAuthenticated: false,
              user: null,
              token: null,
              session: null
            });
            
            // Log failed login
            await logAuditEvent('user_login', 'failed', { email, error: errorMessage });
            
            throw error;
          }
        },
        
        /**
         * Sign in as admin
         */
        signInAsAdmin: async (email: string, password: string) => {
          set({ isLoading: true, error: null });
          
          try {
            // First authenticate with Supabase
            const { data, error } = await supabase.auth.signInWithPassword({
              email,
              password
            });
            
            if (error) {
              // Check for development admin credentials as fallback
              if (email === import.meta.env.VITE_ADMIN_EMAIL &&
                  password === import.meta.env.VITE_ADMIN_PASSWORD) {
                
                const mockAdmin: User = {
                  id: 'admin-dev-001',
                  username: 'admin',
                  email: email,
                  permissions: [
                    'dashboard', 'content', 'engagement', 'analytics',
                    'settings', 'automations', 'admin', 'user-management',
                    'system-config'
                  ],
                  role: 'super_admin'
                };
                
                set({
                  user: mockAdmin,
                  token: 'dev-admin-token',
                  session: null,
                  isAuthenticated: true,
                  isAdmin: true,
                  permissions: mockAdmin.permissions,
                  isLoading: false,
                  error: null
                });
                
                console.log('📝 Development admin login');
                return;
              }
              
              throw error;
            }
            
            if (!data.user || !data.session) {
              throw new Error('Admin login failed - no user data returned');
            }
            
            // Check admin status
            const { data: adminProfile, error: adminError } = await supabase
              .from('admin_users')
              .select('*')
              .eq('email', email)
              .eq('is_active', true)
              .single();
            
            if (adminError || !adminProfile) {
              throw new Error('Unauthorized: Admin access required');
            }
            
            // Get user profile for additional data
            const { data: profile } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('user_id', data.user.id)
              .single();
            
            // Map to user object with admin data
            const user = mapToUser(data.user, profile, adminProfile);
            
            if (!user) {
              throw new Error('Failed to create admin user object');
            }
            
            // Update state
            set({
              user,
              session: data.session,
              token: data.session.access_token,  // ✅ Set token
              isAuthenticated: true,
              isAdmin: true,
              permissions: user.permissions,
              isLoading: false,
              error: null
            });
            
            // Update admin last login
            const updateData: AdminUserUpdate = {
              last_login_at: new Date().toISOString(),
              login_attempts: 0
            };
            
            await supabase
              .from('admin_users')
              .update(updateData)
              .eq('email', email);
            
            // Log successful admin login
            await logAuditEvent('admin_login', 'success', { email });
            
          } catch (error: any) {
            console.error('Admin sign in error:', error);
            
            const errorMessage = error?.message || 'Admin login failed';
            set({ 
              isLoading: false,
              error: errorMessage,
              isAuthenticated: false,
              user: null,
              token: null,
              session: null
            });
            
            // Log failed admin login
            await logAuditEvent('admin_login', 'failed', { 
              email, 
              error: errorMessage 
            });
            
            // Update failed login attempts
            try {
              const { data: admin } = await supabase
                .from('admin_users')
                .select('login_attempts')
                .eq('email', email)
                .single();
              
              if (admin) {
                await supabase
                  .from('admin_users')
                  .update({ 
                    login_attempts: (admin.login_attempts || 0) + 1 
                  })
                  .eq('email', email);
              }
            } catch {}
            
            throw error;
          }
        },
        
        /**
         * Sign out
         */
        signOut: async () => {
          const userId = get().user?.id;
          
          try {
            // Log signout before clearing session
            if (userId && !userId.startsWith('admin-dev-')) {
              await logAuditEvent('logout', 'success', { userId });
            }
            
            await supabase.auth.signOut();
          } catch (error) {
            console.error('Sign out error:', error);
          }
          
          // Clear all state
          set({
            user: null,
            token: null,
            session: null,
            isAuthenticated: false,
            isAdmin: false,
            permissions: [],
            isLoading: false,
            error: null
          });
          
          // Clear localStorage
          localStorage.removeItem('auth-storage');
          
          // Redirect to login
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        },
        
        /**
         * Check current session
         */
        checkSession: async () => {
          set({ isLoading: true });
          
          try {
            const { data: { session } } = await supabase.auth.getSession();
            
            if (session?.user) {
              // Get user profile
              const { data: profile } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('user_id', session.user.id)
                .single();
              
              // Check if admin
              const { data: adminProfile } = await supabase
                .from('admin_users')
                .select('*')
                .eq('user_id', session.user.id)
                .eq('is_active', true)
                .single();
              
              // Map to user object
              const user = mapToUser(session.user, profile, adminProfile);
              
              if (user) {
                set({
                  user,
                  session,
                  token: session.access_token,  // ✅ Set token
                  isAuthenticated: true,
                  isAdmin: user.role === 'admin' || user.role === 'super_admin',
                  permissions: user.permissions,
                  isLoading: false,
                  error: null
                });
                
                // Update last active
                if (profile) {
                  await supabase
                    .from('user_profiles')
                    .update({ last_active_at: new Date().toISOString() })
                    .eq('user_id', session.user.id);
                }
              } else {
                set({ 
                  isLoading: false, 
                  isAuthenticated: false,
                  user: null,
                  token: null,
                  session: null 
                });
              }
            } else {
              // Check for dev admin session
              const currentUser = get().user;
              if (currentUser?.id === 'admin-dev-001') {
                set({ isLoading: false });
                return;
              }
              
              set({ 
                isLoading: false, 
                isAuthenticated: false,
                user: null,
                token: null,
                session: null
              });
            }
          } catch (error) {
            console.error('Session check error:', error);
            set({ 
              isLoading: false,
              error: 'Failed to check session'
            });
          }
        },
        
        /**
         * Create test user for development
         */
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
        },
        
        /**
         * Clear error state
         */
        clearError: () => {
          set({ error: null });
        }
      }),
      {
        name: 'auth-storage',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          user: state.user,
          token: state.token,
          isAuthenticated: state.isAuthenticated,
          isAdmin: state.isAdmin,
          permissions: state.permissions
        })
      }
    ),
    {
      name: 'AuthStore'
    }
  )
);

// =====================================
// AUTH STATE CHANGE LISTENER
// =====================================

// Set up Supabase auth state change listener
supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
  console.log('Auth state changed:', event);
  
  const store = useAuthStore.getState();
  
  switch (event) {
    case 'SIGNED_IN':
      if (session) {
        store.checkSession();
      }
      break;
      
    case 'SIGNED_OUT':
      useAuthStore.setState({
        user: null,
        session: null,
        token: null,
        isAuthenticated: false,
        isAdmin: false,
        permissions: []
      });
      break;
      
    case 'TOKEN_REFRESHED':
      if (session) {
        useAuthStore.setState({
          session,
          token: session.access_token
        });
      }
      break;
      
    case 'USER_UPDATED':
      store.checkSession();
      break;
  }
});

// =====================================
// EXPORT HOOKS FOR CONVENIENCE
// =====================================

/**
 * Hook to check if user is authenticated
 */
export const useIsAuthenticated = () => {
  const { isAuthenticated, isLoading } = useAuthStore();
  return { isAuthenticated, isLoading };
};

/**
 * Hook to check if user is admin
 */
export const useIsAdmin = () => {
  const { isAdmin, isLoading } = useAuthStore();
  return { isAdmin, isLoading };
};

/**
 * Hook to get current user
 */
export const useCurrentUser = () => {
  const { user, isLoading } = useAuthStore();
  return { user, isLoading };
};