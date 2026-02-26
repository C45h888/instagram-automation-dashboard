/**
 * TerminalStatusBar.tsx
 *
 * Fixed top bar showing agent health, alerts, and queue counts.
 * Single-line monospace display — pure presentational component.
 */

interface TerminalStatusBarProps {
  agentStatus: 'alive' | 'down'
  uptime: string
  activeTaskCount: number
  alertCount: number
  queuedCount: number
  isLoading: boolean
}

export default function TerminalStatusBar({
  agentStatus,
  uptime,
  activeTaskCount,
  alertCount,
  queuedCount,
  isLoading,
}: TerminalStatusBarProps) {
  const now = new Date()
  const timestamp = now.toISOString().replace('T', ' ').slice(0, 19) + ' UTC'

  if (isLoading) {
    return (
      <div className="flex items-center justify-between px-4 py-1 bg-terminal-bg-alt border-b border-terminal-border min-h-[28px]">
        <span className="text-terminal-dim">loading agent status...</span>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between px-4 py-1 bg-terminal-bg-alt border-b border-terminal-border min-h-[28px] select-none">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Agent status badge */}
        <span className={agentStatus === 'alive' ? 'terminal-status-alive font-bold' : 'terminal-status-down font-bold'}>
          [{agentStatus === 'alive' ? 'ALIVE' : 'DOWN'}]
        </span>

        <span className="text-terminal-dim">|</span>

        {/* Uptime */}
        <span className="text-terminal-cyan">
          Uptime: <span className="text-terminal-green">{uptime}</span>
        </span>

        <span className="text-terminal-dim">|</span>

        {/* Active tasks */}
        <span className="text-terminal-cyan">
          Active: <span className={activeTaskCount > 0 ? 'text-terminal-yellow' : 'text-terminal-dim'}>{activeTaskCount}</span>
        </span>

        <span className="text-terminal-dim">|</span>

        {/* Alerts */}
        <span className="text-terminal-cyan">
          Alerts: <span className={alertCount > 0 ? 'text-terminal-red font-bold' : 'text-terminal-dim'}>{alertCount}</span>
        </span>

        <span className="text-terminal-dim">|</span>

        {/* Queued */}
        <span className="text-terminal-cyan">
          Queued: <span className={queuedCount > 0 ? 'text-terminal-yellow' : 'text-terminal-dim'}>{queuedCount}</span>
        </span>
      </div>

      {/* Timestamp */}
      <span className="text-terminal-dim hidden md:inline">{timestamp}</span>
    </div>
  )
}
