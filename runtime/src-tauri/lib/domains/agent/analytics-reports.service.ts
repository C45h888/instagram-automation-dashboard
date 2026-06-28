/**
 * domains/agent/analytics-reports.service.ts
 *
 * Analytics reports — agent-written, UPSERTed.
 * Extracted from `src/services/agentService.ts` as part of Phase 3e god-file
 * decomposition. Body preserved verbatim.
 *
 * Consumers should import from here, not from `agentService.ts`.
 */

import { queryAnalyticsReports } from '../../substrates/supabase/query';
import type { ServiceListResponse } from '../../substrates/supabase/query';
import type { AnalyticsReport, ReportType } from '../../contracts/agent/agent-tables.contract';

/** Fetch analytics reports, optionally filtered by report_type.
 *  Substrate: substrates/supabase/query.ts → queryAnalyticsReports */
export async function getAnalyticsReports(
  businessAccountId: string,
  reportType?: ReportType,
  limit = 30,
): Promise<ServiceListResponse<AnalyticsReport>> {
  return queryAnalyticsReports(businessAccountId, reportType, limit);
}