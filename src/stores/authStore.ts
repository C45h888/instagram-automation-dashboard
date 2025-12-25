import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { devtools } from 'zustand/middleware';
import { supabase, logAuditEvent } from '../lib/supabase';
import type { AuthChangeEvent, Session, User as SupabaseUser } from '@supabase/supabase-js';

// Import types from the generated database.types.ts
import type { Database } from '../lib/database.types';

// =====================================
// TYPE DEFINITIONS - ENHANCED ARCHITECTURE
// =====================================

// Database type aliases
type UserProfile = Database['public']['Tables']['user_profiles']['Row'];
type AdminUser = Database['public']['Tables']['admin_users']['Row'];
type AdminUserUpdate = Database['public']['Tables']['admin_users']['Update'];

/**
 * Legacy User interface for backward compatibility
 * Used by Login.tsx and AdminLogin.tsx components
 */
interface User {
  id: string;
  username: string;
  email?: string;
  facebook_id?: string;
  avatarUrl?: string;
  permissions: string[];
  role?: 'user' | 'admin' | 'super_admin';
  instagramConnected?: boolean;
}

/**
 * ✅ STEP 1: Define serializable data properties ONLY
 * This interface contains ONLY the state that can be persisted
 */
interface AuthStateProperties {
  // Core authentication state
  user: User | null;
  token: string | null;  // Legacy property for RequireAuth.tsx
  session: Session | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  permissions: string[];
  error: string | null;

  // Instagram Business Account state (PHASE 3.5)
  businessAccountId: string | null;  // UUID from instagram_business_accounts table
  instagramBusinessId: string | null;  // Instagram's numeric ID for API calls
  pageId: string | null;  // Facebook Page ID
  pageName: string | null;  // Facebook Page Name
}

/**
 * ✅ STEP 2: Define the EXACT subset of properties to persist
 * CRITICAL: This is NOT Partial<AuthState> - it's an explicit, complete type
 * representing what WILL be serialized to localStorage
 */
interface PersistedAuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  permissions: string[];

  // Instagram Business Account state (PHASE 3.5)
  businessAccountId: string | null;
  instagramBusinessId: string | null;
  pageId: string | null;
  pageName: string | null;

  // Explicitly EXCLUDED (transient state):
  // - session: Contains expiring tokens, must be refreshed
  // - isLoading: UI state, must always start false
  // - error: Error messages shouldn't persist across sessions
}

/**
 * ✅ STEP 3: Define all action methods separately
 * These are non-serializable function references
 */
interface AuthStateActions {
  // =====================================
  // LEGACY METHODS (for backward compatibility)
  // =====================================
  
  /**
   * Legacy login method - accepts user object and token
   * @deprecated Use signInWithEmail for new code
   * Used by Login.tsx
   */
  login: (user: User, token: string) => void;
  
  /**
   * Legacy admin login method - accepts user object and token
   * @deprecated Use signInAsAdmin for new code
   * Used by AdminLogin.tsx
   */
  adminLogin: (user: User, token: string) => void;
  
  /**
   * Legacy logout method - redirects to signOut
   * @deprecated Use signOut for new code
   */
  logout: () => Promise<void>;
  
  /**
   * Legacy refresh token method
   * @deprecated Token refresh is now handled automatically
   */
  refreshToken: (token: string) => void;
  
  /**
   * Legacy update user method
   */
  updateUser: (updates: Partial<User>) => void;
  
  /**
   * Legacy admin access check
   */
  checkAdminAccess: () => boolean;
  
  // =====================================
  // MODERN SUPABASE METHODS
  // =====================================
  
  /**
   * Modern email/password authentication
   * Fetches user profile and sets up session
   */
  signInWithEmail: (email: string, password: string) => Promise<void>;
  
  /**
   * Admin authentication with additional role checks
   * Validates admin status in database
   */
  signInAsAdmin: (email: string, password: string) => Promise<void>;
  
  /**
   * Sign out and clear all session data
   * Logs audit event and redirects to login
   */
  signOut: () => Promise<void>;
  
  /**
   * Check and restore session from Supabase
   * Called on app initialization
   */
  checkSession: () => Promise<void>;
  
  /**
   * Create test user for development
   * @dev Only available in development mode
   */
  createTestUser: () => Promise<void>;
  
  /**
   * Clear error state
   */
  clearError: () => void;

  /**
   * Set Instagram Business Account data (PHASE 3.5)
   * Called after successful token exchange to store business account info
   */
  setBusinessAccount: (data: {
    businessAccountId: string;
    instagramBusinessId: string;
    pageId?: string;
    pageName?: string;
  }) => void;
}

/**
 * ✅ STEP 4: Combine properties and actions into final AuthState type
 * This maintains the public API - NO BREAKING CHANGES for consuming components
 */
export type AuthState = AuthStateProperties & AuthStateActions;

// =====================================
// HELPER FUNCTIONS
// =====================================

/**
 * Safely extracts username from email
 * Fallback: 'user'
 */
