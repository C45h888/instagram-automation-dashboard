/**
 * AgentTerminalDashboard.tsx
 *
 * Root layout component for the agent terminal dashboard.
 * Full-screen overlay with 3-column CSS Grid (feed | chat | queue).
 * Responsive: sidebars collapse on smaller screens.
 */

import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { useAgentHealth } from '../../hooks/useAgentHealth'
import { useOversightChat } from '../../hooks/useOversightChat'
import TerminalStatusBar from './TerminalStatusBar'
import TerminalInput from './TerminalInput'
import TerminalScrollArea from './TerminalScrollArea'

type PanelView = 'chat' | 'feed' | 'queue'

export default function AgentTerminalDashboard() {
  const navigate = useNavigate()
  const { businessAccountId } = useAuthStore()

  // Core hooks
  const agentHealth = useAgentHealth(businessAccountId)
  const oversightChat = useOversightChat(businessAccountId)

  // Panel visibility (responsive)
  const [activeView, setActiveView] = useState<PanelView>('chat')

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

  // Handle chat submit
  const handleSubmit = useCallback(
    async (input: string) => {
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
      className="terminal-root fixed inset-0 z-[60] flex flex-col"
      style={{ background: '#000' }}
    >
      {/* ── Top Status Bar ───────────────────────────────────────────── */}
      <header style={{ gridArea: 'status' }}>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <TerminalStatusBar
              agentStatus={agentHealth.agentStatus}
              uptime={uptime}
              activeTaskCount={0}
              alertCount={agentHealth.alerts.length}
              queuedCount={0}
              isLoading={agentHealth.isLoading}
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
        {(['feed', 'chat', 'queue'] as const).map((view) => (
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
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] xl:grid-cols-[280px_1fr_280px]">
        {/* Left Panel — Activity Feed (placeholder until Phase 5) */}
        <aside
          className={`border-r border-terminal-border bg-terminal-bg overflow-hidden ${
            activeView === 'feed' ? 'block' : 'hidden lg:block'
          }`}
        >
          <TerminalScrollArea className="h-full p-3">
            <div className="text-terminal-dim text-xs mb-2">-- ACTIVITY FEED --</div>
            <div className="text-terminal-dim text-xs">awaiting data...</div>
          </TerminalScrollArea>
        </aside>

        {/* Center Panel — Oversight Chat */}
        <main
          className={`bg-terminal-bg overflow-hidden ${
            activeView === 'chat' ? 'block' : 'hidden lg:block'
          }`}
        >
          <TerminalScrollArea className="h-full p-4" autoScroll={oversightChat.isStreaming}>
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

        {/* Right Panel — Queue Monitor (placeholder until Phase 4) */}
        <aside
          className={`border-l border-terminal-border bg-terminal-bg overflow-hidden ${
            activeView === 'queue' ? 'block' : 'hidden lg:block'
          }`}
        >
          <TerminalScrollArea className="h-full p-3">
            <div className="text-terminal-dim text-xs mb-2">-- QUEUE MONITOR --</div>
            <div className="text-terminal-dim text-xs">awaiting data...</div>
          </TerminalScrollArea>
        </aside>
      </div>

      {/* ── Bottom Input Bar ─────────────────────────────────────────── */}
      <footer>
        <TerminalInput
          onSubmit={handleSubmit}
          isStreaming={oversightChat.isStreaming}
          disabled={!businessAccountId}
        />
      </footer>
    </div>
  )
}
