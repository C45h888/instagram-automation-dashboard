// =====================================
// AUTH STORE — Phase 3c
// The zustand impl of the auth module's reactive state container.
//
// What lives here:
//   - useAuthStore: the zustand hook (same name + API as the legacy
//     src/stores/authStore.ts so the 30 importers don't change)
//   - partialize: persists exactly PersistedAuthCore (no session,
//     no isLoading, no error, no providerToken)
//   - onAuthStateChange: registered on module import, mirrors the
//     legacy module-top side effect at authStore.ts:744-822
//   - devAdminEnv getter: injected by the React adapter (Pass 7)
//     via setDevAdminEnv() — the only place that reads import.meta.env
//
// What does NOT live here:
//   - I/O: lives in substrates/auth/transports/supabase.ts
//   - User mapping / role check: lives in domains/identity
//   - Dev-mode policy: lives in domains/identity/dev-admin.policy
//   - React glue: src/stores/authStore.ts (Pass 7)
//
// This file is the only file in the auth module that imports zustand.
// When Svelte lands, this file is replaced by a Svelte store impl that
// satisfies the same slot contract (substrates/auth/slot.ts).
// =====================================

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { devtools } from 'zustand/middleware';

import { hasRoleAtLeast } from '../../domains/identity/service';
import {
  checkSession as transportCheckSession,
  createTestUser as transportCreateTestUser,
  incrementAdminLoginAttempts,
  isDevAdminUserId,
  onAuthStateChange,
  signInAsAdmin as transportSignInAsAdmin,
  signInWithEmail as transportSignInWithEmail,
  signOut as transportSignOut,
} from './transports/supabase';
import type { DevAdminEnv, PersistedAuthCore, User } from '../../contracts/identity/auth.contract';

// =====================================
// STATE SHAPE (the slot content)
// =====================================

/**
 * The full state held in the auth slot. Combines the contract
 * shapes (AuthCore + BusinessAccount + AuthUiState + ProviderToken)
 * with the action methods. This is the shape that useAuthStore
 * returns when called with no selector.
 */
export interface AuthState {
  // Core (from AuthCore contract)
  user: User | null;
  token: string | null;
  session: unknown; // Session — kept as unknown to avoid coupling to supabase types in the slot
  isAuthenticated: boolean;
  isAdmin: boolean;
  permissions: string[];

  // UI (from AuthUiState contract)
  isLoading: boolean;
  error: string | null;

  // Business account (from BusinessAccount contract)
  businessAccountId: string | null;
  instagramBusinessId: string | null;
  pageId: string | null;
  pageName: string | null;

  // OAuth (transient, never persisted)
  providerToken: string | null;

  // Actions
  login: (user: User, token: string) => void;
  adminLogin: (user: User, token: string) => void;
  logout: () => Promise<void>;
  refreshToken: (token: string) => void;
  updateUser: (updates: Partial<User>) => void;
  checkAdminAccess: () => boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInAsAdmin: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  checkSession: () => Promise<void>;
  createTestUser: () => Promise<void>;
  clearError: () => void;
  setBusinessAccount: (data: {
    businessAccountId: string;
    instagramBusinessId: string;
    pageId?: string;
    pageName?: string;
  }) => void;
  /** Injected by the React adapter (Pass 7) from import.meta.env. */
  setDevAdminEnv: (env: DevAdminEnv | null) => void;
}

// =====================================
// DEV-ADMIN ENV (module-level, not in slot)
// =====================================

/**
 * Dev-admin env is held in a module-level variable (not in the slot)
 * because it's pure config, not reactive state. The React adapter
 * (Pass 7) sets it once on import. The transport reads it during
 * signInAsAdmin.
 *
 * Not persisted (env vars are session-scoped config, not state).
 */
let devAdminEnv: DevAdminEnv | null = null;

