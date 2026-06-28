// =====================================
// AUTH CONTRACT — Phase 3c
// Shared type definitions for the auth module.
// Source of truth for auth-related shapes that pass between
// substrates/auth/, domains/identity/, and the React adapter.
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
 * < 'super_admin'. Numeric rank is defined in domains/identity/service.ts
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
 *
 * `id` is always a Supabase UUID EXCEPT for the dev-mode mock admin
 * ('admin-dev-001') which short-circuits real auth. That constant
 * is centralized in domains/identity/dev-admin.policy.ts.
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
 *
 * `businessAccountId` is the UUID from instagram_business_accounts.
 * `instagramBusinessId` is the numeric Facebook ID used for Graph API.
 * `pageId` / `pageName` are the Facebook Page that owns the business
 * account — optional because the API doesn't always return them.
 */
export interface BusinessAccount {
  businessAccountId: string | null;
  instagramBusinessId: string | null;
  pageId: string | null;
  pageName: string | null;
}

/**
 * Transient UI state for the auth module. NOT persisted to localStorage
 * (per PersistedAuthCore — see below). Lives in the authSlot alongside
 * AuthCore, but conceptually separate so callers can read loading/error
 * without subscribing to the full auth state.
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
 *
 * Currently persisted in authStore.ts:777 as `fb_provider_token`.
 * Flagged for security review in Phase 4. See PHASE3_EXECUTION_PLAN.md
 * §8 "What this plan does not cover".
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
 *
 * This contract is the answer to "what does the persist middleware
 * serialize?" — the partialize function in substrates/auth/store.ts
 * must return exactly this shape.
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
 *
 * null when not in dev mode (production / staging) — the policy
 * returns null and the transport falls through to real Supabase auth.
 */
export interface DevAdminEnv {
  email: string;
  password: string;
}

// =====================================
// RE-EXPORTS for downstream convenience
// =====================================

/** Re-export the Supabase user type for the identity domain. */
export type { SupabaseUser };
