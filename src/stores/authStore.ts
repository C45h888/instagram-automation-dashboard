import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { devtools } from 'zustand/middleware';
import { supabase, logAuditEvent } from '../lib/supabase';
import type { AuthChangeEvent, Session, User as SupabaseUser } from '@supabase/supabase-js';
import type { Database } from '../lib/database.types';

// =====================================
// TYPE DEFINITIONS
// =====================================

// Database type aliases for cleaner code
type UserProfile = Database['public']['Tables']['user_profiles']['Row'];
type UserProfileUpdate = Database['public']['Tables']['user_profiles']['Update'];
type AdminUser = Database['public']['Tables']['admin_users']['Row'];
type UserRole = Database['public']['Enums']['user_role'];
type UserStatus = Database['public']['Enums']['user_status'];
type SubscriptionPlan = Database['public']['Enums']['subscription_plan'];

// Application user interface
interface AppUser {
  id: string;
  email: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  status: UserStatus;
  subscription_plan: SubscriptionPlan;
  instagram_connected: boolean;
  instagram_username: string | null;
  business_name: string | null;
  permissions: Permission[];
  metadata: UserMetadata;
}

// Permission system
type Permission = 
  | 'dashboard.view'
  | 'dashboard.edit'
  | 'content.view'
  | 'content.create'
  | 'content.edit'
  | 'content.delete'
  | 'engagement.view'
  | 'engagement.manage'
  | 'analytics.view'
  | 'analytics.export'
  | 'settings.view'
  | 'settings.edit'
  | 'automations.view'
  | 'automations.create'
  | 'automations.edit'
  | 'automations.delete'
  | 'admin.access'
  | 'admin.users.view'
  | 'admin.users.manage'
  | 'admin.system.view'
  | 'admin.system.manage';

interface UserMetadata {
  last_active_at: string;
  login_count: number;
  created_at: string;
  updated_at: string;
  timezone: string;
  language: string;
  theme: 'light' | 'dark' | 'system';
}

// Auth state interface
interface AuthState {
  // Core state
  user: AppUser | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  
  // Role & permission checks
  isAdmin: boolean;
  isSuperAdmin: boolean;
  permissions: Permission[];
  
  // Error handling
  error: AuthError | null;
  
  // Actions - Authentication
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signInAsAdmin: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string, metadata?: SignUpMetadata) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  
  // Actions - Session management
  refreshSession: () => Promise<void>;
  checkSession: () => Promise<void>;
  clearSession: () => void;
  
  // Actions - User management
  updateProfile: (updates: Partial<UserProfileUpdate>) => Promise<UpdateResult>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<AuthResult>;
  resetPassword: (email: string) => Promise<AuthResult>;
  
  // Actions - Permission checks
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
  canAccessRoute: (route: string) => boolean;
  
  // Actions - Utility
  initialize: () => Promise<void>;
  clearError: () => void;
}

// Result types
interface AuthResult {
  success: boolean;
  error?: string;
  data?: any;
}

interface UpdateResult {
  success: boolean;
  error?: string;
  user?: AppUser;
}

interface AuthError {
  code: string;
  message: string;
  details?: any;
}

interface SignUpMetadata {
  username?: string;
  full_name?: string;
  business_name?: string;
  timezone?: string;
}

// =====================================
// PERMISSION MAPPINGS
// =====================================

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  user: [
    'dashboard.view',
    'content.view',
    'content.create',
    'content.edit',
    'engagement.view',
    'analytics.view',
    'settings.view',
    'settings.edit',
    'automations.view',
    'automations.create'
  ],
  admin: [
    // All user permissions
    'dashboard.view',
    'dashboard.edit',
    'content.view',
    'content.create',
    'content.edit',
    'content.delete',
    'engagement.view',
    'engagement.manage',
    'analytics.view',
    'analytics.export',
    'settings.view',
    'settings.edit',
    'automations.view',
    'automations.create',
    'automations.edit',
    'automations.delete',
    // Admin-specific
    'admin.access',
    'admin.users.view',
    'admin.system.view'
  ],
  super_admin: [
    // All permissions
    'dashboard.view',
    'dashboard.edit',
    'content.view',
    'content.create',
    'content.edit',
    'content.delete',
    'engagement.view',
    'engagement.manage',
    'analytics.view',
    'analytics.export',
    'settings.view',
    'settings.edit',
    'automations.view',
    'automations.create',
    'automations.edit',
    'automations.delete',
    'admin.access',
    'admin.users.view',
    'admin.users.manage',
    'admin.system.view',
    'admin.system.manage'
  ]
};

