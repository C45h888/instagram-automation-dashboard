/**
 * TerminalScrollArea.tsx
 *
 * Central scrollable container for terminal content.
 * Maintains bottom-anchored scrolling for chat-like behavior.
 */

import { useRef, useEffect, type ReactNode } from 'react'

interface TerminalScrollAreaProps {
  children: ReactNode
  className?: string
  /** When true, auto-scrolls to bottom on content changes */
  autoScroll?: boolean
}

export default function TerminalScrollArea({
  children,
  className = '',
  autoScroll = true,
}: TerminalScrollAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (autoScroll && anchorRef.current) {
      anchorRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [autoScroll, children])

  return (
    <div
      ref={scrollRef}
      className={`terminal-scroll overflow-y-auto overflow-x-hidden ${className}`}
      style={{ overflowAnchor: 'none' }}
    >
      {children}
      <div ref={anchorRef} className="terminal-scroll-anchor h-0" />
    </div>
  )
}
