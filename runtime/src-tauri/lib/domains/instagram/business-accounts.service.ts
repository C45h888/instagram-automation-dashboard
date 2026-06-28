/**
 * domains/instagram/business-accounts.service.ts
 *
 * Instagram business account queries. This is the canonical home for
 * business-account CRUD — extracted from `src/services/databaseservices.ts`
 * as part of the Phase 3e god-file decomposition.
 *
 * Consumers should import from here, not from `databaseservices.ts`.
 */

import { supabase } from '../../substrates/supabase/client';
import type { Database } from '../../substrates/supabase/database.types';
import type { ServiceListResponse, ServiceResponse } from '../../substrates/supabase/query';
import { isValidUUID } from '../../substrates/supabase/query';

type InstagramBusinessAccount = Database['public']['Tables']['instagram_business_accounts']['Row'];

/**
 * Fetches all connected Instagram business accounts for a user.
 * Validates UUID before querying to prevent Postgres "invalid input syntax for uuid".
 */
export async function getBusinessAccounts(
  userId: string,
): Promise<ServiceListResponse<InstagramBusinessAccount>> {
  if (!isValidUUID(userId)) {
    console.error('❌ Invalid user_id format. Expected UUID, got:', userId);
    console.error('   This is likely a Facebook ID being used instead of Supabase UUID');
    return {
      success: false,
      error: 'Invalid user_id format. Expected UUID.',
      data: [],
    };
  }

  try {
    const { data, error, count } = await supabase
      .from('instagram_business_accounts')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('is_connected', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return {
      success: true,
      data: data || [],
      count: count || 0,
    };
  } catch (error: any) {
    console.error('Get business accounts error:', error);
    return { success: false, error: error.message, data: [] };
  }
}

/**
 * Connects (upserts) an Instagram business account.
 */
export async function connectBusinessAccount(
  accountData: Database['public']['Tables']['instagram_business_accounts']['Insert'],
): Promise<ServiceResponse<InstagramBusinessAccount>> {
  try {
    const { data, error } = await supabase
      .from('instagram_business_accounts')
      .upsert([accountData])
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error: any) {
    console.error('Connect business account error:', error);
    return { success: false, error: error.message, data: null };
  }
}
