/**
 * useQueueMonitor.ts
 *
 * TanStack Query hook for queue status and DLQ monitoring.
 * Polls every 15s for status, 30s for DLQ.
 * Provides retry mutation for failed/DLQ items.
 */

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { AgentService } from '../services/agentService'
import type { QueueStatusSummary, QueueDLQItem } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Result interface
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

const STATUS_POLL_MS = 15_000  // 15 seconds
const DLQ_POLL_MS = 30_000     // 30 seconds

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useQueueMonitor(): UseQueueMonitorResult {
  const queryClient = useQueryClient()

  // ── Queue status query ────────────────────────────────────────────────────
  const statusQuery = useQuery({
    queryKey: ['queue-monitor', 'status'],
    queryFn: async () => {
      const result = await AgentService.getQueueStatus()
      if (!result.success) throw new Error(result.error ?? 'Failed to fetch queue status')
      return result.data
    },
    refetchInterval: STATUS_POLL_MS,
    staleTime: STATUS_POLL_MS,
  })

  // ── DLQ query ─────────────────────────────────────────────────────────────
  const dlqQuery = useQuery({
    queryKey: ['queue-monitor', 'dlq'],
    queryFn: async () => {
      const result = await AgentService.getQueueDLQ(50)
      if (!result.success) throw new Error(result.error ?? 'Failed to fetch DLQ')
      return result.data
    },
    refetchInterval: DLQ_POLL_MS,
    staleTime: DLQ_POLL_MS,
  })

  // ── Retry mutation ───────────────────────────────────────────────────────
  const retryMutation = useMutation({
    mutationFn: async (queueId: string) => {
      const result = await AgentService.retryQueueItem(queueId)
      if (!result.success) throw new Error(result.error ?? 'Failed to retry item')
      return result.data
    },
    onSuccess: (_, queueId) => {
      // Optimistically remove from DLQ cache immediately
      queryClient.setQueryData<QueueDLQItem[]>(['queue-monitor', 'dlq'], (old) =>
        old?.filter((item) => item.id !== queueId) ?? []
      )
      // Invalidate both queries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ['queue-monitor', 'status'] })
      queryClient.invalidateQueries({ queryKey: ['queue-monitor', 'dlq'] })
    },
  })

  // ── Derived values ───────────────────────────────────────────────────────
  const summary = statusQuery.data ?? { byKey: {}, total: 0, timestamp: new Date().toISOString() }
  const dlqItems = dlqQuery.data ?? []

  // Calculate totals from summary
  const totalQueued = summary.total ?? 0
  const totalDLQ = dlqItems.length

  // Combined error state
  const error = statusQuery.error
    ? statusQuery.error instanceof Error
      ? statusQuery.error.message
      : String(statusQuery.error)
    : dlqQuery.error
      ? dlqQuery.error instanceof Error
        ? dlqQuery.error.message
        : String(dlqQuery.error)
      : null

  // ── Retry handler ─────────────────────────────────────────────────────────
  const retryItem = async (queueId: string): Promise<void> => {
    await retryMutation.mutateAsync(queueId)
  }

  // ── Refetch handler ──────────────────────────────────────────────────────
  const refetch = () => {
    statusQuery.refetch()
    dlqQuery.refetch()
  }

  return {
    summary,
    dlqItems,
    totalQueued,
    totalDLQ,
    isLoading: statusQuery.isLoading || dlqQuery.isLoading,
    error,
    retryItem,
    isRetrying: retryMutation.isPending,
    refetch,
  }
}
