/**
 * substrates/auth/index.ts
 *
 * Supabase Auth transport substrate. Owns the raw auth/signin/signout/session
 * calls and identity-mapping helpers. The identity domain (Phase 3c) layers
 * business semantics (role hierarchy, permissions, business-account binding)
 * on top of what this substrate produces.
 *
 * Why split:
 *   - This file: how do we talk to Supabase Auth?
 *   - domains/identity/service.ts (3c): what does it mean to BE a user?
 *
 * The two are related but not the same concern. Substrate is replaceable
 * (Supabase Auth → Auth0 → self-hosted OAuth). Identity is the business
 * rule (admin vs user vs super_admin).
 */

import { supabase } from '../supabase/client';
import type { Database } from '../supabase/database.types';

type UserProfile = Database['public']['Tables']['user_profiles']['Row'];

// ─────────────────────────────────────────────────────────────────────────────
// Session transport
// ─────────────────────────────────────────────────────────────────────────────

export const getCurrentUser = async () => {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error getting current user:', error);
    return null;
  }
};

export const getCurrentSession = async () => {
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error getting current session:', error);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Profile read
// ─────────────────────────────────────────────────────────────────────────────

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error getting user profile:', error);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Role check (TRANSPORT — the policy layer lives in domains/identity)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Raw role-hierarchy comparison. Returns true if the profile's role ranks
 * at or above the required role in the user/admin/super_admin hierarchy.
 *
 * Phase 3c will replace this with a domain-level identity service. For now,
 * callers that need role-gating should go through `domains/identity/service.ts`,
 * not this substrate helper.
 */
export const checkUserRole = async (
  userId: string,
  requiredRole: string,
): Promise<boolean> => {
  try {
    const profile = await getUserProfile(userId);

    if (!profile || !profile.user_role) return false;

    const roleHierarchy: Record<string, number> = {
      user: 1,
      admin: 2,
      super_admin: 3,
    };

    return roleHierarchy[profile.user_role] >= roleHierarchy[requiredRole];
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error checking user role:', error);
    return false;
  }
};

export const isUserAdmin = async (userId: string): Promise<boolean> => {
  return checkUserRole(userId, 'admin');
};

export const isUserSuperAdmin = async (userId: string): Promise<boolean> => {
  return checkUserRole(userId, 'super_admin');
};

// ─────────────────────────────────────────────────────────────────────────────
// Identity mapping (Dual-ID: Supabase user_id ↔ Facebook instagram_business_id)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get Facebook ID from Supabase user_id.
 * Used for making Facebook Graph API calls.
 */
export const getFacebookIdFromUserId = async (
  userId: string,
): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('facebook_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      // eslint-disable-next-line no-console
      console.error('Error fetching Facebook ID:', error);
      return null;
    }

    return data?.facebook_id || null;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error in getFacebookIdFromUserId:', error);
    return null;
  }
};

/**
 * Get Supabase user_id from Facebook ID.
 * Used for mapping Facebook OAuth responses to internal users.
 */
export const getUserIdFromFacebookId = async (
  facebookId: string,
): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('user_id')
      .eq('facebook_id', facebookId)
      .maybeSingle();

    if (error) {
      // eslint-disable-next-line no-console
      console.error('Error fetching user_id from Facebook ID:', error);
      return null;
    }

    return data?.user_id || null;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error in getUserIdFromFacebookId:', error);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Type guards (substrate-level shape checks; domain-level guards live in
// domains/identity/service.ts)
// ─────────────────────────────────────────────────────────────────────────────

export const isUserProfile = (
  data: unknown,
): data is Database['public']['Tables']['user_profiles']['Row'] => {
  return (
    !!data &&
    typeof data === 'object' &&
    typeof (data as { user_id?: unknown }).user_id === 'string' &&
    'user_role' in (data as Record<string, unknown>)
  );
};

export const isAdminUser = (
  data: unknown,
): data is Database['public']['Tables']['admin_users']['Row'] => {
  return (
    !!data &&
    typeof data === 'object' &&
    typeof (data as { email?: unknown }).email === 'string' &&
    'role' in (data as Record<string, unknown>)
  );
};

export const isWorkflow = (
  data: unknown,
): data is Database['public']['Tables']['automation_workflows']['Row'] => {
  return (
    !!data &&
    typeof data === 'object' &&
    typeof (data as { automation_type?: unknown }).automation_type === 'string' &&
    'status' in (data as Record<string, unknown>)
  );
};
