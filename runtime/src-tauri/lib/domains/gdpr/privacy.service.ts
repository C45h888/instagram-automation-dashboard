/**
 * domains/gdpr/privacy.service.ts
 *
 * GDPR/CCPA data privacy operations — deletion & export of user data.
 * Extracted from `src/services/databaseservices.ts` as part of Phase 3e
 * god-file decomposition.
 *
 * Consumers should import from here, not from `databaseservices.ts`.
 */

import { deleteUserDataRows } from '../../substrates/supabase/query';
import { logAuditEvent } from '../../substrates/supabase/audit';

export interface DeleteUserDataOptions {
  deleteProfile?: boolean;
  deleteAccounts?: boolean;
  deleteWorkflows?: boolean;
  deleteAnalytics?: boolean;
  deleteAuditLogs?: boolean;
  deleteNotifications?: boolean;
}

export interface DeleteUserDataResult {
  success: boolean;
  results: Record<string, boolean>;
  error?: string;
}

/**
 * Deletes user data from multiple tables in dependency order.
 * Called from DangerZoneSection (disconnect Instagram account).
 *
 * Substrate: substrates/supabase/query.ts → deleteUserDataRows (per-table deletes).
 * Domain concern (kept here): audit-log emission that records the deletion happened.
 */
export async function deleteUserData(
  userId: string,
  options: DeleteUserDataOptions = {},
): Promise<DeleteUserDataResult> {
  const result = await deleteUserDataRows(userId, options);
  await logAuditEvent('data_deletion_requested', 'delete', { options, results: result.results }, { userId });
  return result;
}
