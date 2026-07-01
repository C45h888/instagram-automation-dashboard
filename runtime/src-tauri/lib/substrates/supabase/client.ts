/**
 * substrates/supabase/client.ts
 *
 * The typed Supabase client singleton. Every domain service, controller,
 * and substrate that needs to talk to Supabase imports `supabase` from here.
 *
 * Owns:
 *   - Environment variable resolution (URL + anon key) — via config substrate
 *   - Auth config (PKCE flow, localStorage persistence, token refresh)
 *   - Realtime config (10 events/sec rate limit)
 *   - Custom fetch with retry (delegated to substrates/http/retry)
 *
 * Does NOT own:
 *   - Business queries (those go through domains/<x>/service.ts)
 *   - Realtime subscriptions (substrates/supabase/realtime.ts)
 *   - Audit logging (substrates/supabase/audit.ts)
 *   - Session helpers (substrates/auth/index.ts)
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { fetchWithRetry } from '../http/retry';
import { recordSupabaseCall } from './emissions';
import { getSupabaseConfig, getApiBaseUrl } from '../config';

// ─────────────────────────────────────────────────────────────────
// Config resolution via kernel-backed config substrate
// ─────────────────────────────────────────────────────────────────

function resolveSupabaseConfig() {
  try {
    const { url, tunnelUrl, directUrl, anonKey } = getSupabaseConfig();
    return {
      url: url || tunnelUrl || directUrl || '',
      anonKey,
    };
  } catch {
    // Outside Tauri runtime: use env vars (browser dev mode).
    // The config substrate's fallback path also uses env vars as a fallback,
    // so this path should rarely be hit in practice.
    return {
      url:
        (import.meta.env as Record<string, string | undefined>)?.VITE_SUPABASE_URL ||
        (import.meta.env as Record<string, string | undefined>)?.VITE_SUPABASE_TUNNEL_URL ||
        (import.meta.env as Record<string, string | undefined>)?.VITE_SUPABASE_DIRECT_URL ||
        '',
      anonKey:
        (import.meta.env as Record<string, string | undefined>)?.VITE_SUPABASE_ANON_KEY || '',
    };
  }
}

const { url: supabaseUrl, anonKey: supabaseAnonKey } = resolveSupabaseConfig();

if (!supabaseUrl || !supabaseAnonKey) {
  const missingVars: string[] = [];
  if (!supabaseUrl) missingVars.push('VITE_SUPABASE_URL');
  if (!supabaseAnonKey) missingVars.push('VITE_SUPABASE_ANON_KEY');

  // eslint-disable-next-line no-console
  console.error('❌ Missing Supabase environment variables:', missingVars);
  throw new Error(
    `Missing required Supabase environment variables: ${missingVars.join(', ')}`,
  );
}

function resolveDebugFlag(): boolean {
  try {
    const apiBase = getApiBaseUrl();
    return apiBase.includes('development') || apiBase.includes('staging');
  } catch {
    return (
      (import.meta.env as Record<string, string | undefined>)?.VITE_ENVIRONMENT === 'development'
    );
  }
}

let _supabase: ReturnType<typeof createClient<Database>>;
try {
  _supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
      storageKey: 'instagram-automation-auth',
      flowType: 'pkce',
      debug: resolveDebugFlag(),
    },
    db: {
      schema: 'public',
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
    global: {
      headers: {
        'X-Client-Info': 'instagram-automation-dashboard',
        'X-Client-Version': '1.0.0',
        'X-Client-Platform': 'web-frontend',
      },
      fetch: fetchWithRetry,
    },
  });
  recordSupabaseCall({
    op: 'client_init',
    success: true,
    latency_ms: 0,
  });
} catch (e) {
  recordSupabaseCall({
    op: 'client_init',
    success: false,
    latency_ms: 0,
    error_kind: String(e),
  });
  throw e;
}

export const supabase = _supabase;

export default supabase;
