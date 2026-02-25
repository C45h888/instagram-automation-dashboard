/**
 * useAttributionQueue.ts
 *
 * Fetches the sales attribution human review queue alongside the
 * current attribution model weights for the business account.
 * Provides approve/reject mutations with optimistic cache updates.
 */

import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AgentService } from '../services/agentService'
import type {
  AttributionReview,
  AttributionReviewStatus,
  AttributionModel,
  AttributionFilterState,
  AttributionModelWeights,
} from '@/types'
import { DEFAULT_ATTRIBUTION_FILTERS } from '@/types'
import { useAuthStore } from '../stores/authStore'

/**
 * Fallback weights matching the Python agent's _DEFAULT_WEIGHTS.
 * Source of truth: weekly_attribution_learning.py:32-37 and
 * supabase_service.py:get_attribution_model_weights() default_weights.
 * Used when no attribution_models row exists for the business account.
 */
const FALLBACK_WEIGHTS: AttributionModelWeights = {
  first_touch: 0.20,
  last_touch:  0.40,
  linear:      0.20,
  time_decay:  0.20,
}

// ─────────────────────────────────────────────────────────────────────────────
// Result interface
// ─────────────────────────────────────────────────────────────────────────────

export interface UseAttributionQueueResult {
  queue:           AttributionReview[]
  model:           AttributionModel | null
  /** Agent default weights — use `model?.weights ?? fallbackWeights` when model is null */
  fallbackWeights: AttributionModelWeights
  isLoading:       boolean
  error:         string | null
  filters:       AttributionFilterState
  setFilters:    (f: AttributionFilterState) => void
  approveReview: (reviewId: string) => Promise<void>
  rejectReview:  (reviewId: string) => Promise<void>
  refetch:       () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useAttributionQueue(businessAccountId: string | null): UseAttributionQueueResult {
  const queryClient = useQueryClient()
  const { user }    = useAuthStore()
  const [filters, setFilters] = useState<AttributionFilterState>(DEFAULT_ATTRIBUTION_FILTERS)

  // ── Attribution review queue ───────────────────────────────────────────────
  const queueQuery = useQuery({
    queryKey: ['attribution-queue', businessAccountId, filters.review_status],
    queryFn: async () => {
      if (!businessAccountId) return []

      const result = await AgentService.getAttributionQueue(
        businessAccountId,
        filters.review_status
      )
      if (!result.success) throw new Error(result.error ?? 'Failed to fetch attribution queue')

      let items = result.data as AttributionReview[]

      // Client-side fraud_risk filter (if enabled)
      if (filters.fraud_risk !== 'all') {
        items = items.filter((r) => r.fraud_risk === filters.fraud_risk)
      }

      return items
    },
    enabled:              !!businessAccountId,
    staleTime:            5 * 60 * 1000,
    gcTime:               10 * 60 * 1000,
    retry:                3,
    retryDelay:           (i) => Math.min(1000 * 2 ** i, 30_000),
    refetchOnWindowFocus: false,
  })

  // ── Attribution model ──────────────────────────────────────────────────────
  const modelQuery = useQuery({
    queryKey: ['attribution-queue', 'model', businessAccountId],
    queryFn: async () => {
      if (!businessAccountId) return null
      const result = await AgentService.getAttributionModel(businessAccountId)
      // PGRST116 = no row found — not an error for the UI
      if (!result.success && result.error === 'No model found') return null
      if (!result.success) throw new Error(result.error ?? 'Failed to fetch attribution model')
      return result.data
    },
    enabled:              !!businessAccountId,
    staleTime:            10 * 60 * 1000,
    gcTime:               20 * 60 * 1000,
    retry:                2,
    retryDelay:           (i) => Math.min(1000 * 2 ** i, 30_000),
    refetchOnWindowFocus: false,
  })

  // ── Queue query key (for cache updates) ───────────────────────────────────
  const queueQueryKey = ['attribution-queue', businessAccountId, filters.review_status] as const

  // ── Review mutation helper ─────────────────────────────────────────────────
  const submitReview = useCallback(
    async (reviewId: string, status: AttributionReviewStatus): Promise<void> => {
      const reviewedBy = user?.email ?? user?.id ?? 'dashboard_user'
      const result = await AgentService.reviewAttribution(reviewId, status, reviewedBy)
      if (!result.success) throw new Error(result.error ?? 'Failed to submit review')

      // Optimistic: update status in cache without a full refetch
      queryClient.setQueryData<AttributionReview[]>(queueQueryKey, (prev) =>
        prev?.map((r) => r.id === reviewId ? { ...r, review_status: status } : r) ?? []
      )
    },
    [queryClient, queueQueryKey, user]
  )

  const approveReview = useCallback(
    (reviewId: string) => submitReview(reviewId, 'approved'),
    [submitReview]
  )

  const rejectReview = useCallback(
    (reviewId: string) => submitReview(reviewId, 'rejected'),
    [submitReview]
  )

  // ── Error ──────────────────────────────────────────────────────────────────
  const error =
    queueQuery.error
      ? (queueQuery.error instanceof Error ? queueQuery.error.message : String(queueQuery.error))
      : modelQuery.error
        ? (modelQuery.error instanceof Error ? modelQuery.error.message : String(modelQuery.error))
        : null

  return {
    queue:           queueQuery.data ?? [],
    model:           modelQuery.data ?? null,
    fallbackWeights: FALLBACK_WEIGHTS,
    isLoading:       queueQuery.isLoading || modelQuery.isLoading,
    error,
    filters,
    setFilters,
    approveReview,
    rejectReview,
    refetch: () => {
      queueQuery.refetch()
      modelQuery.refetch()
    },
  }
}
