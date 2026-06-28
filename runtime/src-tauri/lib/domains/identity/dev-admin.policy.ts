// =====================================
// DEV-ADMIN POLICY — Phase 3c
// Pure function. NO I/O. NO env reads. Takes env-injected config.
//
// Why a separate file: the dev-mode admin fallback in
// authStore.ts:432-461 used import.meta.env.VITE_ADMIN_EMAIL /
// VITE_ADMIN_PASSWORD inline. That's a Vite/React concern and
// doesn't belong in either the transport (which is I/O) or the
// identity domain (which is pure). So it gets its own policy file
// that the transport calls with env injected by the React adapter.
//
// The React adapter (src/stores/authStore.ts after Pass 7) is the
// ONLY place that reads import.meta.env. This file never sees env
// directly — it just receives the values and decides.
// =====================================

import type { DevAdminEnv, User } from '../../contracts/identity/auth.contract';

/**
 * The fixed user.id and token used when the dev-mode admin fallback
 * fires. Centralized here so the magic strings appear in exactly one
 * place. Used by:
 *   - this file (the fallback User)
 *   - substrates/auth/transports/supabase.ts (when it short-circuits
 *     a real supabase.auth.signInWithPassword failure)
 *   - substrates/auth/store.ts (when it needs to detect "this is
 *     the dev session" and skip audit log emission)
 */
export const DEV_ADMIN_USER_ID = 'admin-dev-001';
export const DEV_ADMIN_TOKEN = 'dev-admin-token';

export interface DevAdminResult {
  user: User;
  token: string;
}

/**
 * Tries to authenticate as the dev admin. Returns a result only if:
 *   - env is non-null (i.e. the React adapter decided to enable dev auth)
 *   - email matches env.email
 *   - password matches env.password
 *
 * Returns null in every other case — the transport then falls through
 * to real Supabase auth.
 *
 * The result.user has the same shape as a real admin user, but with
 * id=DEV_ADMIN_USER_ID so the rest of the system can detect it.
 */
export function tryDevAdminSignIn(
  email: string,
  password: string,
  env: DevAdminEnv | null,
): DevAdminResult | null {
  if (!env) return null;
  if (email !== env.email) return null;
  if (password !== env.password) return null;

  const user: User = {
    id: DEV_ADMIN_USER_ID,
    username: 'admin',
    email,
    permissions: [
      'dashboard',
      'content',
      'engagement',
      'analytics',
      'settings',
      'automations',
      'admin',
      'user-management',
      'system-config',
    ],
    role: 'super_admin',
  };

  return { user, token: DEV_ADMIN_TOKEN };
}
