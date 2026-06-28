/**
 * domains/instagram/business-accounts.service.ts
 *
 * Instagram business account queries. This is the canonical home for
 * business-account CRUD — extracted from `src/services/databaseservices.ts`
 * as part of the Phase 3e god-file decomposition.
 *
 * Consumers should import from here, not from `databaseservices.ts`.
 */

import { queryBusinessAccounts, upsertBusinessAccount } from '../../substrates/supabase/query';
import type { ServiceResponse, ServiceListResponse } from '../../substrates/supabase/query';
import type { Database } from '../../substrates/supabase/database.types';

type InstagramBusinessAccount = Database['public']['Tables']['instagram_business_accounts']['Row'];

/** Fetches all connected Instagram business accounts for a user.
 *  Substrate: substrates/supabase/query.ts → queryBusinessAccounts */
export async function getBusinessAccounts(
  userId: string,
): Promise<ServiceListResponse<InstagramBusinessAccount>> {
  return queryBusinessAccounts(userId);
}

/** Connects (upserts) an Instagram business account.
 *  Substrate: substrates/supabase/query.ts → upsertBusinessAccount */
export async function connectBusinessAccount(
  accountData: Database['public']['Tables']['instagram_business_accounts']['Insert'],
): Promise<ServiceResponse<InstagramBusinessAccount>> {
  return upsertBusinessAccount(accountData);
}
