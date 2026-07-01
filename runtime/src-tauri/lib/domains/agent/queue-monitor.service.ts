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

import { queryPostQueueOverview } from '../../substrates/supabase/query';
import { isValidUUID } from '../../substrates/supabase/query';
import { fetchWithRetry } from '../../substrates/http/retry';
import { getCurrentSession } from '../../substrates/auth/transports/supabase';
import { getApiBaseUrl } from '../../substrates/config';
import type { ServiceResponse } from '../../substrates/supabase/query';
import type { QueueOverview, QueueRetryResult } from '../../contracts/agent/agent-tables.contract';

/** API base URL for backend Express routes (retry only) — provided by the kernel config substrate. */

/** Single query replacing getQueueStatus + getQueueDLQ.
 *  Substrate: substrates/supabase/query.ts → queryPostQueueOverview */
export async function getQueueOverview(): Promise<ServiceResponse<QueueOverview>> {
  return queryPostQueueOverview();
}

/** Retry a failed/DLQ queue item via backend API (requires session JWT) */
export async function retryQueueItem(queueId: string): Promise<ServiceResponse<QueueRetryResult>> {
  if (!isValidUUID(queueId)) {
    return { success: false, data: null, error: 'Invalid queueId format' };
  }
  try {
    const session = await getCurrentSession();
    if (!session?.access_token) {
      return { success: false, data: null, error: 'Not authenticated' };
    }

    const response = await fetchWithRetry(`${getApiBaseUrl()}/api/instagram/post-queue/retry`, {
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