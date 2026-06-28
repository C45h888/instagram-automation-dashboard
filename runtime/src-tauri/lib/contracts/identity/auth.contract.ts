// =====================================
// AUTH CONTRACT — Phase 3c
// Shared type definitions for the auth module.
// Source of truth for auth-related shapes. No behavior — that lives
// in substrates/auth/ (I/O) and domains/identity/ (policy).
//
// This file is types + enums + constants only. Functions live in
// domains/identity/service.ts (pure policy) and substrates/auth/
// (I/O + framework adapters).
// =====================================

import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import type { Database } from '../../substrates/supabase/database.types';

// =====================================
// DATABASE ROW ALIASES
// =====================================

export type UserProfileRow = Database['public']['Tables']['user_profiles']['Row'];
export type AdminUserRow = Database['public']['Tables']['admin_users']['Row'];

// =====================================
// ROLE HIERARCHY
// =====================================

/**
 * Three-tier role hierarchy. The order matters: 'user' < 'admin'
 * < 'super_admin'. Numeric rank lives in domains/identity/service.ts
 * (ROLE_RANK) — this contract only declares the type.
 */
export type Role = 'user' | 'admin' | 'super_admin';

// =====================================
// USER (application-level identity view)
// =====================================

/**
 * The User shape that consumers read from the auth slot. This is
 * the identity-domain projection of a Supabase user + profiles +
 * admin_users, NOT a raw Supabase user. The mapping is done by
 * mapToUser() in domains/identity/service.ts.
 */
export interface User {
  id: string;
  username: string;
  email?: string;
  facebook_id?: string;
  avatarUrl?: string;
  permissions: string[];
  role?: Role;
  instagramConnected?: boolean;
}

// =====================================
// STATE SHAPES
// =====================================

/**
 * The core auth state held in the authSlot. This is the minimum
 * required to represent "is there an authenticated session and who
 * is the user". Transient UI state (isLoading, error) and OAuth
 * state (providerToken) live in their own slots.
 */
export interface AuthCore {
  user: User | null;
  session: Session | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  permissions: string[];
}

/**
 * Business account data, captured from the Facebook OAuth handshake.
 * Lives in its own slot (businessSlot) so the auth slot stays small
 * and the business account can be cleared without nuking the session.
 */
export interface BusinessAccount {
  businessAccountId: string | null;
  instagramBusinessId: string | null;
  pageId: string | null;
  pageName: string | null;
}

/**
 * Transient UI state for the auth module. NOT persisted to localStorage.
 */
export interface AuthUiState {
  isLoading: boolean;
  error: string | null;
}

/**
 * The Facebook OAuth provider token, captured from the Supabase
 * session's `provider_token` field on SIGNED_IN. Per Supabase
 * guidance this should NOT be persisted to localStorage — it's
 * transient and only used during the Instagram Graph API exchange.
 */
export type ProviderToken = string | null;

// =====================================
// PERSISTENCE CONTRACT
// =====================================

/**
 * The exact subset of auth state that gets serialized to localStorage
 * under the key 'auth-storage'. Excluded on purpose:
 *   - session: contains expiring tokens, must be refreshed via Supabase
 *   - isLoading: UI state, must always start false
 *   - error: error messages shouldn't persist across sessions
 *   - providerToken: per Supabase guidance, transient only
 */
export interface PersistedAuthCore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  permissions: string[];

  // Business account state (3.5+)
  businessAccountId: string | null;
  instagramBusinessId: string | null;
  pageId: string | null;
  pageName: string | null;
}

// =====================================
// DEV-MODE POLICY INPUT
// =====================================

/**
 * Dev-mode admin env, injected from the React adapter (the only
 * place that reads import.meta.env.VITE_ADMIN_*). The transport
 * passes this into tryDevAdminSignIn() in domains/identity/dev-admin.policy.ts.
 */
export interface DevAdminEnv {
  email: string;
  password: string;
}

// =====================================
// RE-EXPORTS for downstream convenience
// =====================================

export type { SupabaseUser };
