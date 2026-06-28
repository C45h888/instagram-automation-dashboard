/**
 * domains/gdpr/privacy.service.ts
 *
 * GDPR/CCPA data privacy operations — deletion & export of user data.
 * Extracted from `src/services/databaseservices.ts` as part of Phase 3e
 * god-file decomposition.
 *
 * Consumers should import from here, not from `databaseservices.ts`.
 */

import { supabase } from '../../substrates/supabase/client';
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
 */
export async function deleteUserData(
  userId: string,
  options: DeleteUserDataOptions = {},
): Promise<DeleteUserDataResult> {
  try {
    const results: Record<string, boolean> = {};

    // Delete in dependency order
    if (options.deleteWorkflows) {
      const { error } = await supabase
        .from('automation_workflows')
        .delete()
        .eq('user_id', userId);
      results.workflows = !error;
    }

    if (options.deleteAnalytics) {
      const { error } = await supabase
        .from('daily_analytics')
        .delete()
        .eq('user_id', userId);
      results.analytics = !error;
    }

    if (options.deleteAccounts) {
      const { error } = await supabase
        .from('instagram_business_accounts')
        .delete()
        .eq('user_id', userId);
      results.accounts = !error;
    }

    if (options.deleteNotifications) {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', userId);
      results.notifications = !error;
    }

    if (options.deleteAuditLogs) {
      const { error } = await supabase
        .from('audit_log')
        .delete()
        .eq('user_id', userId);
      results.auditLogs = !error;
    }

    if (options.deleteProfile) {
      const { error } = await supabase
        .from('user_profiles')
        .delete()
        .eq('user_id', userId);
      results.profile = !error;
    }

    await logAuditEvent('data_deletion_requested', 'delete', { options, results }, { userId });

    return { success: true, results };
  } catch (error: any) {
    console.error('Delete user data error:', error);
    return { success: false, error: error.message, results: {} };
  }
}