/**
 * Top-level setter for the dev-admin env. Called by the React
 * adapter (src/stores/authStore.ts) once on module load with the
 * values read from import.meta.env. Exported so the adapter can
 * call it without going through the store.
 */
export function setDevAdminEnv(env: DevAdminEnv | null): void {
  devAdminEnv = env;
}

/** Getter for the current dev-admin env. The transport reads this. */
export function getDevAdminEnv(): DevAdminEnv | null {
  return devAdminEnv;
}

// =====================================
// INITIAL STATE
// =====================================

const initialState = {
  user: null,
  token: null,
  session: null,
  isAuthenticated: false,
  isAdmin: false,
  isLoading: false,
  permissions: [] as string[],
  error: null as string | null,
  businessAccountId: null as string | null,
  instagramBusinessId: null as string | null,
  pageId: null as string | null,
  pageName: null as string | null,
  providerToken: null as string | null,
};

// =====================================
// SLOT CREATION (zustand create + persist + devtools)
// =====================================

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // =====================================
        // LEGACY METHODS (preserved for backward compatibility)
        // =====================================

        login: (user, token) => {
          set({
            user,
            token,
            isAuthenticated: true,
            isAdmin: hasRoleAtLeast(user.role, 'admin'),
            permissions: user.permissions,
            error: null,
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
            error: null,
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
            user: state.user ? { ...state.user, ...updates } : null,
          }));
        },

        checkAdminAccess: () => {
          const state = get();
          return (
            state.isAuthenticated &&
            state.isAdmin &&
            hasRoleAtLeast(state.user?.role, 'admin')
          );
        },

        // =====================================
        // MODERN SUPABASE METHODS (delegate to transport)
        // =====================================

        signInWithEmail: async (email, password) => {
          set({ isLoading: true, error: null });
          try {
            const result = await transportSignInWithEmail(email, password);
            set({
              user: result.user,
              session: result.session,
              token: result.token,
              isAuthenticated: true,
              isAdmin: hasRoleAtLeast(result.user.role, 'admin'),
              permissions: result.user.permissions,
              isLoading: false,
              error: null,
            });
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Login failed';
            set({
              isLoading: false,
              error: message,
              isAuthenticated: false,
              user: null,
              token: null,
              session: null,
            });
            throw error;
          }
        },

        signInAsAdmin: async (email, password) => {
          set({ isLoading: true, error: null });
          try {
            const result = await transportSignInAsAdmin(
              email,
              password,
              devAdminEnv,
            );
            set({
              user: result.user,
              session: result.session,
              token: result.token,
              isAuthenticated: true,
              isAdmin: true,
              permissions: result.user.permissions,
              isLoading: false,
              error: null,
            });
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Admin login failed';
            set({
              isLoading: false,
              error: message,
              isAuthenticated: false,
              user: null,
              token: null,
              session: null,
            });
            // Best-effort login_attempts increment.
            await incrementAdminLoginAttempts(email);
            throw error;
          }
        },

        signOut: async () => {
          const userId = get().user?.id;
          try {
            if (userId && !isDevAdminUserId(userId)) {
              const { logAuditEvent } = await import('../supabase/audit');
              await logAuditEvent('logout', 'success', { userId });
            }
            await transportSignOut();
          } catch (error) {
            console.error('❌ Sign out error:', error);
          }
          set({
            ...initialState,
          });
          // Clear localStorage entry for auth-storage.
          if (typeof window !== 'undefined') {
            try {
              localStorage.removeItem('auth-storage');
            } catch {
              // Ignore
            }
            // Redirect to login (preserves legacy behavior).
            window.location.href = '/login';
          }
        },

        checkSession: async () => {
          set({ isLoading: true });
          try {
            const result = await transportCheckSession();
            if (result) {
              set({
                user: result.user,
                session: result.session,
                token: result.token,
                isAuthenticated: true,
                isAdmin: hasRoleAtLeast(result.user.role, 'admin'),
                permissions: result.user.permissions,
                isLoading: false,
                error: null,
              });
            } else {
              // Dev-mode session detection: keep current user if dev admin.
              const currentUser = get().user;
              if (currentUser && isDevAdminUserId(currentUser.id)) {
                set({ isLoading: false });
                return;
              }
              set({
                isLoading: false,
                isAuthenticated: false,
                user: null,
                token: null,
                session: null,
              });
            }
          } catch (error) {
            console.error('❌ Session check error:', error);
            set({ isLoading: false, error: 'Failed to check session' });
          }
        },

        createTestUser: async () => {
          await transportCreateTestUser();
        },

        clearError: () => {
          set({ error: null });
        },

        setBusinessAccount: (data) => {
          console.log('📦 Setting business account in authStore:', data);
          set({
            businessAccountId: data.businessAccountId,
            instagramBusinessId: data.instagramBusinessId,
            pageId: data.pageId ?? null,
            pageName: data.pageName ?? null,
          });
          console.log('✅ Business account data stored in authStore');
        },

        setDevAdminEnv: (env) => {
          devAdminEnv = env;
        },
      }),
      {
        name: 'auth-storage',
        storage: createJSONStorage(() => localStorage),
        partialize: (state): PersistedAuthCore => ({
          user: state.user,
          token: state.token,
          isAuthenticated: state.isAuthenticated,
          isAdmin: state.isAdmin,
          permissions: state.permissions,
          businessAccountId: state.businessAccountId,
          instagramBusinessId: state.instagramBusinessId,
          pageId: state.pageId,
          pageName: state.pageName,
        }),
      },
    ),
    { name: 'AuthStore' },
  ),
);

