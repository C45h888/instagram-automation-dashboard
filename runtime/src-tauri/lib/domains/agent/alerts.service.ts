/**
 * domains/agent/alerts.service.ts
 *
 * System alerts — fetch and resolve.
 * Extracted from `src/services/agentService.ts` as part of Phase 3e god-file
 * decomposition. Bodies preserved verbatim.
 *
 * Consumers should import from here, not from `agentService.ts`.
 */

import { supabase } from '../../substrates/supabase/client';
import { isValidUUID } from '../../substrates/supabase/query';
import type { ServiceResponse, ServiceListResponse } from '../../substrates/supabase/query';
import type { SystemAlert } from '../../contracts/agent/agent-tables.contract';

/** Fetch system alerts for a business account.
 *  Defaults to unresolved alerts only; pass resolved=true to include all. */
export async function getSystemAlerts(
  businessAccountId: string,
  resolved = false,
): Promise<ServiceListResponse<SystemAlert>> {
  if (!isValidUUID(businessAccountId)) {
    return { success: false, data: [], error: 'Invalid businessAccountId format' };
  }
  try {
    const { data, error } = await supabase
      .from('system_alerts')
      .select('*')
      .eq('business_account_id', businessAccountId)
      .eq('resolved', resolved)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return { success: true, data: data ?? [] };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('AgentService.getSystemAlerts failed:', msg);
    return { success: false, data: [], error: msg };
  }
}

/** Mark a system alert as resolved */
export async function resolveAlert(alertId: string): Promise<ServiceResponse<SystemAlert>> {
  if (!isValidUUID(alertId)) {
    return { success: false, data: null, error: 'Invalid alertId format' };
  }
  try {
    const { data, error } = await supabase
      .from('system_alerts')
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq('id', alertId)
      .select()
      .single();
    if (error) throw error;
    return { success: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('AgentService.resolveAlert failed:', msg);
    return { success: false, data: null, error: msg };
  }
}