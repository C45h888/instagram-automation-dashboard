/**
 * domains/agent/health.service.ts
 *
 * Agent health queries — heartbeat rows + computed liveness status.
 * Extracted from `src/services/agentService.ts` as part of Phase 3e god-file
 * decomposition. Bodies preserved verbatim.
 *
 * Consumers should import from here, not from `agentService.ts`.
 */

import { supabase } from '../../substrates/supabase/client';
import { fetchWithRetry } from '../../substrates/http/retry';
import type { ServiceResponse, ServiceListResponse } from '../../substrates/supabase/query';
import type { AgentHeartbeat, AgentHeartbeatStatus } from '../../contracts/agent/agent-tables.contract';

/** Fetch the latest heartbeat rows (most recent first).
 *  Note: agent_heartbeats has no business_account_id column — returns all rows. */
export async function getHeartbeats(limit = 5): Promise<ServiceListResponse<AgentHeartbeat>> {
  try {
    const { data, error } = await supabase
      .from('agent_heartbeats')
      .select('*')
      .order('last_beat_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return { success: true, data: data ?? [] };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('AgentService.getHeartbeats failed:', msg);
    return { success: false, data: [], error: msg };
  }
}

/** Fetch computed agent liveness status via backend (single source of truth for LIVENESS_THRESHOLD_MS). */
export async function getAgentStatus(): Promise<ServiceResponse<{
  status: AgentHeartbeatStatus;
  last_beat_at: string | null;
  agent_id: string | null;
}>> {
  try {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://api.888intelligenceautomation.in';
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {};

    const res = await fetchWithRetry(`${apiBaseUrl}/api/instagram/agent/status`, { headers });
    const json = await res.json() as ServiceResponse<{
      status: AgentHeartbeatStatus;
      last_beat_at: string | null;
      agent_id: string | null;
    }>;
    return json;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('AgentService.getAgentStatus failed:', msg);
    return { success: false, data: null, error: msg };
  }
}