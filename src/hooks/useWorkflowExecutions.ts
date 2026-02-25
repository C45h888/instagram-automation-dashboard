/**
 * useWorkflowExecutions.ts
 *
 * Fetches automation_workflows and their executions.
 * - workflows: useQuery (no pagination needed — workflows are few)
 * - executions: useInfiniteQuery (accumulate via infinite scroll)
 * - Real-time INSERT subscription via useRef channel prepends new executions
 * - WorkflowExecutionSummary computed via useMemo
 */

import { useMemo, useEffect, useRef } from 'react'
import {
  useQuery,
  useInfiniteQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type {
  AutomationWorkflow,
  WorkflowExecution,
  WorkflowExecutionSummary,
  WorkflowFilterState,
} from '@/types'
import { DEFAULT_WORKFLOW_FILTERS } from '@/types'
import { useState } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

// ─────────────────────────────────────────────────────────────────────────────
// Result interface
// ─────────────────────────────────────────────────────────────────────────────

export interface UseWorkflowExecutionsResult {
  workflows:     AutomationWorkflow[]
  executions:    WorkflowExecution[]
  summary:       WorkflowExecutionSummary
  isLoading:     boolean
  error:         string | null
  filters:       WorkflowFilterState
  setFilters:    (f: WorkflowFilterState) => void
  hasNextPage:   boolean
  fetchNextPage: () => void
  refetch:       () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useWorkflowExecutions(
  businessAccountId: string | null,
  workflowId?: string | null
): UseWorkflowExecutionsResult {
  const queryClient = useQueryClient()
  const channelRef  = useRef<RealtimeChannel | null>(null)
  const [filters, setFilters] = useState<WorkflowFilterState>(DEFAULT_WORKFLOW_FILTERS)

  // ── Workflows query ────────────────────────────────────────────────────────
  const workflowsQuery = useQuery({
    queryKey: ['workflow-executions', 'workflows', businessAccountId],
    queryFn: async () => {
      if (!businessAccountId) return []
      let query = supabase
        .from('automation_workflows')
        .select('*')
        .eq('business_account_id', businessAccountId)
        .order('created_at', { ascending: false })

      if (filters.status !== 'all') query = query.eq('status', filters.status)
      if (filters.type !== 'all')   query = query.eq('automation_type', filters.type)
      if (filters.search)           query = query.ilike('name', `%${filters.search}%`)

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as AutomationWorkflow[]
    },
    enabled:              !!businessAccountId,
    staleTime:            2 * 60 * 1000,
    gcTime:               5 * 60 * 1000,
    retry:                3,
    retryDelay:           (i) => Math.min(1000 * 2 ** i, 30_000),
    refetchOnWindowFocus: false,
  })

  // ── Executions infinite query ──────────────────────────────────────────────
  const executionsQuery = useInfiniteQuery({
    queryKey: ['workflow-executions', 'executions', businessAccountId, workflowId],
    queryFn: async ({ pageParam = 0 }) => {
      const from = (pageParam as number) * PAGE_SIZE
      const to   = from + PAGE_SIZE - 1

      let query = supabase
        .from('workflow_executions')
        .select('*', { count: 'exact' })
        .order('started_at', { ascending: false })
        .range(from, to)

      if (workflowId)         query = query.eq('workflow_id', workflowId)
      else if (businessAccountId) query = query.eq('business_account_id', businessAccountId)

      const { data, error, count } = await query
      if (error) throw error

      return {
        items:    (data ?? []) as WorkflowExecution[],
        total:    count ?? 0,
        nextPage: (from + PAGE_SIZE) < (count ?? 0) ? (pageParam as number) + 1 : undefined,
      }
    },
    initialPageParam:  0,
    getNextPageParam:  (lastPage) => lastPage.nextPage,
    enabled:           !!businessAccountId,
    staleTime:         60 * 1000,
    gcTime:            5 * 60 * 1000,
    retry:             3,
    retryDelay:        (i) => Math.min(1000 * 2 ** i, 30_000),
    refetchOnWindowFocus: false,
  })

  // ── Flatten pages ──────────────────────────────────────────────────────────
  const executions = useMemo(
    () => executionsQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [executionsQuery.data]
  )

  // ── Execution summary ──────────────────────────────────────────────────────
  const summary = useMemo<WorkflowExecutionSummary>(() => {
    if (executions.length === 0) {
      return { total: 0, successful: 0, failed: 0, avgTime_ms: 0 }
    }
    const successful = executions.filter((e) => e.status === 'completed').length
    const failed     = executions.filter((e) => e.status === 'failed').length
    const times      = executions
      .filter((e) => e.duration_ms != null)
      .map((e) => e.duration_ms as number)
    const avgTime_ms = times.length > 0
      ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
      : 0
    return { total: executions.length, successful, failed, avgTime_ms }
  }, [executions])

  // ── Real-time INSERT subscription ──────────────────────────────────────────
  useEffect(() => {
    if (!businessAccountId) return

    let mounted = true

    const channelName = workflowId
      ? `exec-realtime-${workflowId}`
      : `exec-realtime-${businessAccountId}`

    const filter = workflowId
      ? `workflow_id=eq.${workflowId}`
      : `business_account_id=eq.${businessAccountId}`

    channelRef.current = supabase
      .channel(channelName)
      .on<WorkflowExecution>(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'workflow_executions', filter },
        (payload) => {
          if (!mounted) return
          // Prepend new execution to the first page
          queryClient.setQueryData(
            ['workflow-executions', 'executions', businessAccountId, workflowId],
            (old: typeof executionsQuery.data) => {
              if (!old) return old
              const firstPage = old.pages[0]
              return {
                ...old,
                pages: [
                  { ...firstPage, items: [payload.new, ...firstPage.items] },
                  ...old.pages.slice(1),
                ],
              }
            }
          )
        }
      )
      .subscribe()

    return () => {
      mounted = false
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [businessAccountId, workflowId, queryClient])

  // ── Error ──────────────────────────────────────────────────────────────────
  const error =
    workflowsQuery.error
      ? (workflowsQuery.error instanceof Error ? workflowsQuery.error.message : String(workflowsQuery.error))
      : executionsQuery.error
        ? (executionsQuery.error instanceof Error ? executionsQuery.error.message : String(executionsQuery.error))
        : null

  return {
    workflows:     workflowsQuery.data ?? [],
    executions,
    summary,
    isLoading:     workflowsQuery.isLoading || executionsQuery.isLoading,
    error,
    filters,
    setFilters,
    hasNextPage:   executionsQuery.hasNextPage ?? false,
    fetchNextPage: () => executionsQuery.fetchNextPage(),
    refetch: () => {
      workflowsQuery.refetch()
      executionsQuery.refetch()
    },
  }
}
