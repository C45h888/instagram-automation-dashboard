/**
 * useTerminalKeyboard.ts
 *
 * Keyboard shortcuts for terminal input.
 * - Ctrl+L: Clear screen (preserves session)
 * - Ctrl+C: Cancel streaming
 * - ArrowUp/Down: Command history navigation
 * - Escape: Close/clear
 */

import { useEffect, useRef, useCallback } from 'react'

export interface UseTerminalKeyboardOptions {
  /** Called when Ctrl+L is pressed */
  onClearScreen?: () => void
  /** Called when Ctrl+C is pressed (cancel streaming) */
  onCancel?: () => void
  /** Called when ArrowUp is pressed - returns previous command */
  onHistoryUp?: () => string | undefined
  /** Called when ArrowDown is pressed - returns next command */
  onHistoryDown?: () => string | undefined
  /** Called when Escape is pressed */
  onEscape?: () => void
  /** Whether input is currently focused */
  inputFocused?: boolean
  /** Whether streaming is active */
  isStreaming?: boolean
}

export interface UseTerminalKeyboardResult {
  /** Register keyboard event listeners */
  register: (element: HTMLElement | null) => void
  /** Manually trigger history up */
  historyUp: () => string | undefined
  /** Manually trigger history down */
  historyDown: () => string | undefined
}

const MAX_HISTORY = 100

export function useTerminalKeyboard({
  onClearScreen,
  onCancel,
  onHistoryUp,
  onHistoryDown,
  onEscape,
  inputFocused = false,
  isStreaming = false,
}: UseTerminalKeyboardOptions): UseTerminalKeyboardResult {
  // Command history stored in ref (not state to avoid re-renders)
  const historyRef = useRef<string[]>([])
  const historyIndexRef = useRef<number>(-1)
  const elementRef = useRef<HTMLElement | null>(null)

  // Add command to history
  const addToHistory = useCallback((command: string) => {
    if (!command.trim()) return

    const history = historyRef.current
    // Don't add duplicate of last command
    if (history[history.length - 1] === command) return

    history.push(command)

    // Trim to max size
    if (history.length > MAX_HISTORY) {
      history.shift()
    }

    historyIndexRef.current = history.length
  }, [])

  // History navigation
  const historyUp = useCallback(() => {
    const history = historyRef.current
    if (history.length === 0) return undefined

    const newIndex = Math.max(0, historyIndexRef.current - 1)
    historyIndexRef.current = newIndex

    return onHistoryUp?.() ?? history[newIndex]
  }, [onHistoryUp])

  const historyDown = useCallback(() => {
    const history = historyRef.current
    if (history.length === 0) return undefined

    const newIndex = Math.min(history.length, historyIndexRef.current + 1)
    historyIndexRef.current = newIndex

    // If at end, return empty (user typed new command)
    if (newIndex >= history.length) {
      return ''
    }

    return onHistoryDown?.() ?? history[newIndex]
  }, [onHistoryDown])

  // Register element and attach listeners
  const register = useCallback((element: HTMLElement | null) => {
    elementRef.current = element
  }, [])

  // Handle key events
  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+L: Clear screen
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault()
        onClearScreen?.()
        return
      }

      // Ctrl+C: Cancel streaming
      if (e.ctrlKey && e.key === 'c') {
        e.preventDefault()
        if (isStreaming) {
          onCancel?.()
        }
        return
      }

      // Escape: Close/clear
      if (e.key === 'Escape') {
        e.preventDefault()
        onEscape?.()
        return
      }

      // ArrowUp/Down: History navigation (only when input focused)
      if (inputFocused && !isStreaming) {
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          historyUp()
          return
        }

        if (e.key === 'ArrowDown') {
          e.preventDefault()
          historyDown()
          return
        }
      }
    }

    element.addEventListener('keydown', handleKeyDown)
    return () => {
      element.removeEventListener('keydown', handleKeyDown)
    }
  }, [inputFocused, isStreaming, onClearScreen, onCancel, onEscape, historyUp, historyDown])

  return {
    register,
    historyUp,
    historyDown,
  }
}
