/**
 * domains/agent/scheduled-posts.service.ts
 *
 * Scheduled posts — fetch and update status.
 * Extracted from `src/services/agentService.ts` as part of Phase 3e god-file
 * decomposition. Bodies preserved verbatim.
 *
 * Consumers should import from here, not from `agentService.ts`.
 */

import {
  queryScheduledPosts,
  updateScheduledPostRowStatus,
} from '../../substrates/supabase/query';
import type { ServiceResponse, ServiceListResponse } from '../../substrates/supabase/query';
import type { ScheduledPost, ScheduledPostStatus } from '../../contracts/agent/agent-tables.contract';

/** Fetch scheduled posts, optionally filtered by status.
 *  Substrate: substrates/supabase/query.ts → queryScheduledPosts */
export async function getScheduledPosts(
  businessAccountId: string,
  status?: ScheduledPostStatus | 'all',
  limit = 50,
): Promise<ServiceListResponse<ScheduledPost>> {
  return queryScheduledPosts(businessAccountId, status, limit);
}

/** Update a scheduled post's status (approve / reject / reset to pending).
 *  Substrate: substrates/supabase/query.ts → updateScheduledPostRowStatus */
export async function updateScheduledPostStatus(
  postId: string,
  status: ScheduledPostStatus,
): Promise<ServiceResponse<ScheduledPost>> {
  return updateScheduledPostRowStatus(postId, status);
}