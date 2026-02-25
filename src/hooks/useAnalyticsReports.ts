/**
 * useAnalyticsReports.ts
 *
 * Fetches agent-generated analytics reports (daily + weekly).
 * Reports are agent-written via UPSERT so staleTime is 10 minutes.
 * Derives latestDaily and latestWeekly from the fetched list.
 */

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AgentService } from '../services/agentService'
import type { AnalyticsReport, ReportType } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Result interface
// ─────────────────────────────────────────────────────────────────────────────

export interface UseAnalyticsReportsResult {
  reports:       AnalyticsReport[]
  latestDaily:   AnalyticsReport | null
  latestWeekly:  AnalyticsReport | null
  isLoading:     boolean
  error:         string | null
  reportType:    ReportType | 'all'
  setReportType: (t: ReportType | 'all') => void
  refetch:       () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useAnalyticsReports(
  businessAccountId: string | null,
  limit = 30
): UseAnalyticsReportsResult {
  const [reportType, setReportType] = useState<ReportType | 'all'>('all')

  // ── Query ──────────────────────────────────────────────────────────────────
  const reportsQuery = useQuery({
    queryKey: ['analytics-reports', businessAccountId, reportType],
    queryFn: async () => {
      if (!businessAccountId) return []

      const result = await AgentService.getAnalyticsReports(
        businessAccountId,
        reportType === 'all' ? undefined : reportType,
        limit
      )
      if (!result.success) throw new Error(result.error ?? 'Failed to fetch analytics reports')
      return result.data as AnalyticsReport[]
    },
    enabled:              !!businessAccountId,
    staleTime:            10 * 60 * 1000,
    gcTime:               20 * 60 * 1000,
    retry:                3,
    retryDelay:           (i) => Math.min(1000 * 2 ** i, 30_000),
    refetchOnWindowFocus: false,
  })

  const reports = reportsQuery.data ?? []

  // ── Derived: most recent daily / weekly ───────────────────────────────────
  const { latestDaily, latestWeekly } = useMemo(() => {
    // Reports are already ordered by report_date DESC from AgentService
    const daily   = reports.find((r) => r.report_type === 'daily')   ?? null
    const weekly  = reports.find((r) => r.report_type === 'weekly')  ?? null
    return { latestDaily: daily, latestWeekly: weekly }
  }, [reports])

  // ── Error ──────────────────────────────────────────────────────────────────
  const error = reportsQuery.error
    ? (reportsQuery.error instanceof Error ? reportsQuery.error.message : String(reportsQuery.error))
    : null

  return {
    reports,
    latestDaily,
    latestWeekly,
    isLoading:  reportsQuery.isLoading,
    error,
    reportType,
    setReportType,
    refetch: () => reportsQuery.refetch(),
  }
}