// =====================================
// onAuthStateChange listener (module-top, behavior-preserving)
// =====================================

/**
 * Module-level side effect: registers the auth state change listener
 * when this module is imported. The store updates its slot in response
 * to Supabase's auth events. Mirrors authStore.ts:744-822.
 *
 * Note: today this listener is module-top, meaning it registers on
 * every import. If substrates/auth/store is imported multiple times
 * (e.g. once via src/stores/authStore.ts and once directly somewhere
 * else), the listener registers multiple times. That's a known issue
 * deferred to Phase 4 per PHASE3_EXECUTION_PLAN.md §8.
 */
onAuthStateChange((change) => {
  const store = useAuthStore.getState();

  switch (change.event) {
    case 'INITIAL_SESSION':
      if (change.providerToken) {
        console.log('📦 Provider token captured from initial session');
        useAuthStore.setState({ providerToken: change.providerToken });
      }
      if (change.session) {
        store.checkSession();
      }
      break;

    case 'SIGNED_IN':
      if (change.providerToken) {
        console.log('📦 Provider token captured from OAuth sign-in');
        console.log(
          '   Token prefix:',
          change.providerToken.substring(0, 20) + '...',
        );
        useAuthStore.setState({ providerToken: change.providerToken });
        // Backup to localStorage (per authStore.ts:777 — security-flagged
        // for Phase 4, preserved for now).
        try {
          localStorage.setItem('fb_provider_token', change.providerToken);
          console.log('   ✅ Provider token backed up to localStorage');
        } catch {
          console.warn('   ⚠️ Could not backup provider token to localStorage');
        }
      }
      if (change.session) {
        store.checkSession();
      }
      break;

    case 'SIGNED_OUT':
      useAuthStore.setState({
        user: null,
        session: null,
        token: null,
        providerToken: null,
        isAuthenticated: false,
        isAdmin: false,
        permissions: [],
      });
      try {
        localStorage.removeItem('fb_provider_token');
      } catch {
        // Ignore
      }
      break;

    case 'TOKEN_REFRESHED':
      if (change.session) {
        useAuthStore.setState({
          session: change.session,
          token: (change.session as { access_token?: string }).access_token ?? null,
        });
      }
      break;

    case 'USER_UPDATED':
      store.checkSession();
      break;
  }
});