// Route permission mappings
const ROUTE_PERMISSIONS: Record<string, Permission[]> = {
  '/dashboard': ['dashboard.view'],
  '/content': ['content.view'],
  '/content/create': ['content.create'],
  '/engagement': ['engagement.view'],
  '/analytics': ['analytics.view'],
  '/settings': ['settings.view'],
  '/automations': ['automations.view'],
  '/admin': ['admin.access'],
  '/admin/users': ['admin.users.view'],
  '/admin/system': ['admin.system.view']
};

// =====================================
// HELPER FUNCTIONS
// =====================================

/**
 * Maps Supabase user and profile to application user
 */
function mapToAppUser(
  supabaseUser: SupabaseUser,
  profile: UserProfile | null,
  adminProfile?: AdminUser | null
): AppUser {
  const role = adminProfile?.role || profile?.user_role || 'user';
  const permissions = ROLE_PERMISSIONS[role] || [];
  
  return {
    id: supabaseUser.id,
    email: supabaseUser.email || profile?.email || '',
    username: profile?.username || supabaseUser.email?.split('@')[0] || 'user',
    full_name: profile?.full_name || adminProfile?.full_name || null,
    avatar_url: profile?.avatar_url || null,
    role: role,
    status: profile?.status || 'active',
    subscription_plan: profile?.subscription_plan || 'free',
    instagram_connected: profile?.instagram_connected || false,
    instagram_username: profile?.instagram_username || null,
    business_name: profile?.business_name || null,
    permissions: permissions,
    metadata: {
      last_active_at: profile?.last_active_at || new Date().toISOString(),
      login_count: 0,
      created_at: profile?.created_at || new Date().toISOString(),
      updated_at: profile?.updated_at || new Date().toISOString(),
      timezone: profile?.timezone || 'UTC',
      language: 'en',
      theme: (profile?.ui_preferences as any)?.theme || 'system'
    }
  };
}

/**
 * Creates an error object from various error types
 */
function createAuthError(error: any): AuthError {
  if (error?.code && error?.message) {
    return error;
  }
  
  return {
    code: 'UNKNOWN_ERROR',
    message: error?.message || error?.toString() || 'An unknown error occurred',
    details: error
  };
}

