// =====================================
// AUTH STORE — React adapter
// Phase 3c: this file is a thin re-export layer over the auth
// substrate store. The 849-line legacy implementation has been
// split into:
//   - contracts/identity/auth.contract.ts       (types)
//   - domains/identity/service.ts                (pure policy)
//   - domains/identity/dev-admin.policy.ts      (dev-mode policy)
//   - substrates/auth/transports/supabase.ts    (I/O)
//   - substrates/auth/store.ts                  (zustand impl)
//
// This file preserves the public surface so the 30 importers in
// src/components/, src/hooks/, src/pages/ don't change.
//
// Dev-mode env injection: this is the ONLY place that reads
// import.meta.env.VITE_ADMIN_*. The values flow into the store
// via setDevAdminEnv() and are read by the transport during
// signInAsAdmin. Importing this module triggers the devAdminEnv
// injection as a one-shot side effect.
//
// When Svelte lands, this file disappears with the rest of the
// React layer. The substrate at substrates/auth/store.ts becomes
// the new public surface, then becomes the Svelte store impl.
// =====================================

import type { User } from '../../runtime/src-tauri/lib/contracts/identity/auth.contract';

// =====================================
// DEV-ADMIN ENV INJECTION (one-shot on import)
// =====================================

// Read the Vite env vars at module load. In production builds,
// import.meta.env.VITE_ADMIN_EMAIL/PASSWORD are typically undefined,
// so devAdminEnv stays null and the transport falls through to
// real Supabase auth.
const envEmail = import.meta.env.VITE_ADMIN_EMAIL as string | undefined;
const envPassword = import.meta.env.VITE_ADMIN_PASSWORD as string | undefined;
const devAdminEnv =
  envEmail && envPassword ? { email: envEmail, password: envPassword } : null;

// =====================================
// RE-EXPORTS
// =====================================

// Trigger the substrate import (registers onAuthStateChange listener
// + initializes the zustand store) and inject the dev-admin env.
import {
  useAuthStore as useAuthStoreFromSubstrate,
  setDevAdminEnv,
} from '../../runtime/src-tauri/lib/substrates/auth/store';

if (devAdminEnv) {
  setDevAdminEnv(devAdminEnv);
}

/**
 * The React hook for the auth store. Re-exports the substrate's
 * zustand hook so consumers see the same name + API as before.
 */
export const useAuthStore = useAuthStoreFromSubstrate;

/**
 * Re-export the AuthState type for any consumer that imported it
 * from the legacy file. The substrate's AuthState is the same
 * shape (verified by signature compatibility — see migration
 * notes in substrates/auth/store.ts).
 */
export type AuthState = ReturnType<typeof useAuthStore>;

// Re-export the User type (some consumers may have inferred it from
// authStore.ts in the past).
export type { User };

// =====================================
// CONVENIENCE HOOKS (preserved for backward compatibility)
// =====================================

/**
 * Hook to check if user is authenticated.
 */
export const useIsAuthenticated = () => {
  const { isAuthenticated, isLoading } = useAuthStore();
  return { isAuthenticated, isLoading };
};

/**
 * Hook to check if user is admin.
 */
export const useIsAdmin = () => {
  const { isAdmin, isLoading } = useAuthStore();
  return { isAdmin, isLoading };
};

/**
 * Hook to get current user.
 */
export const useCurrentUser = () => {
  const { user, isLoading } = useAuthStore();
  return { user, isLoading };
};
