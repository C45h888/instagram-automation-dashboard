/**
 * ActivityFeedPanel.tsx
 *
 * Left sidebar panel displaying activity feed (audit log).
 * Shows reverse-chronological list of agent operations.
 */

import { useMemo } from 'react'
import type { AuditLogEntry } from '@/types'

interface ActivityFeedPanelProps {
  events: AuditLogEntry[]
  isLoading: boolean
  error: string | null
}

/** Get color class for event type */
function getEventColor(eventType: string | null): string {
  if (!eventType) return 'text-terminal-dim'

  switch (eventType) {
    case 'post_published':
      return 'text-terminal-green'
    case 'comment_replied':
    case 'dm_sent':
      return 'text-terminal-cyan'
    case 'ugc_reposted':
      return 'text-terminal-yellow'
    case 'post_failed_permanent':
    case 'auth_failure':
      return 'text-terminal-red'
    default:
      return 'text-terminal-dim'
  }
}

/** Format timestamp to HH:MM:SS */
function formatTime(timestamp: string | null): string {
  if (!timestamp) return '--:--:--'
  try {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', { hour12: false })
  } catch {
    return '--:--:--'
  }
}

/** Format event for display */
function formatEvent(event: AuditLogEntry): string {
  const eventType = event.event_type ?? 'unknown'
  const resourceId = event.resource_id ?? ''
  const details = event.details as Record<string, unknown> | null

  switch (eventType) {
    case 'post_published':
      return `Post published media#${resourceId.slice(0, 8)}`
    case 'comment_replied':
      return `Comment replied media#${resourceId.slice(0, 8)}`
    case 'dm_sent':
      return `DM sent to @${details?.recipient_username ?? 'unknown'}`
    case 'ugc_reposted':
      return `UGC discovered post#${resourceId.slice(0, 8)}`
    case 'post_failed_permanent':
      return `Post failed permanently media#${resourceId.slice(0, 8)}`
    case 'auth_failure':
      return `Auth failure for account#${resourceId.slice(0, 8)}`
    default:
      return `${eventType} ${resourceId.slice(0, 8)}`
  }
}

export default function ActivityFeedPanel({
  events,
  isLoading,
  error,
}: ActivityFeedPanelProps) {
  // Sort events by timestamp (newest first)
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0
      return timeB - timeA
    })
  }, [events])

  // Loading state
  if (isLoading && events.length === 0) {
    return (
      <div className="h-full p-3">
        <div className="text-terminal-dim text-xs mb-2">-- ACTIVITY FEED --</div>
        <div className="text-terminal-dim text-xs animate-pulse">loading...</div>
      </div>
    )
  }

  // Error state
  if (error && events.length === 0) {
    return (
      <div className="h-full p-3">
        <div className="text-terminal-dim text-xs mb-2">-- ACTIVITY FEED --</div>
        <div className="text-terminal-red text-xs">[ERROR] {error}</div>
      </div>
    )
  }

  return (
    <div className="h-full p-3 overflow-y-auto terminal-scroll">
      {/* Header */}
      <div className="text-terminal-dim text-xs mb-2">-- ACTIVITY FEED --</div>

      {/* Events list */}
      {sortedEvents.length === 0 ? (
        <div className="text-terminal-dim text-xs">no recent activity</div>
      ) : (
        <div className="space-y-1">
          {sortedEvents.map((event, index) => {
            const time = formatTime(event.created_at)
            const eventText = formatEvent(event)
            const eventColor = getEventColor(event.event_type)
            const isError = event.success === false || 
              event.event_type === 'post_failed_permanent' || 
              event.event_type === 'auth_failure'

            return (
              <div key={`${event.id}-${index}`} className="text-xs font-mono">
                <span className="text-terminal-dim">[{time}]</span>{' '}
                <span className={isError ? 'text-terminal-red' : eventColor}>
                  {eventText}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
