// =====================================
// AUTH TRANSPORT — Phase 3c
// Supabase-specific I/O for the auth module. The substrate layer.
//
// What lives here:
//   - signInWithEmail: supabase.auth.signInWithPassword + profile fetch
//   - signInAsAdmin: same + admin_users fetch + dev-mode fallback policy
//   - signOut: supabase.auth.signOut + localStorage cleanup
//   - checkSession: supabase.auth.getSession + profile + admin fetch
//   - createTestUser: dev-only signup
//   - onAuthStateChange: module-top listener that captures provider_token
//
// What does NOT live here:
//   - User projection (mapToUser): imported from domains/identity
//   - Role check (hasRoleAtLeast): imported from domains/identity
//   - Dev-mode fallback policy (tryDevAdminSignIn): domains/identity
//   - State slot management: substrates/auth/store.ts (next pass)
//   - React glue: src/stores/authStore.ts (Pass 7)
//
// The transport returns PLAIN VALUES. No slot, no zustand, no React.
// The store (Pass 6) takes what the transport returns and updates
// the slot. That's the substrate-as-interpreter model.
// =====================================

import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

import { supabase } from '../../supabase/client';
import { logAuditEvent } from '../../supabase/audit';
import {
  checkAdminAccess,
  hasRoleAtLeast,
  mapToUser,
} from '../../../domains/identity/service';
import {
  DEV_ADMIN_USER_ID,
  tryDevAdminSignIn,
} from '../../../domains/identity/dev-admin.policy';
import type {
  DevAdminEnv,
  User,
  UserProfileRow,
  AdminUserRow,
} from '../../../contracts/identity/auth.contract';

// =====================================
// SHARED RETURN SHAPE
// =====================================

/**
 * What a successful sign-in / session-restore returns. The transport
 * caller (the store) projects this into the authSlot. session is
 * included even though it's not persisted — the store needs it to
 * satisfy the on-the-wire AuthCore shape.
 */
export interface SignInResult {
  user: User;
  session: Session;
  token: string;
}

// =====================================
// signInWithEmail
// =====================================

/**
 * Authenticates with email + password, fetches the user_profile row,
 * projects to app User, emits success/failure audit events.
 *
 * On success, also updates user_profiles.last_active_at.
 * Mirrors authStore.ts:354-421.
 */
export async function signInWithEmail(
  email: string,
  password: string,
): Promise<SignInResult> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    await logAuditEvent('user_login', 'failed', {
      email,
      error: error.message,
    });
    throw error;
  }

  if (!data.user || !data.session) {
    const err = new Error('Login failed - no user data returned');
    await logAuditEvent('user_login', 'failed', {
      email,
      error: err.message,
    });
    throw err;
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', data.user.id)
    .maybeSingle();

  if (profileError && profileError.code !== 'PGRST116') {
    console.error('Profile fetch error:', profileError);
  }

  const user = mapToUser(data.user, profile as UserProfileRow | null);
  if (!user) {
    const err = new Error('Failed to create user object');
    await logAuditEvent('user_login', 'failed', {
      email,
      error: err.message,
    });
    throw err;
  }

  await logAuditEvent('user_login', 'success', { email });

  if (profile) {
    await supabase
      .from('user_profiles')
      .update({ last_active_at: new Date().toISOString() })
      .eq('user_id', data.user.id);
  }

  return {
    user,
    session: data.session,
    token: data.session.access_token,
  };
}

// =====================================
// signInAsAdmin
// =====================================

/**
 * Admin sign-in. Three branches:
 *   1. Dev-mode fallback: if supabase.auth.signInWithPassword errors AND
 *      (email, password) match the dev-admin env, return a mock admin
 *      without ever touching the network.
 *   2. Real admin: supabase.auth.signInWithPassword succeeds AND the
 *      email matches an active admin_users row.
 *   3. Failure: neither path works; audit + throw.
 *
 * On success, updates admin_users.last_login_at. On failure, increments
 * admin_users.login_attempts (best-effort, doesn't block).
 * Mirrors authStore.ts:423-555.
 */
export async function signInAsAdmin(
  email: string,
  password: string,
  devAdminEnv: DevAdminEnv | null,
): Promise<SignInResult> {
  // Branch 1: dev-mode fallback short-circuit.
  // Try real auth first; if it errors and env matches, fall through to dev.
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    const devResult = tryDevAdminSignIn(email, password, devAdminEnv);
    if (devResult) {
      console.log('📝 Development admin login');
      // No real session; we return a synthetic one (no access_token).
      // Dev mode skips audit emission per authStore.ts:459 pattern.
      return {
        user: devResult.user,
        // Build a minimal session-like object. The store will see
        // session.access_token = '' and treat this as a dev session.
        session: null as unknown as Session,
        token: devResult.token,
      };
    }
    await logAuditEvent('admin_login', 'failed', {
      email,
      error: error.message,
    });
    throw error;
  }

  if (!data.user || !data.session) {
    const err = new Error('Admin login failed - no user data returned');
    await logAuditEvent('admin_login', 'failed', {
      email,
      error: err.message,
    });
    throw err;
  }

  // Branch 2: real admin verification.
  const { data: adminProfile, error: adminError } = await supabase
    .from('admin_users')
    .select('*')
    .eq('email', email)
    .eq('is_active', true)
    .maybeSingle();

  if (adminError || !adminProfile) {
    await logAuditEvent('admin_login', 'failed', {
      email,
      error: 'Unauthorized: Admin access required',
    });
    throw new Error('Unauthorized: Admin access required');
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', data.user.id)
    .maybeSingle();

  const user = mapToUser(
    data.user,
    profile as UserProfileRow | null,
    adminProfile as AdminUserRow | null,
  );
  if (!user) {
    const err = new Error('Failed to create admin user object');
    await logAuditEvent('admin_login', 'failed', {
      email,
      error: err.message,
    });
    throw err;
  }

  await supabase
    .from('admin_users')
    .update({
      last_login_at: new Date().toISOString(),
      login_attempts: 0,
    })
    .eq('email', email);

  await logAuditEvent('admin_login', 'success', { email });

  return {
    user,
    session: data.session,
    token: data.session.access_token,
  };
}

