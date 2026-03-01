/**
 * AgentTerminalDashboard.tsx
 *
 * Root layout component for the agent terminal dashboard.
 * Full-screen overlay with 3-column CSS Grid (feed | chat | queue).
 * Responsive: sidebars collapse on smaller screens.
 */

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { useAgentHealth } from '../../hooks/useAgentHealth'
import { useOversightChat } from '../../hooks/useOversightChat'
import { useQueueMonitor } from '../../hooks/useQueueMonitor'
import { useActivityFeed } from '../../hooks/useActivityFeed'
import { useAnalyticsReports } from '@/hooks/useAnalyticsReports'
import ErrorBoundary from '../ErrorBoundary'
import TerminalStatusBar from './TerminalStatusBar'
import TerminalInput from './TerminalInput'
import TerminalScrollArea from './TerminalScrollArea'
import ActivityFeedPanel from './ActivityFeedPanel'
import QueueMonitorPanel from './QueueMonitorPanel'
import MetricsOverviewPanel from './MetricsOverviewPanel'
import AnimatedSpiralBackground from './AnimatedSpiralBackground'

type PanelView = 'chat' | 'feed' | 'queue' | 'metrics'

/** Hook to track previous value for comparison */
function usePrevious<T>(value: T): T | undefined {
  const [prev, setPrev] = useState<T | undefined>(undefined)
  const [curr, setCurr] = useState<T>(value)

  useEffect(() => {
    setPrev(curr)
    setCurr(value)
  }, [value])

  return prev
}

export default function AgentTerminalDashboard() {
  const navigate = useNavigate()
  const { businessAccountId } = useAuthStore()

  // Core hooks
  const agentHealth = useAgentHealth(businessAccountId)
  const oversightChat = useOversightChat(businessAccountId)
  const queueMonitor = useQueueMonitor()
  const activityFeed = useActivityFeed(businessAccountId)
  const analytics = useAnalyticsReports(businessAccountId, 2)

  // Panel visibility (responsive)
  const [activeView, setActiveView] = useState<PanelView>('chat')

  // Mobile detection for responsive layout
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024)

  // Track previous message length for auto-scroll
  const prevMessageLength = usePrevious(oversightChat.messages.length)

  // Command history for keyboard navigation
  const [commandHistory, setCommandHistory] = useState<string[]>([])

  // Handle window resize for responsive layout
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Clear chat messages (Ctrl+L)
  const handleClearScreen = useCallback(() => {
    // Note: Messages are persisted in Supabase, this only clears the display
    // To truly clear, we'd need to update the session in Supabase
    oversightChat.selectSession(oversightChat.activeSession?.id || '')
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
      // Small delay to ensure session is created before sending
      setTimeout(() => {
        oversightChat.sendMessage(input)
      }, 100)
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
      <div className="fixed inset-0 z-[-1] pointer-events-none" style={{ background: '#000' }}>
        <AnimatedSpiralBackground
          intensity={0.3}
          maxParticles={300}
          spawnRate={0.4}
        />
      </div>

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

      {/* ── Session Selector ────────────────────────────────────────── */}
      {oversightChat.sessions.length > 0 && (
        <div className="flex gap-1 px-2 py-1 border-b border-terminal-border bg-terminal-bg-alt overflow-x-auto">
          <span className="text-terminal-dim text-xs px-2 py-1 shrink-0">sessions:</span>
          {oversightChat.sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => oversightChat.selectSession(session.id)}
              className={`text-xs px-2 py-1 shrink-0 ${
                session.id === oversightChat.activeSession?.id
                  ? 'text-terminal-green bg-terminal-bg-panel'
                  : 'text-terminal-dim hover:text-terminal-cyan'
              }`}
              title={session.session_title || `Session ${session.id.slice(0, 8)}`}
            >
              [{session.session_title?.slice(0, 15) || session.id.slice(0, 6)}]
            </button>
          ))}
          <button
            onClick={oversightChat.startSession}
            className="text-xs text-terminal-dim hover:text-terminal-green px-2 py-1 shrink-0"
            title="Start new session"
          >
            [+new]
          </button>
        </div>
      )}

      {/* ── Mobile Tab Bar (< 1024px) ────────────────────────────────── */}
      <div className="flex lg:hidden border-b border-terminal-border bg-terminal-bg-alt" style={{ display: isMobile ? 'flex' : 'none' }}>
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
          className={`border-r border-terminal-border bg-terminal-bg overflow-hidden ${
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
          className={`bg-terminal-bg overflow-hidden flex flex-col ${
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
          className={`border-l border-terminal-border bg-terminal-bg overflow-hidden ${
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
          className={`border-l border-terminal-border bg-terminal-bg overflow-hidden ${
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