// =====================================
// AUTH STORE
// =====================================

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: false,
        isInitialized: false,
        isAdmin: false,
        isSuperAdmin: false,
        permissions: [],
        error: null,
        
        // Sign in with email/password
        signIn: async (email: string, password: string): Promise<AuthResult> => {
          set({ isLoading: true, error: null });
          
          try {
            // Authenticate with Supabase
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
              email,
              password
            });
            
            if (authError) throw authError;
            if (!authData.user) throw new Error('No user returned from authentication');
            
            // Fetch user profile
            const { data: profile, error: profileError } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('user_id', authData.user.id)
              .single();
            
            if (profileError && profileError.code !== 'PGRST116') {
              throw profileError;
            }
            
            // Map to app user
            const appUser = mapToAppUser(authData.user, profile);
            
            // Update state
            set({
              user: appUser,
              session: authData.session,
              isAuthenticated: true,
              isAdmin: appUser.role === 'admin' || appUser.role === 'super_admin',
              isSuperAdmin: appUser.role === 'super_admin',
              permissions: appUser.permissions,
              isLoading: false,
              error: null
            });
            
            // Update last active
            if (profile) {
              await supabase
                .from('user_profiles')
                .update({ last_active_at: new Date().toISOString() })
                .eq('user_id', authData.user.id);
            }
            
            // Log successful login
            await logAuditEvent('user_login', 'success', { 
              user_id: authData.user.id,
              email 
            });
            
            return { success: true };
            
          } catch (error: any) {
            const authError = createAuthError(error);
            set({ 
              isLoading: false, 
              error: authError,
              isAuthenticated: false 
            });
            
            // Log failed login
            await logAuditEvent('user_login', 'failed', { 
              email,
              error: authError.message 
            });
            
            return { 
              success: false, 
              error: authError.message 
            };
          }
        },
        
        // Sign in as admin
        signInAsAdmin: async (email: string, password: string): Promise<AuthResult> => {
          set({ isLoading: true, error: null });
          
          try {
            // Authenticate with Supabase
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
              email,
              password
            });
            
            if (authError) throw authError;
            if (!authData.user) throw new Error('No user returned from authentication');
            
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
              .eq('user_id', authData.user.id)
              .single();
            
            // Map to app user with admin data
            const appUser = mapToAppUser(authData.user, profile, adminProfile);
            
            // Update state
            set({
              user: appUser,
              session: authData.session,
              isAuthenticated: true,
              isAdmin: true,
              isSuperAdmin: appUser.role === 'super_admin',
              permissions: appUser.permissions,
              isLoading: false,
              error: null
            });
            
            // Update admin last login
            await supabase
              .from('admin_users')
              .update({ 
                last_login_at: new Date().toISOString(),
                login_attempts: 0 
              })
              .eq('email', email);
            
            // Log successful admin login
            await logAuditEvent('admin_login', 'success', { 
              user_id: authData.user.id,
              email,
              role: adminProfile.role 
            });
            
            return { success: true };
            
          } catch (error: any) {
            const authError = createAuthError(error);
            set({ 
              isLoading: false, 
              error: authError,
              isAuthenticated: false 
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
            
            // Log failed admin login
            await logAuditEvent('admin_login', 'failed', { 
              email,
              error: authError.message 
            });
            
            return { 
              success: false, 
              error: authError.message 
            };
          }
        },
        
        // Sign up new user
        signUp: async (email: string, password: string, metadata?: SignUpMetadata): Promise<AuthResult> => {
          set({ isLoading: true, error: null });
          
          try {
            const { data: authData, error: authError } = await supabase.auth.signUp({
              email,
              password,
              options: {
                data: {
                  username: metadata?.username,
                  full_name: metadata?.full_name,
                  business_name: metadata?.business_name
                }
              }
            });
            
            if (authError) throw authError;
            if (!authData.user) throw new Error('No user returned from sign up');
            
            // Create user profile
            const profileData: Database['public']['Tables']['user_profiles']['Insert'] = {
              user_id: authData.user.id,
              email: email,
              username: metadata?.username || email.split('@')[0],
              full_name: metadata?.full_name || null,
              business_name: metadata?.business_name || null,
              timezone: metadata?.timezone || 'UTC',
              status: 'pending',
              user_role: 'user'
            };
            
            await supabase
              .from('user_profiles')
              .insert([profileData]);
            
            // Log successful signup
            await logAuditEvent('user_signup', 'success', { 
              user_id: authData.user.id,
              email 
            });
            
            return { 
              success: true,
              data: { 
                requiresEmailConfirmation: true 
              }
            };
            
          } catch (error: any) {
            const authError = createAuthError(error);
            set({ 
              isLoading: false, 
              error: authError 
            });
            
            return { 
              success: false, 
              error: authError.message 
            };
          }
        },
        
        // Sign out
        signOut: async (): Promise<void> => {
          const currentUser = get().user;
          
          try {
            // Log signout before clearing session
            if (currentUser) {
              await logAuditEvent('user_logout', 'success', { 
                user_id: currentUser.id 
              });
            }
            
            await supabase.auth.signOut();
          } catch (error) {
            console.error('Sign out error:', error);
          }
          
          // Clear state
          set({
            user: null,
            session: null,
            isAuthenticated: false,
            isAdmin: false,
            isSuperAdmin: false,
            permissions: [],
            error: null
          });
          
          // Redirect to login
          window.location.href = '/login';
        },
        
        // Refresh session
        refreshSession: async (): Promise<void> => {
          try {
            const { data: { session }, error } = await supabase.auth.refreshSession();
            
            if (error) throw error;
            
            if (session) {
              set({ 
                session,
                error: null 
              });
            } else {
              get().clearSession();
            }
          } catch (error: any) {
            console.error('Session refresh error:', error);
            get().clearSession();
          }
        },
        
        // Check current session
        checkSession: async (): Promise<void> => {
          set({ isLoading: true });
          
          try {
            const { data: { session }, error } = await supabase.auth.getSession();
            
            if (error) throw error;
            
            if (session?.user) {
              // Fetch user profile
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
              
              // Map to app user
              const appUser = mapToAppUser(session.user, profile, adminProfile);
              
              set({
                user: appUser,
                session,
                isAuthenticated: true,
                isAdmin: appUser.role === 'admin' || appUser.role === 'super_admin',
                isSuperAdmin: appUser.role === 'super_admin',
                permissions: appUser.permissions,
                isLoading: false,
                isInitialized: true,
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
                isInitialized: true,
                isAuthenticated: false 
              });
            }
          } catch (error: any) {
            console.error('Session check error:', error);
            set({ 
              isLoading: false,
              isInitialized: true,
              error: createAuthError(error)
            });
          }
        },
        
        // Clear session
        clearSession: (): void => {
          set({
            user: null,
            session: null,
            isAuthenticated: false,
            isAdmin: false,
            isSuperAdmin: false,
            permissions: [],
            error: null
          });
        },
        
        // Update user profile
        updateProfile: async (updates: Partial<UserProfileUpdate>): Promise<UpdateResult> => {
          const currentUser = get().user;
          if (!currentUser) {
            return { 
              success: false, 
              error: 'Not authenticated' 
            };
          }
          
          try {
            const { error } = await supabase
              .from('user_profiles')
              .update(updates)
              .eq('user_id', currentUser.id)
              .select()
              .single();
            
            if (error) throw error;
            
            // Refresh user data
            await get().checkSession();
            
            // Log profile update
            await logAuditEvent('profile_update', 'success', { 
              user_id: currentUser.id,
              updates 
            });
            
            return { 
              success: true,
              user: get().user || currentUser
            };
            
          } catch (error: any) {
            return { 
              success: false, 
              error: error.message 
            };
          }
        },
        
        // Change password
        changePassword: async (_currentPassword: string, newPassword: string): Promise<AuthResult> => {
          try {
            const { error } = await supabase.auth.updateUser({ 
              password: newPassword 
            });
            
            if (error) throw error;
            
            const currentUser = get().user;
            if (currentUser) {
              await logAuditEvent('password_change', 'success', { 
                user_id: currentUser.id 
              });
            }
            
            return { success: true };
            
          } catch (error: any) {
            return { 
              success: false, 
              error: error.message 
            };
          }
        },
        
        // Reset password
        resetPassword: async (email: string): Promise<AuthResult> => {
          try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
              redirectTo: `${window.location.origin}/reset-password`
            });
            
            if (error) throw error;
            
            await logAuditEvent('password_reset_request', 'success', { email });
            
            return { success: true };
            
          } catch (error: any) {
            return { 
              success: false, 
              error: error.message 
            };
          }
        },
        
        // Permission checks
        hasPermission: (permission: Permission): boolean => {
          const { permissions } = get();
          return permissions.includes(permission);
        },
        
        hasAnyPermission: (permissions: Permission[]): boolean => {
          const userPermissions = get().permissions;
          return permissions.some(p => userPermissions.includes(p));
        },
        
        hasAllPermissions: (permissions: Permission[]): boolean => {
          const userPermissions = get().permissions;
          return permissions.every(p => userPermissions.includes(p));
        },
        
        canAccessRoute: (route: string): boolean => {
          const requiredPermissions = ROUTE_PERMISSIONS[route];
          if (!requiredPermissions || requiredPermissions.length === 0) {
            return true; // Public route
          }
          return get().hasAnyPermission(requiredPermissions);
        },
        
        // Initialize auth
        initialize: async (): Promise<void> => {
          if (get().isInitialized) return;
          
          await get().checkSession();
        },
        
        // Clear error
        clearError: (): void => {
          set({ error: null });
        }
      }),
      {
        name: 'auth-store',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          // Only persist essential data
          user: state.user,
          isAuthenticated: state.isAuthenticated,
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

let authListener: { data: { subscription: any } } | null = null;

// Set up auth state change listener
export const initializeAuthListener = () => {
  if (authListener) return;
  
  authListener = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
    console.log('Auth state changed:', event);
    
    switch (event) {
      case 'SIGNED_IN':
        if (session) {
          await useAuthStore.getState().checkSession();
        }
        break;
        
      case 'SIGNED_OUT':
        useAuthStore.getState().clearSession();
        break;
        
      case 'TOKEN_REFRESHED':
        if (session) {
          useAuthStore.setState({ session });
        }
        break;
        
      case 'USER_UPDATED':
        await useAuthStore.getState().checkSession();
        break;
        
      default:
        break;
    }
  });
};

