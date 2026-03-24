/**
 * useAgentHealth.ts
 *
 * Polls agent liveness (backend route) and unresolved system alerts every 30s.
 * system_alerts use Supabase Realtime subscription for live INSERT/UPDATE notifications.
 * agentStatus is computed server-side via GET /api/instagram/agent/status (backend owns LIVENESS_THRESHOLD_MS).
 * heartbeats (legacy) is kept for backward compatibility with uptime calculation in AgentTerminalDashboard.
 */

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AgentService } from '../services/agentService'
import { supabase } from '../lib/supabase'
import type { AgentHeartbeat, AgentHeartbeatStatus, SystemAlert } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Result interface
// ─────────────────────────────────────────────────────────────────────────────

export interface UseAgentHealthResult {
  heartbeats:   AgentHeartbeat[]
  alerts:       SystemAlert[]
  /** 'alive' if newest heartbeat is ≤ 25min ago, otherwise 'down' — computed by backend */
  agentStatus:  AgentHeartbeatStatus
  isLoading:    boolean
  error:        string | null
  resolveAlert: (alertId: string) => Promise<void>
  refetch:      () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** @deprecated No longer used — backend owns LIVENESS_THRESHOLD_MS. kept for backward compat */
export const LIVENESS_THRESHOLD_MS = 25 * 60 * 1000
const POLL_INTERVAL_MS             = 30_000  // 30 seconds

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useAgentHealth(businessAccountId: string | null): UseAgentHealthResult {
  const queryClient = useQueryClient()

  // ── Agent status — computed server-side via backend (LIVENESS_THRESHOLD_MS owned by backend) ──
  const statusQuery = useQuery({
    queryKey: ['agent-health', 'status'],
    queryFn: async () => {
      const result = await AgentService.getAgentStatus()
      if (!result.success) throw new Error(result.error ?? 'Failed to fetch agent status')
      return result.data
    },
    refetchInterval:      POLL_INTERVAL_MS,
    staleTime:            POLL_INTERVAL_MS,
    gcTime:               2 * POLL_INTERVAL_MS,
    retry:                3,
    retryDelay:           (i) => Math.min(1000 * 2 ** i, 30_000),
    refetchOnWindowFocus: false,
  })

  // ── Heartbeats (legacy — kept for uptime calc in AgentTerminalDashboard) ──
  const heartbeatsQuery = useQuery({
    queryKey: ['agent-health', 'raw-heartbeats'],
    queryFn: async () => {
      const result = await AgentService.getHeartbeats(5)
      if (!result.success) throw new Error(result.error ?? 'Failed to fetch heartbeats')
      return result.data
    },
    refetchInterval:      POLL_INTERVAL_MS,
    staleTime:            POLL_INTERVAL_MS,
    gcTime:               2 * POLL_INTERVAL_MS,
    retry:                3,
    retryDelay:           (i) => Math.min(1000 * 2 ** i, 30_000),
    refetchOnWindowFocus: false,
  })

  // ── System alerts (unresolved only) ────────────────────────────────────────
  const alertsQuery = useQuery({
    queryKey: ['agent-health', 'alerts', businessAccountId],
    queryFn: async () => {
      if (!businessAccountId) return []
      const result = await AgentService.getSystemAlerts(businessAccountId, false)
      if (!result.success) throw new Error(result.error ?? 'Failed to fetch alerts')
      return result.data
    },
    enabled:              !!businessAccountId,
    refetchInterval:      POLL_INTERVAL_MS,
    staleTime:            POLL_INTERVAL_MS,
    gcTime:               2 * POLL_INTERVAL_MS,
    retry:                3,
    retryDelay:           (i) => Math.min(1000 * 2 ** i, 30_000),
    refetchOnWindowFocus: false,
  })

  // ── Agent status — from backend (single source of truth) ─────────────────
  const agentStatus: AgentHeartbeatStatus = statusQuery.data?.status ?? 'down'

  // ── Supabase Realtime subscription for system_alerts (INSERT + UPDATE) ────
  useEffect(() => {
    if (!businessAccountId) return

    const channel = supabase
      .channel('system-alerts-live')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'system_alerts',
          filter: `business_account_id=eq.${businessAccountId}`,
        },
        (payload) => {
          const newAlert = payload.new as SystemAlert
          queryClient.setQueryData<SystemAlert[]>(
            ['agent-health', 'alerts', businessAccountId],
            (prev) => [newAlert, ...(prev ?? [])]
          )
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'system_alerts',
          filter: `business_account_id=eq.${businessAccountId}`,
        },
        (payload) => {
          const updated = payload.new as SystemAlert
          queryClient.setQueryData<SystemAlert[]>(
            ['agent-health', 'alerts', businessAccountId],
            (prev) => prev?.map((a) => (a.id === updated.id ? updated : a)) ?? []
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [businessAccountId, queryClient])

  // ── Resolve alert mutation ─────────────────────────────────────────────────
  const resolveAlert = async (alertId: string): Promise<void> => {
    const result = await AgentService.resolveAlert(alertId)
    if (!result.success) throw new Error(result.error ?? 'Failed to resolve alert')
    queryClient.setQueryData<SystemAlert[]>(
      ['agent-health', 'alerts', businessAccountId],
      (prev) => prev?.filter((a) => a.id !== alertId) ?? []
    )
  }

  // ── Combined error ─────────────────────────────────────────────────────────
  const error =
    statusQuery.error
      ? (statusQuery.error instanceof Error ? statusQuery.error.message : String(statusQuery.error))
      : alertsQuery.error
        ? (alertsQuery.error instanceof Error ? alertsQuery.error.message : String(alertsQuery.error))
        : null

  return {
    heartbeats:   heartbeatsQuery.data ?? [],
    alerts:       alertsQuery.data ?? [],
    agentStatus,
    isLoading:   statusQuery.isLoading || heartbeatsQuery.isLoading || alertsQuery.isLoading,
    error,
    resolveAlert,
    refetch: () => {
      statusQuery.refetch()
      heartbeatsQuery.refetch()
      alertsQuery.refetch()
    },
  }
}
