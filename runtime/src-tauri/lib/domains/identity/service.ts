// =====================================
// IDENTITY DOMAIN — Phase 3c
// Pure business logic for the identity module. NO supabase imports.
// NO env reads. NO I/O. Takes inputs, returns outputs.
//
// This file is the home of:
//   - Role hierarchy (the "what does it mean to BE a user/admin" rules)
//   - User projection (mapToUser: supabase + profile + admin -> app User)
//   - Username / permission derivation helpers
//   - Admin-access policy (checkAdminAccess)
//
// Why pure: identity must be testable without mocks. The transport
// layer (substrates/auth/transports/supabase.ts) fetches the data and
// passes it in. This file only knows how to interpret what it gets.
// =====================================

import type { User as SupabaseUser } from '@supabase/supabase-js';
import type {
  AdminUserRow,
  Role,
  User,
  UserProfileRow,
} from '../../contracts/identity/auth.contract';

// =====================================
// ROLE HIERARCHY
// =====================================

/**
 * Numeric rank for the role hierarchy. Higher = more privilege.
 * Used by hasRoleAtLeast() to compare a user's actual role against
 * a required minimum. The values are NOT persisted or transmitted —
 * they're the internal ordering of the policy.
 */
export const ROLE_RANK: Record<Role, number> = {
  user: 1,
  admin: 2,
  super_admin: 3,
};

/**
 * Returns true if `actual` ranks at or above `required` in the role
 * hierarchy. undefined / null / unknown role always returns false —
 * the safe default is to deny access.
 */
export function hasRoleAtLeast(
  actual: Role | undefined | null,
  required: Role,
): boolean {
  if (!actual) return false;
  if (!(actual in ROLE_RANK)) return false;
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}

// =====================================
// USERNAME / PERMISSION DERIVATION
// =====================================

/**
 * Safely extracts the username portion from an email address.
 * Returns 'user' as the fallback when the email is null, undefined,
 * or otherwise malformed. This is the same fallback used by
 * authStore.ts:196-200.
 */
export function getUsernameFromEmail(
  email: string | null | undefined,
): string {
  if (!email || typeof email !== 'string') return 'user';
  const parts = email.split('@');
  return parts[0] || 'user';
}

/**
 * Converts a full name to a username slug: lowercase, spaces -> underscores.
 * Returns 'admin' as the fallback when the name is null, undefined, or
 * otherwise malformed. Same fallback as authStore.ts:206-209.
 */
export function formatUsername(
  fullName: string | null | undefined,
): string {
  if (!fullName || typeof fullName !== 'string') return 'admin';
  return fullName.toLowerCase().replace(/\s+/g, '_');
}

/**
 * Type guard + default for a permissions array. Accepts any value:
 *   - If it's an array of strings, returns the filtered array
 *   - Otherwise returns the default user permission set
 *
 * The default set is what authStore.ts:215-221 used inline.
 * Centralized here so the policy is testable.
 */
const DEFAULT_USER_PERMISSIONS: string[] = [
  'dashboard',
  'content',
  'engagement',
  'analytics',
  'settings',
];

export function getPermissions(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((p): p is string => typeof p === 'string');
  }
  return [...DEFAULT_USER_PERMISSIONS];
}

// =====================================
// USER PROJECTION
// =====================================

/**
 * Projects a Supabase user + user_profile + (optional) admin_users row
 * into the application User shape. This is the only place where the
 * "what does our app call this person" mapping lives.
 *
 * Resolution order for each field:
 *   - email: profile.email || supabaseUser.email
 *   - username: profile.username || (admin full_name -> formatUsername) || getUsernameFromEmail(email)
 *   - permissions: adminProfile.permissions (if admin) || DEFAULT_USER_PERMISSIONS
 *   - role: adminProfile.role || profile.user_role || 'user'
 *   - facebook_id, avatarUrl, instagramConnected: from profile
 *
 * Returns null only when supabaseUser is null. A valid Supabase user
 * with no profile data still produces a User (with fallbacks).
 */
export function mapToUser(
  supabaseUser: SupabaseUser | null,
  profile: UserProfileRow | null,
  adminProfile?: AdminUserRow | null,
): User | null {
  if (!supabaseUser) return null;

  const email = profile?.email || supabaseUser.email || undefined;
  const username =
    profile?.username ||
    (adminProfile?.full_name
      ? formatUsername(adminProfile.full_name)
      : null) ||
    getUsernameFromEmail(email);

  return {
    id: supabaseUser.id,
    username,
    email,
    facebook_id: profile?.facebook_id || undefined,
    avatarUrl: profile?.avatar_url || undefined,
    permissions: adminProfile
      ? getPermissions(adminProfile.permissions)
      : getPermissions(undefined),
    role: adminProfile?.role || profile?.user_role || 'user',
    instagramConnected: profile?.instagram_connected || false,
  };
}

// =====================================
// ADMIN ACCESS POLICY
// =====================================

/**
 * Returns true iff the user is authenticated AND has the admin or
 * super_admin role. This is the same check that authStore.ts:343-348
 * used inline (in checkAdminAccess).
 */
export function checkAdminAccess(user: User | null): boolean {
  if (!user) return false;
  return hasRoleAtLeast(user.role, 'admin');
}
