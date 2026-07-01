/**
 * substrates/supabase/api-usage.ts
 *
 * API request metering substrate. Tracks per-user, per-endpoint, per-hour-bucket
 * usage counts for billing and rate-limit analysis. Writes to the `api_usage`
 * table with an UPSERT on a composite key (user_id + endpoint + method +
 * hour_bucket).
 *
 * Silent on auth failure: if no user is signed in, the call is dropped
 * without error. Anonymous metering is intentionally not tracked.
 */

import { supabase } from './client';
import { getCurrentUser } from '../auth/transports/supabase';
import { recordSupabaseCall } from './emissions';

export const logApiRequest = async (
  endpoint: string,
  method: string,
  responseTimeMs: number,
  statusCode: number,
  success: boolean,
  errorMessage?: string,
): Promise<void> => {
  const t0 = Date.now();
  try {
    const user = await getCurrentUser();
    if (!user) {
      recordSupabaseCall({
        op: 'api_usage',
        success: false,
        latency_ms: Date.now() - t0,
        error_kind: 'no_user',
      });
      return;
    }

    const apiUsageEntry = {
      user_id: user.id,
      endpoint,
      method,
      response_time_ms: responseTimeMs,
      status_code: statusCode,
      success,
      error_message: errorMessage,
      hour_bucket: new Date().toISOString().slice(0, 13) + ':00:00',
      request_count: 1,
      credits_consumed: 1,
    };

    const { error } = await supabase.from('api_usage').upsert([apiUsageEntry], {
      onConflict: 'user_id,business_account_id,endpoint,method,hour_bucket',
      ignoreDuplicates: false,
    });

    if (error) {
      recordSupabaseCall({
        op: 'api_usage',
        success: false,
        latency_ms: Date.now() - t0,
        error_kind: error.message,
      });
    } else {
      recordSupabaseCall({
        op: 'api_usage',
        success: true,
        latency_ms: Date.now() - t0,
      });
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to log API request:', error);
    recordSupabaseCall({
      op: 'api_usage',
      success: false,
      latency_ms: Date.now() - t0,
      error_kind: String(error),
    });
  }
};
