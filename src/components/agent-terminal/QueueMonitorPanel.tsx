/**
 * QueueMonitorPanel.tsx
 *
 * Right sidebar panel displaying queue status and DLQ items.
 * Shows summary counts by action_type × status, with retry capability.
 */

import { useMemo, type ReactNode } from 'react'
import type { QueueStatusSummary, QueueDLQItem } from '@/types'

interface QueueMonitorPanelProps {
  summary: QueueStatusSummary | null
  dlqItems: QueueDLQItem[]
  isLoading: boolean
  error: string | null
  onRetry: (queueId: string) => Promise<void>
  isRetrying: boolean
}

/** Parse summary byKey into structured data for display */
interface ParsedSummary {
  actionTypes: string[]
  byAction: Record<string, { pending: number; processing: number; sent: number; failed: number; dlq: number }>
}

function parseSummary(summary: QueueStatusSummary | null): ParsedSummary {
  const result: ParsedSummary = {
    actionTypes: [],
    byAction: {},
  }

  if (!summary?.byKey) return result

  const actionTypes = new Set<string>()

  for (const [key, count] of Object.entries(summary.byKey)) {
    const [actionType, status] = key.split('::')
    if (!actionType || !status) continue

    actionTypes.add(actionType)

    if (!result.byAction[actionType]) {
      result.byAction[actionType] = { pending: 0, processing: 0, sent: 0, failed: 0, dlq: 0 }
    }

    switch (status) {
      case 'pending':
        result.byAction[actionType].pending = count
        break
      case 'processing':
        result.byAction[actionType].processing = count
        break
      case 'sent':
        result.byAction[actionType].sent = count
        break
      case 'failed':
        result.byAction[actionType].failed = count
        break
      case 'dlq':
        result.byAction[actionType].dlq = count
        break
    }
  }

  result.actionTypes = Array.from(actionTypes).sort()

  return result
}

/** Get color class for status */
function getStatusColor(status: string, count: number): string {
  if (count === 0) return 'text-terminal-dim'
  switch (status) {
    case 'pending':
      return 'text-terminal-yellow'
    case 'processing':
      return 'text-terminal-cyan'
    case 'sent':
      return 'text-terminal-green'
    case 'failed':
      return 'text-terminal-red'
    case 'dlq':
      return 'text-terminal-red font-bold animate-blink-status'
    default:
      return 'text-terminal-dim'
  }
}

export default function QueueMonitorPanel({
  summary,
  dlqItems,
  isLoading,
  error,
  onRetry,
  isRetrying,
}: QueueMonitorPanelProps) {
  const parsed = useMemo(() => parseSummary(summary), [summary])

  // Loading state
  if (isLoading && !summary) {
    return (
      <div className="h-full p-3">
        <div className="text-terminal-dim text-xs mb-2">-- QUEUE MONITOR --</div>
        <div className="text-terminal-dim text-xs animate-pulse">loading...</div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="h-full p-3">
        <div className="text-terminal-dim text-xs mb-2">-- QUEUE MONITOR --</div>
        <div className="text-terminal-red text-xs">[ERROR] {error}</div>
      </div>
    )
  }

  return (
    <div className="h-full p-3 overflow-y-auto terminal-scroll">
      {/* Header */}
      <div className="text-terminal-dim text-xs mb-2">-- QUEUE MONITOR --</div>

      {/* Summary Table */}
      {parsed.actionTypes.length > 0 && (
        <div className="mb-4">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-terminal-dim">
                <th className="text-left py-1">action</th>
                <th className="text-right py-1">pending</th>
                <th className="text-right py-1">proc</th>
                <th className="text-right py-1">sent</th>
                <th className="text-right py-1">fail</th>
              </tr>
            </thead>
            <tbody>
              {parsed.actionTypes.map((action) => {
                const counts = parsed.byAction[action]
                return (
                  <tr key={action} className="text-terminal-green">
                    <td className="text-left py-0.5">{action}</td>
                    <td className={`text-right py-0.5 ${getStatusColor('pending', counts.pending)}`}>
                      {counts.pending}
                    </td>
                    <td className={`text-right py-0.5 ${getStatusColor('processing', counts.processing)}`}>
                      {counts.processing}
                    </td>
                    <td className={`text-right py-0.5 ${getStatusColor('sent', counts.sent)}`}>
                      {counts.sent}
                    </td>
                    <td className={`text-right py-0.5 ${getStatusColor('failed', counts.failed)}`}>
                      {counts.failed}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* DLQ Section */}
      <div className="mt-4">
        <div className="text-terminal-dim text-xs mb-2">-- DLQ ({dlqItems.length} items) --</div>

        {dlqItems.length === 0 ? (
          <div className="text-terminal-dim text-xs">no items in DLQ</div>
        ) : (
          <div className="space-y-1">
            {dlqItems.map((item) => {
              const errorDisplay = `err:${item.error_category ?? 'unknown'}`

              return (
                <div key={item.id} className="flex items-center justify-between text-xs font-mono">
                  <span className="text-terminal-dim">[{item.id.slice(0, 4)}]</span>
                  <span className="text-terminal-cyan flex-1 mx-2">{item.action_type}</span>
                  <span className="text-terminal-red mr-2">{errorDisplay}</span>
                  <button
                    onClick={() => !isRetrying && onRetry(item.id)}
                    disabled={isRetrying}
                    className={`text-terminal-underline ${
                      isRetrying ? 'text-terminal-dim' : 'text-terminal-cyan hover:text-terminal-green'
                    }`}
                  >
                    {isRetrying ? '[...]' : '[RETRY]'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Empty state */}
      {parsed.actionTypes.length === 0 && dlqItems.length === 0 && (
        <div className="text-terminal-dim text-xs">queue empty</div>
      )}
    </div>
  )
}
