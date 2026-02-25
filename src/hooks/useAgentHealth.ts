/**
 * useAgentHealth.ts
 *
 * Polls agent liveness and unresolved system alerts every 30s.
 * Derives agentStatus ('alive' | 'down') client-side by checking whether
 * the most recent heartbeat's last_beat_at is within the last 60 seconds.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AgentService } from '../services/agentService'
import type { AgentHeartbeat, AgentHeartbeatStatus, SystemAlert } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Result interface
// ─────────────────────────────────────────────────────────────────────────────

export interface UseAgentHealthResult {
  heartbeats:   AgentHeartbeat[]
  alerts:       SystemAlert[]
  /** 'alive' if newest heartbeat is ≤ 60s ago, otherwise 'down' */
  agentStatus:  AgentHeartbeatStatus
  isLoading:    boolean
  error:        string | null
  resolveAlert: (alertId: string) => Promise<void>
  refetch:      () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const LIVENESS_THRESHOLD_MS = 60_000  // 60 seconds
const POLL_INTERVAL_MS      = 30_000  // 30 seconds

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useAgentHealth(businessAccountId: string | null): UseAgentHealthResult {
  const queryClient = useQueryClient()

  // ── Heartbeats (no business_account_id filter — agent_heartbeats has none) ─
  const heartbeatsQuery = useQuery({
    queryKey: ['agent-health', 'heartbeats'],
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

  // ── Derive agentStatus ─────────────────────────────────────────────────────
  const heartbeats = heartbeatsQuery.data ?? []
  const newestBeat = heartbeats[0]?.last_beat_at
  const agentStatus: AgentHeartbeatStatus = newestBeat
    ? Date.now() - new Date(newestBeat).getTime() <= LIVENESS_THRESHOLD_MS
      ? 'alive'
      : 'down'
    : 'down'

  // ── Resolve alert mutation ─────────────────────────────────────────────────
  const resolveAlert = async (alertId: string): Promise<void> => {
    const result = await AgentService.resolveAlert(alertId)
    if (!result.success) throw new Error(result.error ?? 'Failed to resolve alert')
    // Optimistic: remove from cache immediately, then refetch
    queryClient.setQueryData<SystemAlert[]>(
      ['agent-health', 'alerts', businessAccountId],
      (prev) => prev?.filter((a) => a.id !== alertId) ?? []
    )
  }

  // ── Combined error ─────────────────────────────────────────────────────────
  const error =
    heartbeatsQuery.error
      ? (heartbeatsQuery.error instanceof Error ? heartbeatsQuery.error.message : String(heartbeatsQuery.error))
      : alertsQuery.error
        ? (alertsQuery.error instanceof Error ? alertsQuery.error.message : String(alertsQuery.error))
        : null

  return {
    heartbeats,
    alerts:      alertsQuery.data ?? [],
    agentStatus,
    isLoading:   heartbeatsQuery.isLoading || alertsQuery.isLoading,
    error,
    resolveAlert,
    refetch: () => {
      heartbeatsQuery.refetch()
      alertsQuery.refetch()
    },
  }
}
