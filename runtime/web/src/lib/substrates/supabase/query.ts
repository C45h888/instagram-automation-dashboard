/**
 * substrates/supabase/query.ts
 *
 * Generic Supabase query helpers. Shared shape definitions and guards that
 * every domain service uses. Domain-specific queries live in
 * `domains/<x>/service.ts` — this file is the substrate layer beneath them.
 *
 * Phase 3e decomposes `src/services/databaseservices.ts` and migrates each
 * domain method to its proper home. Until then, `databaseservices.ts`
 * imports from here for the shared shape types and UUID guard.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Response shape contracts
// ─────────────────────────────────────────────────────────────────────────────

export interface ServiceResponse<T> {
  success: boolean;
  data: T | null;
  error?: string;
}

export interface ServiceListResponse<T> {
  success: boolean;
  data: T[];
  error?: string;
  count?: number;
}

export interface DeleteResponse {
  success: boolean;
  error?: string;
  affected?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pagination
// ─────────────────────────────────────────────────────────────────────────────

export interface PaginationOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

// ─────────────────────────────────────────────────────────────────────────────
// UUID guard
//
// Prevents the "invalid input syntax for type uuid" Postgres error when a
// Facebook ID is mistakenly passed where a Supabase UUID is expected.
// ─────────────────────────────────────────────────────────────────────────────

export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}