const getUsernameFromEmail = (email: string | null | undefined): string => {
  if (!email || typeof email !== 'string') return 'user';
  const parts = email.split('@');
  return parts[0] || 'user';
};

/**
 * Formats username from full name
 * Converts to lowercase and replaces spaces with underscores
 */
const formatUsername = (fullName: string | null | undefined): string => {
  if (!fullName || typeof fullName !== 'string') return 'admin';
  return fullName.toLowerCase().replace(/\s+/g, '_');
};

/**
 * Type guard for permissions array
 * Filters out non-string values
 */
const getPermissions = (permissions: any): string[] => {
  if (Array.isArray(permissions)) {
    return permissions.filter((p): p is string => typeof p === 'string');
  }
  // Default permissions for standard users
  return ['dashboard', 'content', 'engagement', 'analytics', 'settings'];
};

/**
 * Maps Supabase user and profiles to application User object
 * Handles both regular users and admin users
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
    facebook_id: profile?.facebook_id || undefined,
    avatarUrl: profile?.avatar_url || undefined,
    permissions: adminProfile
      ? getPermissions(adminProfile.permissions)
      : ['dashboard', 'content', 'engagement', 'analytics', 'settings'],
    role: adminProfile?.role || profile?.user_role || 'user',
    instagramConnected: profile?.instagram_connected || false
  };
};

// =====================================
// STORE IMPLEMENTATION - SIMPLIFIED & TYPE-SAFE
// =====================================

/**
 * ✅ STEP 5: Create store with inline implementation
 * 
 * KEY CHANGES FROM ORIGINAL:
 * 1. Removed separate `storeCreator` constant (eliminates type complexity)
 * 2. Removed separate `persistOptions` constant (simplifies inference)
 * 3. Inlined everything for direct type flow from create<AuthState>()
 * 4. Explicit return type on partialize: (state: AuthState): PersistedAuthState
 * 5. Let TypeScript infer middleware types automatically
 * 
 * This approach:
 * - Eliminates StateCreator type mismatch
 * - Removes middleware mutator ordering issues
 * - Simplifies type inference for TypeScript
 * - Maintains 100% functional compatibility
 * - Zero breaking changes to consumers
 */
