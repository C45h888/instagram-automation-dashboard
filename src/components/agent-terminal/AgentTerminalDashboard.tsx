/**
 * AgentTerminalDashboard.tsx
 *
 * Root layout component for the agent terminal dashboard.
 * Full-screen overlay with 3-column CSS Grid (feed | chat | queue).
 * Responsive: sidebars collapse on smaller screens.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useAgentHealth } from '@/hooks/useAgentHealth'
import { useOversightChat } from '@/hooks/useOversightChat'
import { useQueueMonitor } from '@/hooks/useQueueMonitor'
import { useActivityFeed } from '@/hooks/useActivityFeed'
import ErrorBoundary from '@/components/ErrorBoundary'
import TerminalStatusBar from './TerminalStatusBar'
import TerminalInput from './TerminalInput'
import TerminalScrollArea from './TerminalScrollArea'
import ActivityFeedPanel from './ActivityFeedPanel'
import QueueMonitorPanel from './QueueMonitorPanel'
import MetricsOverviewPanel from './MetricsOverviewPanel'
import AnimatedSpiralBackground from './AnimatedSpiralBackground'
import SessionDropdown from './SessionDropdown'

type PanelView = 'chat' | 'feed' | 'queue' | 'metrics'

/** Hook to track previous value for comparison */
function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined)
  useEffect(() => { ref.current = value })
  return ref.current
}

