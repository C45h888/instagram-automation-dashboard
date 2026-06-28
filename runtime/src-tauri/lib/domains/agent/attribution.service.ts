/**
 * domains/agent/attribution.service.ts
 *
 * Attribution review queue + attribution model weights.
 * Extracted from `src/services/agentService.ts` as part of Phase 3e god-file
 * decomposition. Bodies preserved verbatim.
 *
 * Consumers should import from here, not from `agentService.ts`.
 */

import { supabase } from '../../substrates/supabase/client';
import { isValidUUID } from '../../substrates/supabase/query';
import type { ServiceResponse, ServiceListResponse } from '../../substrates/supabase/query';
import type {
  AttributionModel,
  AttributionReview,
  AttributionReviewStatus,
} from '../../contracts/agent/agent-tables.contract';

/** Fetch the human review queue for sales attributions */
export async function getAttributionQueue(
  businessAccountId: string,
  reviewStatus?: AttributionReviewStatus | 'all',
): Promise<ServiceListResponse<AttributionReview>> {
  if (!isValidUUID(businessAccountId)) {
    return { success: false, data: [], error: 'Invalid businessAccountId format' };
  }
  try {
    let query = supabase
      .from('attribution_review_queue')
      .select('*', { count: 'exact' })
      .eq('business_account_id', businessAccountId)
      .order('created_at', { ascending: false });

    if (reviewStatus && reviewStatus !== 'all') {
      query = query.eq('review_status', reviewStatus);
    }

    const { data, error, count } = await query;
    if (error) throw error;
    return { success: true, data: data ?? [], count: count ?? undefined };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('AgentService.getAttributionQueue failed:', msg);
    return { success: false, data: [], error: msg };
  }
}

/** Submit a review decision on a pending attribution */
export async function reviewAttribution(
  reviewId: string,
  status: AttributionReviewStatus,
  reviewedBy: string,
): Promise<ServiceResponse<AttributionReview>> {
  if (!isValidUUID(reviewId)) {
    return { success: false, data: null, error: 'Invalid reviewId format' };
  }
  try {
    const { data, error } = await supabase
      .from('attribution_review_queue')
      .update({
        review_status: status,
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', reviewId)
      .select()
      .single();
    if (error) throw error;
    return { success: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('AgentService.reviewAttribution failed:', msg);
    return { success: false, data: null, error: msg };
  }
}

/** Fetch the current attribution model weights for a business account */
export async function getAttributionModel(
  businessAccountId: string,
): Promise<ServiceResponse<AttributionModel>> {
  if (!isValidUUID(businessAccountId)) {
    return { success: false, data: null, error: 'Invalid businessAccountId format' };
  }
  try {
    const { data, error } = await supabase
      .from('attribution_models')
      .select('*')
      .eq('business_account_id', businessAccountId)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return { success: false, data: null, error: 'No model found' };
      throw error;
    }
    return { success: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('AgentService.getAttributionModel failed:', msg);
    return { success: false, data: null, error: msg };
  }
}