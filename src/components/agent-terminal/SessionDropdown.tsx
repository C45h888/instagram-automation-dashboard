/**
 * SessionDropdown.tsx
 *
 * Terminal-style session picker for the Oversight Chat header.
 * Shows last 5 sessions. Stale sessions (is_active: false) are dimmed.
 * New session requires confirmation when a stream is active.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import type { OversightSession } from '@/types'

interface SessionDropdownProps {
  sessions:      OversightSession[]
  activeSession: OversightSession | null
  isStreaming:   boolean
  onSelect:      (sessionId: string) => void
  onNewSession:  () => Promise<void>
}

export default function SessionDropdown({
  sessions,
  activeSession,
  isStreaming,
  onSelect,
  onNewSession,
}: SessionDropdownProps) {
  const [open, setOpen]           = useState(false)
  const [confirming, setConfirming] = useState(false)
  const dropdownRef               = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
        setConfirming(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); setConfirming(false) }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  const handleNewSessionClick = useCallback(() => {
    if (isStreaming) {
      setConfirming(true)
    } else {
      setOpen(false)
      onNewSession()
    }
  }, [isStreaming, onNewSession])

  const handleConfirmNewSession = useCallback(async () => {
    setConfirming(false)
    setOpen(false)
    await onNewSession()
  }, [onNewSession])

  const handleSelectSession = useCallback((sessionId: string) => {
    setOpen(false)
    setConfirming(false)
    onSelect(sessionId)
  }, [onSelect])

  // Label shown on the trigger button
  const triggerLabel = activeSession
    ? activeSession.session_title
      || formatTimestamp(activeSession.created_at)
    : 'no session'

  return (
    <div ref={dropdownRef} className="relative">
      {/* ── Trigger button ── */}
      <button
        onClick={() => { setOpen((v) => !v); setConfirming(false) }}
        className="flex items-center gap-1 px-2 py-1 text-xs text-terminal-cyan hover:text-terminal-green border border-terminal-border bg-transparent transition-colors"
        title="Session picker"
      >
        <span className="text-terminal-dim">[session:</span>
        <span className="max-w-[120px] truncate">{triggerLabel}</span>
        <span className="text-terminal-dim">]</span>
        <span className={`text-terminal-dim ml-1 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {/* ── Dropdown panel ── */}
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[220px] bg-terminal-bg/90 backdrop-blur-sm border border-terminal-border">

          {/* Session list */}
          <div className="max-h-[160px] overflow-y-auto terminal-scroll">
            {sessions.length === 0 && (
              <div className="px-3 py-2 text-terminal-dim text-xs">no sessions</div>
            )}
            {sessions.map((session) => {
              const isActive   = session.id === activeSession?.id
              const isStale    = !session.is_active

              return (
                <button
                  key={session.id}
                  onClick={() => handleSelectSession(session.id)}
                  disabled={isStale}
                  className={[
                    'w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between gap-2',
                    isActive
                      ? 'text-terminal-green bg-terminal-bg-panel'
                      : isStale
                        ? 'text-terminal-dim cursor-not-allowed opacity-50'
                        : 'text-terminal-cyan hover:bg-terminal-bg-panel hover:text-terminal-green',
                  ].join(' ')}
                  title={isStale ? 'stale — cannot resume' : session.session_title || session.id}
                >
                  <span className="truncate">
                    {session.session_title || formatTimestamp(session.created_at)}
                  </span>
                  <span className="shrink-0 text-terminal-dim">
                    {isActive ? '●' : isStale ? '[stale]' : '○'}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Divider */}
          <div className="border-t border-terminal-border" />

          {/* New session — confirmation flow */}
          {confirming ? (
            <div className="px-3 py-2 text-xs">
              <p className="text-terminal-yellow mb-2">
                active stream will be lost. confirm?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleConfirmNewSession}
                  className="px-2 py-1 text-terminal-green border border-terminal-green hover:bg-terminal-green hover:text-terminal-bg transition-colors"
                >
                  [yes]
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  className="px-2 py-1 text-terminal-dim border border-terminal-border hover:text-terminal-cyan transition-colors"
                >
                  [no]
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleNewSessionClick}
              className="w-full text-left px-3 py-2 text-xs text-terminal-dim hover:text-terminal-green transition-colors"
            >
              [+new session]
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day:   'numeric',
      hour:  '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  } catch {
    return iso.slice(0, 16)
  }
}
