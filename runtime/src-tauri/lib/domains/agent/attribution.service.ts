/**
 * domains/agent/attribution.service.ts
 *
 * Attribution review queue + attribution model weights.
 * Extracted from `src/services/agentService.ts` as part of Phase 3e god-file
 * decomposition. Bodies preserved verbatim.
 *
 * Consumers should import from here, not from `agentService.ts`.
 */

import {
  queryAttributionReviewQueue,
  updateAttributionReview,
  queryAttributionModel,
} from '../../substrates/supabase/query';
import type { ServiceResponse, ServiceListResponse } from '../../substrates/supabase/query';
import type {
  AttributionModel,
  AttributionReview,
  AttributionReviewStatus,
} from '../../contracts/agent/agent-tables.contract';

/** Fetch the human review queue for sales attributions.
 *  Substrate: substrates/supabase/query.ts → queryAttributionReviewQueue */
export async function getAttributionQueue(
  businessAccountId: string,
  reviewStatus?: AttributionReviewStatus | 'all',
): Promise<ServiceListResponse<AttributionReview>> {
  return queryAttributionReviewQueue(businessAccountId, reviewStatus);
}

/** Submit a review decision on a pending attribution.
 *  Substrate: substrates/supabase/query.ts → updateAttributionReview */
export async function reviewAttribution(
  reviewId: string,
  status: AttributionReviewStatus,
  reviewedBy: string,
): Promise<ServiceResponse<AttributionReview>> {
  return updateAttributionReview(reviewId, status, reviewedBy);
}

/** Fetch the current attribution model weights for a business account.
 *  Substrate: substrates/supabase/query.ts → queryAttributionModel */
export async function getAttributionModel(
  businessAccountId: string,
): Promise<ServiceResponse<AttributionModel>> {
  return queryAttributionModel(businessAccountId);
}