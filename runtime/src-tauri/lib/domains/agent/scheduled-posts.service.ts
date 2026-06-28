/**
 * domains/agent/scheduled-posts.service.ts
 *
 * Scheduled posts — fetch and update status.
 * Extracted from `src/services/agentService.ts` as part of Phase 3e god-file
 * decomposition. Bodies preserved verbatim.
 *
 * Consumers should import from here, not from `agentService.ts`.
 */

import { supabase } from '../../substrates/supabase/client';
import { isValidUUID } from '../../substrates/supabase/query';
import type { ServiceResponse, ServiceListResponse } from '../../substrates/supabase/query';
import type { ScheduledPost, ScheduledPostStatus } from '../../contracts/agent/agent-tables.contract';

/** Fetch scheduled posts, optionally filtered by status */
export async function getScheduledPosts(
  businessAccountId: string,
  status?: ScheduledPostStatus | 'all',
  limit = 50,
): Promise<ServiceListResponse<ScheduledPost>> {
  if (!isValidUUID(businessAccountId)) {
    return { success: false, data: [], error: 'Invalid businessAccountId format' };
  }
  try {
    let query = supabase
      .from('scheduled_posts')
      .select('*', { count: 'exact' })
      .eq('business_account_id', businessAccountId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;
    if (error) throw error;
    return { success: true, data: data ?? [], count: count ?? undefined };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('AgentService.getScheduledPosts failed:', msg);
    return { success: false, data: [], error: msg };
  }
}

/** Update a scheduled post's status (approve / reject / reset to pending) */
export async function updateScheduledPostStatus(
  postId: string,
  status: ScheduledPostStatus,
): Promise<ServiceResponse<ScheduledPost>> {
  if (!isValidUUID(postId)) {
    return { success: false, data: null, error: 'Invalid postId format' };
  }
  try {
    const { data, error } = await supabase
      .from('scheduled_posts')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', postId)
      .select()
      .single();
    if (error) throw error;
    return { success: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('AgentService.updateScheduledPostStatus failed:', msg);
    return { success: false, data: null, error: msg };
  }
}