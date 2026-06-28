/**
 * domains/agent/agent-queries.service.ts
 *
 * Generic query against agent-writable tables.
 * Extracted from `src/services/agentService.ts` as part of Phase 3e god-file
 * decomposition. Body preserved verbatim.
 *
 * Consumers should import from here, not from `agentService.ts`.
 */

import { supabase } from '../../substrates/supabase/client';
import { isValidUUID } from '../../substrates/supabase/query';
import type { ServiceListResponse } from '../../substrates/supabase/query';
import type { AgentWritableTableName } from '../../contracts/agent/agent-tables.contract';

export async function get<T extends AgentWritableTableName>(
  table: T,
  businessAccountId: string,
  options?: {
    limit?: number;
    orderBy?: string;
    filters?: Record<string, unknown>;
  },
): Promise<ServiceListResponse<unknown>> {
  if (!isValidUUID(businessAccountId)) {
    return { success: false, data: [], error: 'Invalid businessAccountId format' };
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from(table as string)
      .select('*', { count: 'exact' })
      .eq('business_account_id', businessAccountId);

    if (options?.filters) {
      for (const [key, value] of Object.entries(options.filters)) {
        query = query.eq(key, value as string);
      }
    }
    if (options?.limit) query = query.limit(options.limit);
    if (options?.orderBy) query = query.order(options.orderBy, { ascending: false });

    const { data, error, count } = await query;
    if (error) throw error;
    return { success: true, data: data ?? [], count: count ?? undefined };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`AgentService.get(${table}) failed:`, msg);
    return { success: false, data: [], error: msg };
  }
}