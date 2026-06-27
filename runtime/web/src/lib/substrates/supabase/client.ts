/**
 * substrates/supabase/client.ts
 *
 * The typed Supabase client singleton. Every domain service, controller,
 * and substrate that needs to talk to Supabase imports `supabase` from here.
 *
 * Owns:
 *   - Environment variable resolution (URL + anon key)
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

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.VITE_SUPABASE_TUNNEL_URL ||
  import.meta.env.VITE_SUPABASE_DIRECT_URL;

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

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

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: 'instagram-automation-auth',
    flowType: 'pkce',
    debug: import.meta.env.VITE_ENVIRONMENT === 'development',
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

export default supabase;
