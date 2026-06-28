/**
 * domains/agent/analytics-reports.service.ts
 *
 * Analytics reports — agent-written, UPSERTed.
 * Extracted from `src/services/agentService.ts` as part of Phase 3e god-file
 * decomposition. Body preserved verbatim.
 *
 * Consumers should import from here, not from `agentService.ts`.
 */

import { supabase } from '../../substrates/supabase/client';
import { isValidUUID } from '../../substrates/supabase/query';
import type { ServiceListResponse } from '../../substrates/supabase/query';
import type { AnalyticsReport, ReportType } from '../../contracts/agent/agent-tables.contract';

/** Fetch analytics reports, optionally filtered by report_type */
export async function getAnalyticsReports(
  businessAccountId: string,
  reportType?: ReportType,
  limit = 30,
): Promise<ServiceListResponse<AnalyticsReport>> {
  if (!isValidUUID(businessAccountId)) {
    return { success: false, data: [], error: 'Invalid businessAccountId format' };
  }
  try {
    let query = supabase
      .from('analytics_reports')
      .select('*', { count: 'exact' })
      .eq('business_account_id', businessAccountId)
      .order('report_date', { ascending: false })
      .limit(limit);

    if (reportType) {
      query = query.eq('report_type', reportType);
    }

    const { data, error, count } = await query;
    if (error) throw error;
    return { success: true, data: data ?? [], count: count ?? undefined };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('AgentService.getAnalyticsReports failed:', msg);
    return { success: false, data: [], error: msg };
  }
}