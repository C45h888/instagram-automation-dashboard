/**
 * MetricsOverviewPanel.tsx
 *
 * 4th panel displaying agent-generated analytics metrics.
 * Shows daily report KPIs, top performing content, revenue attribution, and AI insights.
 * Follows terminal monospace aesthetic with compact dense layout.
 */

import { useMemo } from 'react'
import { useAnalyticsReports } from '@/hooks/useAnalyticsReports'
import type {
  AnalyticsReport,
  InstagramReportMetrics,
  MediaReportMetrics,
  RevenueReportMetrics,
  ReportInsights,
  HistoricalComparison,
} from '@/types'

interface MetricsOverviewPanelProps {
  businessAccountId: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting Helpers (local to component - no global utils in repo yet)
// ─────────────────────────────────────────────────────────────────────────────

function formatCompact(num: number | undefined): string {
  if (num === undefined || num === null) return '--'
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M'
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K'
  return num.toLocaleString()
}

function formatPercent(num: number | undefined): string {
  if (num === undefined || num === null) return '--'
  return (num * 100).toFixed(1) + '%'
}

function formatCurrency(num: number | undefined): string {
  if (num === undefined || num === null) return '--'
  return '$' + Math.round(num).toLocaleString()
}

// ─────────────────────────────────────────────────────────────────────────────
// Color Helpers (pattern matched from QueueMonitorPanel.tsx)
// ─────────────────────────────────────────────────────────────────────────────

function getTrendColor(changePct: number): string {
  if (changePct > 0) return 'text-terminal-green'
  if (changePct < 0) return 'text-terminal-red'
  return 'text-terminal-dim'
}

function getTrendSymbol(changePct: number): string {
  if (changePct > 0) return '↑'
  if (changePct < 0) return '↓'
  return '→'
}

function getEngagementColor(rate: number | undefined): string {
  if (rate === undefined) return 'text-terminal-dim'
  if (rate >= 0.05) return 'text-terminal-green'      // 5%+ is good
  if (rate >= 0.03) return 'text-terminal-yellow'     // 3-5% is warning
  return 'text-terminal-red'                          // <3% needs attention
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function MetricsOverviewPanel({
  businessAccountId,
}: MetricsOverviewPanelProps) {
  const { latestDaily, latestWeekly, isLoading, error } = useAnalyticsReports(
    businessAccountId,
    2 // limit=2 for lightweight query
  )

  // Cast JSONB fields to typed interfaces (safe with optional chaining)
  const instaMetrics = latestDaily?.instagram_metrics as InstagramReportMetrics | undefined
  const mediaMetrics = latestDaily?.media_metrics as MediaReportMetrics | undefined
  const revenueMetrics = latestDaily?.revenue_metrics as RevenueReportMetrics | undefined
  const insights = latestDaily?.insights as ReportInsights | undefined
  const comparison = latestDaily?.historical_comparison as HistoricalComparison | undefined

  // Get top performing post (first in array)
  const topPost = mediaMetrics?.top_performing?.[0]

  // Get first 2 insights (if available)
  const keyInsights = insights?.key_findings?.slice(0, 2) ?? []

  // Get engagement trend from comparison
  const engagementChange = comparison?.changes?.avg_engagement_rate?.change_pct ?? 0

  // ── Loading State (matches QueueMonitorPanel.tsx pattern) ─────────────────
  if (isLoading && !latestDaily) {
    return (
      <div className="h-full p-3">
        <div className="text-terminal-dim text-xs mb-2">-- METRICS OVERVIEW --</div>
        <div className="text-terminal-dim text-xs animate-pulse">loading...</div>
      </div>
    )
  }

  // ── Error State (matches QueueMonitorPanel.tsx pattern) ───────────────────
  if (error && !latestDaily) {
    return (
      <div className="h-full p-3">
        <div className="text-terminal-dim text-xs mb-2">-- METRICS OVERVIEW --</div>
        <div className="text-terminal-red text-xs">[ERROR] {error}</div>
      </div>
    )
  }

  // ── Empty State ──────────────────────────────────────────────────────────
  if (!latestDaily) {
    return (
      <div className="h-full p-3">
        <div className="text-terminal-dim text-xs mb-2">-- METRICS OVERVIEW --</div>
        <div className="text-terminal-dim text-xs">
          no reports yet -- waiting for nightly scheduler
        </div>
        <div className="text-terminal-dim text-xs mt-2">
          [scheduler runs at 02:00 UTC]
        </div>
      </div>
    )
  }

  // ── Main Render ───────────────────────────────────────────────────────────
  return (
    <div className="h-full p-3 overflow-y-auto terminal-scroll">
      {/* Header */}
      <div className="text-terminal-dim text-xs mb-2">-- METRICS OVERVIEW --</div>

      {/* Daily Report Date */}
      <div className="text-terminal-cyan text-xs mb-2">
        Daily:{' '}
        <span className="text-terminal-green">
          {new Date(latestDaily.report_date).toISOString().split('T')[0]}
        </span>
      </div>

      {/* Account KPIs Grid */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-1 mb-3">
        <div className="text-xs">
          <span className="text-terminal-cyan">Imp:</span>{' '}
          <span className="text-terminal-green">
            {formatCompact(instaMetrics?.impressions)}
          </span>
        </div>
        <div className="text-xs">
          <span className="text-terminal-cyan">Reach:</span>{' '}
          <span className="text-terminal-green">
            {formatCompact(instaMetrics?.reach)}
          </span>
        </div>
        <div className="text-xs">
          <span className="text-terminal-cyan">Eng:</span>{' '}
          <span className={getEngagementColor(instaMetrics?.avg_engagement_rate)}>
            {formatPercent(instaMetrics?.avg_engagement_rate)}
            {engagementChange !== 0 && (
              <span className={`ml-1 ${getTrendColor(engagementChange)}`}>
                {getTrendSymbol(engagementChange)}
              </span>
            )}
          </span>
        </div>
        <div className="text-xs">
          <span className="text-terminal-cyan">Foll:</span>{' '}
          <span className="text-terminal-green">
            {formatCompact(instaMetrics?.followers_count)}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="text-terminal-dim text-xs mb-2">────────────────────</div>

      {/* Top Performing Post */}
      {topPost ? (
        <div className="mb-3">
          <div className="text-terminal-cyan text-xs mb-1">Top Post:</div>
          <div className="text-xs font-mono">
            <span className="text-terminal-dim">
              media#{topPost.media_id.slice(0, 8)}...
            </span>
          </div>
          <div className="text-xs">
            <span className="text-terminal-cyan">Eng:</span>{' '}
            <span className="text-terminal-green">
              {topPost.engagement.toLocaleString()}
            </span>
          </div>
        </div>
      ) : (
        <div className="mb-3 text-terminal-dim text-xs">no top post data</div>
      )}

      {/* Divider */}
      <div className="text-terminal-dim text-xs mb-2">────────────────────</div>

      {/* Revenue Metrics */}
      <div className="mb-3">
        <div className="grid grid-cols-2 gap-x-2 gap-y-1">
          <div className="text-xs">
            <span className="text-terminal-cyan">Rev:</span>{' '}
            <span className="text-terminal-green">
              {formatCurrency(revenueMetrics?.attributed_revenue)}
            </span>
          </div>
          <div className="text-xs">
            <span className="text-terminal-cyan">Conv:</span>{' '}
            <span className="text-terminal-green">
              {formatPercent(revenueMetrics?.conversion_rate)}
            </span>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="text-terminal-dim text-xs mb-2">────────────────────</div>

      {/* AI Insights */}
      {keyInsights.length > 0 ? (
        <div>
          <div className="text-terminal-cyan text-xs mb-1">Insights:</div>
          <ul className="space-y-1">
            {keyInsights.map((insight, idx) => (
              <li key={idx} className="text-xs text-terminal-dim leading-tight">
                • {insight}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="text-terminal-dim text-xs">no insights available</div>
      )}

      {/* Weekly Report Indicator (if available) */}
      {latestWeekly && (
        <div className="mt-3 pt-2 border-t border-terminal-border">
          <div className="text-terminal-dim text-xs">
            Weekly:{' '}
            <span className="text-terminal-cyan">
              {new Date(latestWeekly.report_date).toISOString().split('T')[0]}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
