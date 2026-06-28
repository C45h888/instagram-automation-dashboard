/**
 * domains/agent/queue-monitor.service.ts
 *
 * Queue monitor — histogram + DLQ reads (direct Supabase) and retry (backend).
 * Extracted from `src/services/agentService.ts` as part of Phase 3e god-file
 * decomposition. Bodies preserved verbatim.
 *
 * Status and DLQ reads query post_queue directly via the Supabase client.
 * RLS policy (authenticated_select_own_post_queue) scopes rows to the
 * authenticated user's business accounts automatically.
 *
 * Retry stays on the backend because it requires service_role to UPDATE.
 * The session access_token is passed as Authorization: Bearer *** the backend
 * can verify the user's identity and ownership before resetting the row.
 *
 * Consumers should import from here, not from `agentService.ts`.
 */

import { supabase } from '../../substrates/supabase/client';
import { isValidUUID } from '../../substrates/supabase/query';
import { fetchWithRetry } from '../../substrates/http/retry';
import type { ServiceResponse } from '../../substrates/supabase/query';
import type { QueueOverview, QueueDLQItem, QueueRetryResult } from '../../contracts/agent/agent-tables.contract';

/** API base URL for backend Express routes (retry only) */
function getApiBase(): string {
  return import.meta.env.VITE_API_BASE_URL || 'https://api.888intelligenceautomation.in';
}

/** Single query replacing getQueueStatus + getQueueDLQ.
 *  Fetches up to 200 rows, derives histogram and DLQ items from the same result.
 *  Eliminates two independent polling clocks on the same table. */
export async function getQueueOverview(): Promise<ServiceResponse<QueueOverview>> {
  try {
    const { data, error } = await supabase
      .from('post_queue')
      .select('status, action_type, id, business_account_id, payload, retry_count, error, error_category, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(200);

    if (error) throw error;

    const byKey: Record<string, number> = {};
    const dlqItems: QueueDLQItem[] = [];

    for (const row of (data ?? [])) {
      const key = `${row.action_type}::${row.status}`;
      byKey[key] = (byKey[key] ?? 0) + 1;
      if (row.status === 'dlq') {
        dlqItems.push(row as QueueDLQItem);
      }
    }

    return {
      success: true,
      data: {
        byKey,
        total: data?.length ?? 0,
        dlqItems,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('AgentService.getQueueOverview failed:', msg);
    return { success: false, data: null, error: msg };
  }
}

/** Retry a failed/DLQ queue item via backend API (requires session JWT) */
export async function retryQueueItem(queueId: string): Promise<ServiceResponse<QueueRetryResult>> {
  if (!isValidUUID(queueId)) {
    return { success: false, data: null, error: 'Invalid queueId format' };
  }
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return { success: false, data: null, error: 'Not authenticated' };
    }

    const response = await fetchWithRetry(`${getApiBase()}/api/instagram/post-queue/retry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ queue_id: queueId }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Failed to retry item' }));
      return { success: false, data: null, error: err.error ?? `HTTP ${response.status}` };
    }
    const result = await response.json();
    return {
      success: true,
      data: {
        queue_id: result.queue_id,
        action_type: result.action_type,
        previous_retry_count: result.previous_retry_count,
        message: result.message,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('AgentService.retryQueueItem failed:', msg);
    return { success: false, data: null, error: msg };
  }
}