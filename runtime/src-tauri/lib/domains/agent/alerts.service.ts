/**
 * domains/agent/alerts.service.ts
 *
 * System alerts — fetch and resolve.
 * Extracted from `src/services/agentService.ts` as part of Phase 3e god-file
 * decomposition. Bodies preserved verbatim.
 *
 * Consumers should import from here, not from `agentService.ts`.
 */

import { querySystemAlerts, updateSystemAlertResolved } from '../../substrates/supabase/query';
import type { ServiceResponse, ServiceListResponse } from '../../substrates/supabase/query';
import type { SystemAlert } from '../../contracts/agent/agent-tables.contract';

/** Fetch system alerts for a business account.
 *  Defaults to unresolved alerts only; pass resolved=true to include all.
 *  Substrate: substrates/supabase/query.ts → querySystemAlerts */
export async function getSystemAlerts(
  businessAccountId: string,
  resolved = false,
): Promise<ServiceListResponse<SystemAlert>> {
  return querySystemAlerts(businessAccountId, resolved);
}

/** Mark a system alert as resolved.
 *  Substrate: substrates/supabase/query.ts → updateSystemAlertResolved */
export async function resolveAlert(alertId: string): Promise<ServiceResponse<SystemAlert>> {
  return updateSystemAlertResolved(alertId);
}