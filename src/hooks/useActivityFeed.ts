/**
 * useActivityFeed.ts
 *
 * TanStack Query hook for activity feed (audit_log).
 * Uses Supabase Realtime (INSERT subscription) for live updates after initial fetch.
 * Filters by business_account_id client-side since it's stored in details JSONB, not a column.
 */

import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AgentService } from '../services/agentService'
import { supabase } from '../lib/supabase'
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
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useActivityFeed(businessAccountId: string | null): UseActivityFeedResult {
  const queryClient = useQueryClient()
  const [events, setEvents] = useState<AuditLogEntry[]>([])

  // ── Initial data fetch ───────────────────────────────────────────────────
  const { data: initialData, isLoading, error } = useQuery({
    queryKey: ['activity-feed', 'initial', businessAccountId],
    queryFn: async () => {
      const result = await AgentService.getAuditLog(50)
      if (!result.success) throw new Error(result.error ?? 'Failed to fetch audit log')
      return result.data
    },
    staleTime: Infinity, // Realtime subscription handles updates; no auto-refetch needed
  })

  // Set initial data once
  useEffect(() => {
    if (initialData) {
      const filtered = businessAccountId
        ? initialData.filter((e) => (e.details as Record<string, unknown>)?.business_account_id === businessAccountId)
        : initialData
      setEvents(filtered)
    }
  }, [initialData, businessAccountId])

  // ── Supabase Realtime subscription for INSERT events ───────────────────────
  useEffect(() => {
    if (!businessAccountId) return

    const channel = supabase
      .channel('audit-log-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'audit_log' },
        (payload) => {
          const newEntry = payload.new as AuditLogEntry
          const details = newEntry.details as Record<string, unknown> | null
          // Filter client-side since business_account_id is in JSONB, not a column
          if (details?.business_account_id !== businessAccountId) return
          setEvents((prev) => [newEntry, ...prev].slice(0, 50))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [businessAccountId])

  // ── Refetch handler ──────────────────────────────────────────────────────
  const refetch = useCallback(async () => {
    const result = await AgentService.getAuditLog(50)
    if (!result.success) throw new Error(result.error ?? 'Failed to fetch audit log')
    const filtered = businessAccountId
      ? result.data.filter((e) => (e.details as Record<string, unknown>)?.business_account_id === businessAccountId)
      : result.data
    setEvents(filtered)
  }, [businessAccountId])

  return {
    events,
    isLoading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    refetch,
  }
}
