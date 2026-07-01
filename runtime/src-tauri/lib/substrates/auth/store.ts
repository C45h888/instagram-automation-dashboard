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
import { recordAuthCall } from './emissions';
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
  const t0 = Date.now();
  try {
    devAdminEnv = env;
    recordAuthCall({ op: 'set_dev_admin_env', success: true, latency_ms: Date.now() - t0 });
  } catch (e) {
    recordAuthCall({ op: 'set_dev_admin_env', success: false, latency_ms: Date.now() - t0, error_kind: String(e) });
    throw e;
  }
}

/** Getter for the current dev-admin env. The transport reads this. */
export function getDevAdminEnv(): DevAdminEnv | null {
  recordAuthCall({ op: 'get_dev_admin_env', success: true });
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
          const t0 = Date.now();
          try {
            set({
              user,
              token,
              isAuthenticated: true,
              isAdmin: hasRoleAtLeast(user.role, 'admin'),
              permissions: user.permissions,
              error: null,
            });
            recordAuthCall({ op: 'login', success: true, latency_ms: Date.now() - t0 });
            console.log('✅ Legacy login successful:', user.username);
          } catch (e) {
            recordAuthCall({ op: 'login', success: false, latency_ms: Date.now() - t0, error_kind: String(e) });
            throw e;
          }
        },

        adminLogin: (user, token) => {
          const t0 = Date.now();
          try {
            set({
              user,
              token,
              isAuthenticated: true,
              isAdmin: true,
              permissions: user.permissions,
              error: null,
            });
            recordAuthCall({ op: 'admin_login', success: true, latency_ms: Date.now() - t0 });
            console.log('✅ Legacy admin login successful:', user.username);
          } catch (e) {
            recordAuthCall({ op: 'admin_login', success: false, latency_ms: Date.now() - t0, error_kind: String(e) });
            throw e;
          }
        },

        logout: async () => {
          const t0 = Date.now();
          try {
            await get().signOut();
            recordAuthCall({ op: 'logout', success: true, latency_ms: Date.now() - t0 });
          } catch (e) {
            recordAuthCall({ op: 'logout', success: false, latency_ms: Date.now() - t0, error_kind: String(e) });
            throw e;
          }
        },

        refreshToken: (token) => {
          const t0 = Date.now();
          try {
            set({ token });
            recordAuthCall({ op: 'refresh_token', success: true, latency_ms: Date.now() - t0 });
          } catch (e) {
            recordAuthCall({ op: 'refresh_token', success: false, latency_ms: Date.now() - t0, error_kind: String(e) });
            throw e;
          }
        },

        updateUser: (updates) => {
          const t0 = Date.now();
          try {
            set((state) => ({
              user: state.user ? { ...state.user, ...updates } : null,
            }));
            recordAuthCall({ op: 'update_user', success: true, latency_ms: Date.now() - t0 });
          } catch (e) {
            recordAuthCall({ op: 'update_user', success: false, latency_ms: Date.now() - t0, error_kind: String(e) });
            throw e;
          }
        },

        checkAdminAccess: () => {
          const t0 = Date.now();
          try {
            const state = get();
            const result =
              state.isAuthenticated &&
              state.isAdmin &&
              hasRoleAtLeast(state.user?.role, 'admin');
            recordAuthCall({ op: 'check_admin_access', success: true, latency_ms: Date.now() - t0 });
            return result;
          } catch (e) {
            recordAuthCall({ op: 'check_admin_access', success: false, latency_ms: Date.now() - t0, error_kind: String(e) });
            throw e;
          }
        },

        // =====================================
        // MODERN SUPABASE METHODS (delegate to transport)
        // =====================================

        signInWithEmail: async (email, password) => {
          const t0 = Date.now();
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
            recordAuthCall({ op: 'sign_in_with_email', success: true, latency_ms: Date.now() - t0 });
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
            recordAuthCall({ op: 'sign_in_with_email', success: false, latency_ms: Date.now() - t0, error_kind: message });
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
// onAuthStateChange listener (factory-registered, NOT module-top)
// =====================================
//
// Phase-4 deferral from prior version is now resolved: the listener is
// no longer registered at module import. Callers (the eventual Svelte
// adapter) wire it up explicitly via startAuthListener(), which is
// idempotent — repeated calls return the same registration.
//
// Concurrent calls to startAuthListener() produce a single registration.
// stopAuthListener() unregisters; startAuthListener() after stop
// re-registers. The store is unaffected.

let authListenerUnsubscribe: (() => void) | null = null;

/**
 * Start the auth state change listener. Idempotent — calling twice
 * produces a single subscription. Returns the unsubscribe function so
 * tests and teardown paths can detach without going through stopAuthListener.
 */
export function startAuthListener(): () => void {
  const t0 = Date.now();
  if (authListenerUnsubscribe) {
    recordAuthCall({ op: 'start_listener', success: true, latency_ms: Date.now() - t0 });
    return authListenerUnsubscribe;
  }

  authListenerUnsubscribe = onAuthStateChange((change) => {
    const store = useAuthStore.getState();

    switch (change.event) {
      case 'INITIAL_SESSION':
        if (change.providerToken) {
          useAuthStore.setState({ providerToken: change.providerToken });
        }
        if (change.session) {
          store.checkSession();
        }
        break;

      case 'SIGNED_IN':
        if (change.providerToken) {
          useAuthStore.setState({ providerToken: change.providerToken });
          // Transient only — per auth.contract.ts:96 the provider token
          // must NOT be persisted to localStorage. Phase-4 security
          // flag resolved: no localStorage backup, no removeItem on
          // sign-out.
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

  return authListenerUnsubscribe;
}

/**
 * Stop the auth state change listener. Safe to call when no listener
 * is registered.
 */
export function stopAuthListener(): void {
  const t0 = Date.now();
  if (authListenerUnsubscribe) {
    authListenerUnsubscribe();
    authListenerUnsubscribe = null;
    recordAuthCall({ op: 'stop_listener', success: true, latency_ms: Date.now() - t0 });
  }
}
