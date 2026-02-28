/**
 * useActivityFeed.ts
 *
 * TanStack Query hook for activity feed (audit_log).
 * Polls every 30s and filters client-side by business_account_id
 * (since audit_log stores it in details JSONB, not as a column).
 */

import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { AgentService } from '../services/agentService'
import type { AuditLogEntry } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Result interface
// ─────────────────────────────────────────────────────────────────────────────

export interface UseActivityFeedResult {
  events: AuditLogEntry[]
  isLoading: boolean
  error: string | null
  refetch: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 30_000 // 30 seconds

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useActivityFeed(businessAccountId: string | null): UseActivityFeedResult {
  // ── Raw audit log query ───────────────────────────────────────────────────
  const rawQuery = useQuery({
    queryKey: ['activity-feed', 'raw', businessAccountId],
    queryFn: async () => {
      const result = await AgentService.getAuditLog(50)
      if (!result.success) throw new Error(result.error ?? 'Failed to fetch audit log')
      return result.data
    },
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: POLL_INTERVAL_MS,
    enabled: true, // Always fetch, filter client-side
  })

  // ── Client-side filter by business_account_id in details JSONB ───────────
  const events = useMemo(() => {
    const rawEvents = rawQuery.data ?? []
    if (!businessAccountId) return rawEvents

    return rawEvents.filter((event) => {
      const details = event.details as Record<string, unknown> | null
      return details?.business_account_id === businessAccountId
    })
  }, [rawQuery.data, businessAccountId])

  // ── Error handling ─────────────────────────────────────────────────────────
  const error = rawQuery.error
    ? rawQuery.error instanceof Error
      ? rawQuery.error.message
      : String(rawQuery.error)
    : null

  // ── Refetch handler ─────────────────────────────────────────────────────────
  const refetch = () => {
    rawQuery.refetch()
  }

  return {
    events,
    isLoading: rawQuery.isLoading,
    error,
    refetch,
  }
}
