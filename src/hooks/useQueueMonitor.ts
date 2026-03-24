/**
 * useQueueMonitor.ts
 *
 * TanStack Query hook for queue status and DLQ monitoring.
 * Single query (getQueueOverview) replaces the previous two independent pollers
 * (getQueueStatus at 15s + getQueueDLQ at 30s) that were hitting the same table
 * on different clocks and synchronizing every 30s into a double-fire.
 */

import { useCallback } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { AgentService } from '../services/agentService'
import type { QueueStatusSummary, QueueDLQItem, QueueOverview } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Result interface — unchanged, consumers see no diff
// ─────────────────────────────────────────────────────────────────────────────

export interface UseQueueMonitorResult {
  summary: QueueStatusSummary
  dlqItems: QueueDLQItem[]
  totalQueued: number
  totalDLQ: number
  isLoading: boolean
  error: string | null
  retryItem: (queueId: string) => Promise<void>
  isRetrying: boolean
  refetch: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 15_000  // one clock, one table scan

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useQueueMonitor(): UseQueueMonitorResult {
  const queryClient = useQueryClient()

  // ── Single combined query — histogram + DLQ derived from same 200-row fetch ─
  const overviewQuery = useQuery({
    queryKey: ['queue-monitor', 'overview'],
    queryFn: async () => {
      const result = await AgentService.getQueueOverview()
      if (!result.success) throw new Error(result.error ?? 'Failed to fetch queue overview')
      return result.data as QueueOverview
    },
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: POLL_INTERVAL_MS,
  })

  // ── Retry mutation ────────────────────────────────────────────────────────
  const retryMutation = useMutation({
    mutationFn: async (queueId: string) => {
      const result = await AgentService.retryQueueItem(queueId)
      if (!result.success) throw new Error(result.error ?? 'Failed to retry item')
      return result.data
    },
    onSuccess: (_, queueId) => {
      // Optimistically remove the retried item from cache so the UI updates instantly
      queryClient.setQueryData<QueueOverview>(['queue-monitor', 'overview'], (old) => {
        if (!old) return old
        return { ...old, dlqItems: old.dlqItems.filter((item) => item.id !== queueId) }
      })
      // Single invalidation — one refetch, one clock reset
      queryClient.invalidateQueries({ queryKey: ['queue-monitor', 'overview'] })
    },
  })

  // ── Derived values — same shape as before ────────────────────────────────
  const overview = overviewQuery.data
  const summary: QueueStatusSummary = {
    byKey:     overview?.byKey     ?? {},
    total:     overview?.total     ?? 0,
    timestamp: overview?.timestamp ?? new Date().toISOString(),
  }
  const dlqItems  = overview?.dlqItems ?? []
  const totalQueued = summary.total
  const totalDLQ    = dlqItems.length

  const error = overviewQuery.error
    ? overviewQuery.error instanceof Error
      ? overviewQuery.error.message
      : String(overviewQuery.error)
    : null

  // ── Retry handler ─────────────────────────────────────────────────────────
  const retryItem = useCallback(async (queueId: string): Promise<void> => {
    await retryMutation.mutateAsync(queueId)
  }, [retryMutation])

  // ── Refetch handler ───────────────────────────────────────────────────────
  const refetch = useCallback(() => {
    overviewQuery.refetch()
  }, [overviewQuery])

  return {
    summary,
    dlqItems,
    totalQueued,
    totalDLQ,
    isLoading: overviewQuery.isLoading,
    error,
    retryItem,
    isRetrying: retryMutation.isPending,
    refetch,
  }
}