// Clean up listener
export const cleanupAuthListener = () => {
  if (authListener) {
    authListener.data.subscription.unsubscribe();
    authListener = null;
  }
};

// =====================================
// HOOKS
// =====================================

// Hook for components to use auth
export const useAuth = () => {
  const state = useAuthStore();
  
  return {
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    isAdmin: state.isAdmin,
    isSuperAdmin: state.isSuperAdmin,
    error: state.error,
    signIn: state.signIn,
    signInAsAdmin: state.signInAsAdmin,
    signUp: state.signUp,
    signOut: state.signOut,
    hasPermission: state.hasPermission,
    canAccessRoute: state.canAccessRoute
  };
};

// Hook for protected routes
export const useRequireAuth = (redirectTo: string = '/login') => {
  const { isAuthenticated, isLoading, initialize } = useAuthStore();
  
  // Initialize auth on mount
  if (!isLoading) {
    initialize();
  }
  
  // Redirect if not authenticated
  if (!isLoading && !isAuthenticated) {
    window.location.href = redirectTo;
  }
  
  return { isAuthenticated, isLoading };
};

// Hook for admin-only routes
export const useRequireAdmin = (redirectTo: string = '/dashboard') => {
  const { isAdmin, isLoading, initialize } = useAuthStore();
  
  // Initialize auth on mount
  if (!isLoading) {
    initialize();
  }
  
  // Redirect if not admin
  if (!isLoading && !isAdmin) {
    window.location.href = redirectTo;
  }
  
  return { isAdmin, isLoading };
};

// Initialize listener on module load
initializeAuthListener();