export default function AgentTerminalDashboard() {
  const navigate = useNavigate()
  const { businessAccountId } = useAuthStore()

  // Core hooks
  const agentHealth = useAgentHealth(businessAccountId)
  const oversightChat = useOversightChat(businessAccountId)
  const queueMonitor = useQueueMonitor()
  const activityFeed = useActivityFeed(businessAccountId)

  // Panel visibility (responsive)
  const [activeView, setActiveView] = useState<PanelView>('chat')

  // Track previous message length for auto-scroll
  const prevMessageLength = usePrevious(oversightChat.messages.length)

  // Command history for keyboard navigation
  const [commandHistory, setCommandHistory] = useState<string[]>([])

  // Clear chat messages (Ctrl+L) — re-selects active session to reset scroll/display
  const handleClearScreen = useCallback(() => {
    if (!oversightChat.activeSession) return
    oversightChat.selectSession(oversightChat.activeSession.id)
  }, [oversightChat])

  // Derive uptime from heartbeats
  const uptime = useMemo(() => {
    const beats = agentHealth.heartbeats
    if (!beats.length) return '--'
    const oldest = beats[beats.length - 1]
    const ms = Date.now() - new Date(oldest.created_at ?? oldest.last_beat_at).getTime()
    const hours = Math.floor(ms / 3_600_000)
    const minutes = Math.floor((ms % 3_600_000) / 60_000)
    return `${hours}h ${minutes}m`
  }, [agentHealth.heartbeats])

  // Calculate active (processing) tasks from queue summary
  const activeTaskCount = useMemo(() => {
    const byKey = queueMonitor.summary.byKey
    if (!byKey) return 0
    // Count items with 'processing' status across all action types
    return Object.entries(byKey).reduce((total, [key, count]) => {
      if (key.endsWith('::processing')) {
        return total + count
      }
      return total
    }, 0)
  }, [queueMonitor.summary])

  // Handle chat submit
  const handleSubmit = useCallback(
    async (input: string) => {
      // Add to command history
      setCommandHistory((prev) => [...prev.slice(-99), input])

      if (!oversightChat.activeSession) {
        await oversightChat.startSession()
      }
      oversightChat.sendMessage(input)
    },
    [oversightChat]
  )

  // Close terminal → navigate back
  const handleClose = useCallback(() => {
    oversightChat.closeStream()
    navigate('/')
  }, [navigate, oversightChat])

  return (
    <div
      className="terminal-root fixed inset-0 z-[60] grid grid-rows-[auto_1fr_auto]"
    >
      {/* ── Animated Spiral Background ───────────────────────────────── */}
      <AnimatedSpiralBackground />

      {/* ── Top Status Bar ───────────────────────────────────────────── */}
      <header>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <TerminalStatusBar
              agentStatus={agentHealth.agentStatus}
              uptime={uptime}
              activeTaskCount={activeTaskCount}
              alertCount={agentHealth.alerts.length}
              queuedCount={queueMonitor.totalQueued}
              isLoading={agentHealth.isLoading || queueMonitor.isLoading}
            />
          </div>
          {/* Session picker */}
          <div className="border-b border-terminal-border bg-terminal-bg-alt">
            <SessionDropdown
              sessions={oversightChat.sessions}
              activeSession={oversightChat.activeSession}
              isStreaming={oversightChat.isStreaming}
              onSelect={oversightChat.selectSession}
              onNewSession={oversightChat.startSession}
            />
          </div>
          {/* Close button */}
          <button
            onClick={handleClose}
            className="px-3 py-1 text-terminal-dim hover:text-terminal-red bg-terminal-bg-alt border-b border-terminal-border transition-colors"
            title="Exit terminal (Esc)"
          >
            [X]
          </button>
        </div>
      </header>

      {/* ── Mobile Tab Bar (< 1024px) ────────────────────────────────── */}
      <div className="flex lg:hidden border-b border-terminal-border bg-terminal-bg-alt">
        {(['feed', 'chat', 'queue', 'metrics'] as const).map((view) => (
          <button
            key={view}
            onClick={() => setActiveView(view)}
            className={`flex-1 px-3 py-1 text-xs uppercase tracking-wider transition-colors ${
              activeView === view
                ? 'text-terminal-green border-b border-terminal-green'
                : 'text-terminal-dim hover:text-terminal-cyan'
            }`}
          >
            {view}
          </button>
        ))}
      </div>

      {/* ── Central Grid ─────────────────────────────────────────────── */}
      <div className="min-h-0 grid grid-cols-1 lg:grid-cols-[240px_1fr_240px_260px] xl:grid-cols-[280px_1fr_280px_260px] overflow-hidden">
        {/* Left Panel — Activity Feed */}
        <aside
          className={`border-r border-terminal-border bg-transparent overflow-hidden ${
            activeView === 'feed' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          <ErrorBoundary>
            <ActivityFeedPanel
              events={activityFeed.events}
              isLoading={activityFeed.isLoading}
              error={activityFeed.error}
            />
          </ErrorBoundary>
        </aside>

        {/* Center Panel — Oversight Chat */}
        <main
          className={`bg-transparent overflow-hidden flex flex-col ${
            activeView === 'chat' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          <TerminalScrollArea 
            className="flex-1 p-4 overflow-y-auto" 
            autoScroll={oversightChat.isStreaming || (oversightChat.messages.length > (prevMessageLength ?? 0))}
          >
            {/* Empty state */}
            {oversightChat.messages.length === 0 && !oversightChat.isStreaming && (
              <div className="text-terminal-dim">
                <span className="terminal-prompt">oversight@agent ~ $</span>
                <span className="ml-2">type a question to begin...</span>
              </div>
            )}

            {/* Messages */}
            {oversightChat.messages.map((msg, i) => {
              const time = new Date(msg.timestamp).toLocaleTimeString('en-US', { hour12: false })
              return (
                <div key={`${msg.timestamp}-${i}`} className="mb-2">
                  {msg.role === 'user' ? (
                    <div>
                      <span className="text-terminal-dim">[{time}]</span>{' '}
                      <span className="terminal-prompt">user@dashboard ~ $</span>{' '}
                      <span className="text-white">{msg.content}</span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-terminal-dim">[{time}]</span>{' '}
                      {msg.tools_used && msg.tools_used.length > 0 && (
                        <span className="text-terminal-yellow">[tools: {msg.tools_used.join(', ')}] </span>
                      )}
                      <span className="text-terminal-green whitespace-pre-wrap">{msg.content}</span>
                      {msg.incomplete && (
                        <span className="text-terminal-yellow ml-1">[INTERRUPTED]</span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Streaming buffer */}
            {oversightChat.isStreaming && oversightChat.streamBuffer && (
              <div className="mb-2">
                <span className="text-terminal-green whitespace-pre-wrap">
                  {oversightChat.streamBuffer}
                </span>
                <span className="terminal-cursor" aria-hidden="true" />
              </div>
            )}

            {/* Streaming with no content yet */}
            {oversightChat.isStreaming && !oversightChat.streamBuffer && (
              <div className="mb-2">
                <span className="terminal-cursor" aria-hidden="true" />
              </div>
            )}

            {/* Error display */}
            {oversightChat.error && (
              <div className="mb-2">
                <span className="text-terminal-red font-bold">[ERROR]</span>{' '}
                <span className="text-terminal-red">{oversightChat.error}</span>
              </div>
            )}
          </TerminalScrollArea>
        </main>

        {/* Right Panel — Queue Monitor */}
        <aside
          className={`border-l border-terminal-border bg-transparent overflow-hidden ${
            activeView === 'queue' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          <ErrorBoundary>
            <QueueMonitorPanel
              summary={queueMonitor.summary}
              dlqItems={queueMonitor.dlqItems}
              isLoading={queueMonitor.isLoading}
              error={queueMonitor.error}
              onRetry={queueMonitor.retryItem}
              isRetrying={queueMonitor.isRetrying}
            />
          </ErrorBoundary>
        </aside>

        {/* Right Panel — Metrics Overview */}
        <aside
          className={`border-l border-terminal-border bg-transparent overflow-hidden ${
            activeView === 'metrics' ? 'flex' : 'hidden xl:flex'
          }`}
        >
          <ErrorBoundary>
            <MetricsOverviewPanel
              businessAccountId={businessAccountId}
            />
          </ErrorBoundary>
        </aside>
      </div>

      {/* ── Bottom Input Bar ─────────────────────────────────────────── */}
      <footer>
        <TerminalInput
          onSubmit={handleSubmit}
          isStreaming={oversightChat.isStreaming}
          disabled={!businessAccountId}
          onCancel={oversightChat.closeStream}
          onClearScreen={handleClearScreen}
          commandHistory={commandHistory}
        />
      </footer>
    </div>
  )
}
