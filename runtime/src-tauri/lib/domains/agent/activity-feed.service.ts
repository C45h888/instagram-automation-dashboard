/**
 * domains/agent/activity-feed.service.ts
 *
 * Activity feed — audit log entries from Supabase.
 * Extracted from `src/services/agentService.ts` as part of Phase 3e god-file
 * decomposition. Body preserved verbatim.
 *
 * Note: differs from `domains/observability/audit-log.service.ts` (DatabaseService
 * legacy) in filter shape — this version returns raw audit_log rows by recency,
 * not paginated by user_id. Kept as a separate file to preserve behaviour.
 *
 * Consumers should import from here, not from `agentService.ts`.
 */

import { queryAuditLog } from '../../substrates/supabase/query';
import type { ServiceListResponse } from '../../substrates/supabase/query';
import type { AuditLogEntry } from '../../contracts/agent/agent-tables.contract';

/** Fetch audit log entries from Supabase (client-side filter by business_account_id in details).
 *  Substrate: substrates/supabase/query.ts → queryAuditLog */
export async function getAuditLog(limit = 50): Promise<ServiceListResponse<AuditLogEntry>> {
  return queryAuditLog(limit);
}