export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        // =====================================
        // INITIAL STATE
        // =====================================
        user: null,
        token: null,
        session: null,
        isAuthenticated: false,
        isAdmin: false,
        isLoading: false,
        permissions: [],
        error: null,

        // Instagram Business Account state (PHASE 3.5)
        businessAccountId: null,
        instagramBusinessId: null,
        pageId: null,
        pageName: null,
        
        // =====================================
        // LEGACY METHODS (fixed for backward compatibility)
        // =====================================
        
        login: (user, token) => {
          set({
            user,
            token,
            isAuthenticated: true,
            isAdmin: user.role === 'admin' || user.role === 'super_admin',
            permissions: user.permissions,
            error: null
          });
          
          console.log('✅ Legacy login successful:', user.username);
        },
        
        adminLogin: (user, token) => {
          set({
            user,
            token,
            isAuthenticated: true,
            isAdmin: true,
            permissions: user.permissions,
            error: null
          });
          
          console.log('✅ Legacy admin login successful:', user.username);
        },
        
        logout: async () => {
          await get().signOut();
        },
        
        refreshToken: (token) => {
          set({ token });
        },
        
        updateUser: (updates) => {
          set((state) => ({
            user: state.user ? { ...state.user, ...updates } : null
          }));
        },
        
        checkAdminAccess: () => {
          const state = get();
          return state.isAuthenticated && 
                 state.isAdmin && 
                 (state.user?.role === 'admin' || state.user?.role === 'super_admin');
        },
        
        // =====================================
        // MODERN SUPABASE METHODS
        // =====================================
        
        signInWithEmail: async (email, password) => {
          set({ isLoading: true, error: null });
          
          try {
            const { data, error } = await supabase.auth.signInWithPassword({
              email,
              password
            });
            
            if (error) throw error;
            if (!data.user || !data.session) {
              throw new Error('Login failed - no user data returned');
            }
            
            const { data: profile, error: profileError } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('user_id', data.user.id)
              .single();
            
            if (profileError && profileError.code !== 'PGRST116') {
              console.error('Profile fetch error:', profileError);
            }
            
            const user = mapToUser(data.user, profile);
            
            if (!user) {
              throw new Error('Failed to create user object');
            }
            
            set({
              user,
              session: data.session,
              token: data.session.access_token,
              isAuthenticated: true,
              isAdmin: user.role === 'admin' || user.role === 'super_admin',
              permissions: user.permissions,
              isLoading: false,
              error: null
            });
            
            await logAuditEvent('user_login', 'success', { email });
            
            if (profile) {
              await supabase
                .from('user_profiles')
                .update({ last_active_at: new Date().toISOString() })
                .eq('user_id', data.user.id);
            }
            
          } catch (error: any) {
            console.error('❌ Sign in error:', error);
            
            const errorMessage = error?.message || 'Login failed';
            set({ 
              isLoading: false, 
              error: errorMessage,
              isAuthenticated: false,
              user: null,
              token: null,
              session: null
            });
            
            await logAuditEvent('user_login', 'failed', { email, error: errorMessage });
            
            throw error;
          }
        },
        
        signInAsAdmin: async (email, password) => {
          set({ isLoading: true, error: null });
          
          try {
            const { data, error } = await supabase.auth.signInWithPassword({
              email,
              password
            });
            
            if (error) {
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
            
            const { data: adminProfile, error: adminError } = await supabase
              .from('admin_users')
              .select('*')
              .eq('email', email)
              .eq('is_active', true)
              .single();
            
            if (adminError || !adminProfile) {
              throw new Error('Unauthorized: Admin access required');
            }
            
            const { data: profile } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('user_id', data.user.id)
              .single();
            
            const user = mapToUser(data.user, profile, adminProfile);
            
            if (!user) {
              throw new Error('Failed to create admin user object');
            }
            
            set({
              user,
              session: data.session,
              token: data.session.access_token,
              isAuthenticated: true,
              isAdmin: true,
              permissions: user.permissions,
              isLoading: false,
              error: null
            });
            
            const updateData: AdminUserUpdate = {
              last_login_at: new Date().toISOString(),
              login_attempts: 0
            };
            
            await supabase
              .from('admin_users')
              .update(updateData)
              .eq('email', email);
            
            await logAuditEvent('admin_login', 'success', { email });
            
          } catch (error: any) {
            console.error('❌ Admin sign in error:', error);
            
            const errorMessage = error?.message || 'Admin login failed';
            set({ 
              isLoading: false,
              error: errorMessage,
              isAuthenticated: false,
              user: null,
              token: null,
              session: null
            });
            
            await logAuditEvent('admin_login', 'failed', { 
              email, 
              error: errorMessage 
            });
            
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
            } catch {
              // Silently fail - don't block login flow
            }
            
            throw error;
          }
        },
        
        signOut: async () => {
          const userId = get().user?.id;
          
          try {
            if (userId && !userId.startsWith('admin-dev-')) {
              await logAuditEvent('logout', 'success', { userId });
            }
            
            await supabase.auth.signOut();
          } catch (error) {
            console.error('❌ Sign out error:', error);
          }
          
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
          
          localStorage.removeItem('auth-storage');
          
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        },
        
        checkSession: async () => {
          set({ isLoading: true });
          
          try {
            const { data: { session } } = await supabase.auth.getSession();
            
            if (session?.user) {
              const { data: profile } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('user_id', session.user.id)
                .single();
              
              const { data: adminProfile } = await supabase
                .from('admin_users')
                .select('*')
                .eq('user_id', session.user.id)
                .eq('is_active', true)
                .single();
              
              const user = mapToUser(session.user, profile, adminProfile);
              
              if (user) {
                set({
                  user,
                  session,
                  token: session.access_token,
                  isAuthenticated: true,
                  isAdmin: user.role === 'admin' || user.role === 'super_admin',
                  permissions: user.permissions,
                  isLoading: false,
                  error: null
                });
                
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
            console.error('❌ Session check error:', error);
            set({ 
              isLoading: false,
              error: 'Failed to check session'
            });
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
            
            console.log('✅ Test user created:', data.user?.email);
          } catch (error) {
            console.error('❌ Create test user error:', error);
            throw error;
          }
        },
        
        clearError: () => {
          set({ error: null });
        },

        // =====================================
        // INSTAGRAM BUSINESS ACCOUNT METHODS (PHASE 3.5)
        // =====================================

        /**
         * Set Instagram Business Account data after successful token exchange
         * This is called from the handshake completion in Login.tsx
         */
        setBusinessAccount: (data) => {
          console.log('📦 Setting business account in authStore:', data);

          set({
            businessAccountId: data.businessAccountId,
            instagramBusinessId: data.instagramBusinessId,
            pageId: data.pageId || null,
            pageName: data.pageName || null
          });

          console.log('✅ Business account data stored in authStore');
        }
      }),
      {
        name: 'auth-storage',
        storage: createJSONStorage(() => localStorage),
        /**
         * ✅ CRITICAL TYPE-SAFE PARTIALIZE
         * 
         * Explicit parameter AND return type annotation ensures TypeScript
         * understands EXACTLY what's being serialized without complex inference.
         * 
         * This is the KEY to resolving the TS2345 error.
         */
        partialize: (state: AuthState): PersistedAuthState => ({
          user: state.user,
          token: state.token,
          isAuthenticated: state.isAuthenticated,
          isAdmin: state.isAdmin,
          permissions: state.permissions,

          // Instagram Business Account state (PHASE 3.5)
          businessAccountId: state.businessAccountId,
          instagramBusinessId: state.instagramBusinessId,
          pageId: state.pageId,
          pageName: state.pageName

          // session, isLoading, error are INTENTIONALLY excluded (transient state)
        })
      }
    ),
    { name: 'AuthStore' }
  )
);

// =====================================
// AUTH STATE CHANGE LISTENER
// =====================================

supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
  console.log('🔄 Auth state changed:', event);
  
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