/**
 * Best-effort increment of admin_users.login_attempts on failed login.
 * Called by the store on the error path of signInAsAdmin. Doesn't throw
 * — failure to track attempts should not block the user-facing error.
 */
export async function incrementAdminLoginAttempts(
  email: string,
): Promise<void> {
  try {
    const { data: admin } = await supabase
      .from('admin_users')
      .select('login_attempts')
      .eq('email', email)
      .maybeSingle();

    if (admin) {
      await supabase
        .from('admin_users')
        .update({ login_attempts: (admin.login_attempts || 0) + 1 })
        .eq('email', email);
    }
  } catch {
    // Silently fail — don't block login flow.
  }
}

// =====================================
// signOut
// =====================================

/**
 * Signs out, clears local auth storage, returns void.
 * Mirrors authStore.ts:557-586.
 */
export async function signOut(): Promise<void> {
  // The store handles the localStorage cleanup + redirect. The
  // transport only does the I/O.
  await supabase.auth.signOut();
}

/**
 * Returns true if the userId belongs to the dev-mode mock admin.
 * Used by the store to skip audit log emission for dev sessions.
 */
export function isDevAdminUserId(userId: string | undefined | null): boolean {
  return userId === DEV_ADMIN_USER_ID;
}

// =====================================
// checkSession
// =====================================

/**
 * Restores an existing Supabase session, fetches the profile +
 * admin profile, projects to app User.
 *
 * Returns null when no session exists OR when the session exists but
 * user projection fails (treat as unauthenticated).
 * Mirrors authStore.ts:588-659.
 */
export async function checkSession(): Promise<SignInResult | null> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    return null;
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', session.user.id)
    .maybeSingle();

  const { data: adminProfile } = await supabase
    .from('admin_users')
    .select('*')
    .eq('user_id', session.user.id)
    .eq('is_active', true)
    .maybeSingle();

  const user = mapToUser(
    session.user,
    profile as UserProfileRow | null,
    adminProfile as AdminUserRow | null,
  );

  if (!user) {
    return null;
  }

  if (profile) {
    await supabase
      .from('user_profiles')
      .update({ last_active_at: new Date().toISOString() })
      .eq('user_id', session.user.id);
  }

  return {
    user,
    session,
    token: session.access_token,
  };
}

// =====================================
// createTestUser
// =====================================

/**
 * Creates a throwaway test user via supabase.auth.signUp. Dev-only.
 * Mirrors authStore.ts:661-681.
 */
export async function createTestUser(): Promise<void> {
  const { data, error } = await supabase.auth.signUp({
    email: `test_${Date.now()}@888intelligence.com`,
    password: 'TestUser@2024!',
    options: {
      data: {
        username: `testuser_${Date.now()}`,
        full_name: 'Test User',
      },
    },
  });

  if (error) throw error;
  console.log('✅ Test user created:', data.user?.email);
}

// =====================================
// onAuthStateChange listener
// =====================================

/**
 * Result of a single onAuthStateChange notification. The store
 * reads this and updates slots accordingly. Decoupled from any
 * state container so the transport stays framework-agnostic.
 */
export interface AuthStateChange {
  event: AuthChangeEvent;
  session: Session | null;
  /** Captured from session.provider_token when present (OAuth flow). */
  providerToken: string | null;
  /**
   * The user_id detected as a dev-mode mock admin (matches
   * DEV_ADMIN_USER_ID). Present only when checkSession finds a
   * session whose user.id equals the dev marker — Supabase
   * doesn't know about our dev marker, so this is computed by
   * the store after the listener fires.
   */
  devAdminDetected: boolean;
}

/**
 * Subscribes to Supabase auth state changes. The callback fires
 * on every auth event (INITIAL_SESSION, SIGNED_IN, SIGNED_OUT,
 * TOKEN_REFRESHED, USER_UPDATED). The store uses these to
 * refresh the auth slot.
 *
 * Returns an unsubscribe function. Module-level side effect: the
 * listener is registered for the lifetime of the app, similar to
 * the original authStore.ts:744-822.
 *
 * The providerToken is captured from session.provider_token on
 * SIGNED_IN — this is the Facebook access token from OAuth, used
 * for the Instagram Graph API exchange.
 */
export function onAuthStateChange(
  callback: (change: AuthStateChange) => void,
): () => void {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event: AuthChangeEvent, session: Session | null) => {
      const providerToken = session?.provider_token ?? null;
      callback({
        event,
        session,
        providerToken,
        devAdminDetected: false, // The store computes this after restore
      });
    },
  );

  return () => subscription.unsubscribe();
}

// =====================================
// HELPERS re-exported for the store's convenience
// =====================================

export { hasRoleAtLeast, checkAdminAccess, mapToUser };
