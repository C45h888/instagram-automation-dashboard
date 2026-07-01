/**
 * substrates/supabase/connection-test.ts
 *
 * One-shot Supabase connectivity check. Used by TestConnection.tsx and any
 * substrate-aware smoke test that needs to verify the client is reachable
 * before issuing real queries.
 */

import { supabase } from './client';
import { recordSupabaseCall } from './emissions';

export interface ConnectionTestResult {
  connected: boolean;
  tunnel_active?: boolean;
  response_time_ms?: number;
  error?: string;
  database_info?: {
    url: string;
    schema: string;
    tunnel_domain?: string;
  };
}

// Read the URL the same way client.ts does. If client.ts loaded successfully,
// these values are guaranteed non-null because client.ts throws on missing env.
// Cast to a permissive type because vite/client.d.ts doesn't enumerate every
// VITE_* env var — only the canonical `import.meta.env` keys are typed.
const env = import.meta.env as unknown as {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_TUNNEL_URL?: string;
  VITE_SUPABASE_DIRECT_URL?: string;
};
const supabaseUrl =
  env.VITE_SUPABASE_URL ||
  env.VITE_SUPABASE_TUNNEL_URL ||
  env.VITE_SUPABASE_DIRECT_URL ||
  '';

export const testSupabaseConnection = async (): Promise<ConnectionTestResult> => {
  const startTime = Date.now();

  try {
    // eslint-disable-next-line no-console
    console.log('🔍 Testing frontend Supabase connection...');

    const { error } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true });

    if (error) {
      // eslint-disable-next-line no-console
      console.error('❌ Supabase connection error:', error);
      recordSupabaseCall({
        op: 'connection_test',
        success: false,
        latency_ms: Date.now() - startTime,
        error_kind: error.message,
      });
      return {
        connected: false,
        error: error.message,
        response_time_ms: Date.now() - startTime,
      };
    }

    const responseTime = Date.now() - startTime;
    const tunnelActive =
      supabaseUrl.includes('db-secure') || supabaseUrl.includes('tunnel');

    // eslint-disable-next-line no-console
    console.log('✅ Frontend Supabase connected successfully');

    recordSupabaseCall({
      op: 'connection_test',
      success: true,
      latency_ms: responseTime,
    });

    return {
      connected: true,
      tunnel_active: tunnelActive,
      response_time_ms: responseTime,
      database_info: {
        url: supabaseUrl,
        schema: 'public',
        tunnel_domain: tunnelActive
          ? 'db-secure.888intelligenceautomation.in'
          : undefined,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error('❌ Connection test failed:', err);
    recordSupabaseCall({
      op: 'connection_test',
      success: false,
      latency_ms: Date.now() - startTime,
      error_kind: message,
    });
    return {
      connected: false,
      error: message,
      response_time_ms: Date.now() - startTime,
    };
  }
};
