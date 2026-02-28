/**
 * TerminalInput.tsx
 *
 * Fixed bottom input bar with terminal prompt style.
 * Handles Enter to submit, Shift+Enter for newline, auto-expanding textarea.
 * Integrated with useTerminalKeyboard for Ctrl+L, Ctrl+C, arrow history.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { useTerminalKeyboard } from '../../hooks/useTerminalKeyboard'

interface TerminalInputProps {
  onSubmit: (input: string) => void
  isStreaming: boolean
  disabled: boolean
  promptPrefix?: string
  onCancel?: () => void
  onClearScreen?: () => void
  commandHistory?: string[]
}

export default function TerminalInput({
  onSubmit,
  isStreaming,
  disabled,
  promptPrefix = 'oversight@agent ~ $',
  onCancel,
  onClearScreen,
  commandHistory = [],
}: TerminalInputProps) {
  const [value, setValue] = useState('')
  const [historyIndex, setHistoryIndex] = useState(-1)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isFocused, setIsFocused] = useState(false)

  // Initialize keyboard hook with sessionStorage persistence
  const keyboard = useTerminalKeyboard({
    onClearScreen: () => {
      onClearScreen?.()
    },
    onCancel: () => {
      if (isStreaming) {
        onCancel?.()
      }
    },
    onHistoryUp: () => {
      if (commandHistory.length === 0) return undefined
      const newIndex = Math.min(historyIndex + 1, commandHistory.length - 1)
      setHistoryIndex(newIndex)
      const newValue = commandHistory[commandHistory.length - 1 - newIndex] || ''
      setValue(newValue)
      return newValue
    },
    onHistoryDown: () => {
      if (commandHistory.length === 0) return undefined
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1
        setHistoryIndex(newIndex)
        const newValue = commandHistory[commandHistory.length - 1 - newIndex] || ''
        setValue(newValue)
        return newValue
      } else {
        setHistoryIndex(-1)
        setValue('')
        return ''
      }
    },
    inputFocused: isFocused,
    isStreaming,
  })

  // Merge refs: keyboard.register + textareaRef
  const setRefs = useCallback((element: HTMLTextAreaElement | null) => {
    ;(textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = element
    keyboard.register(element)
  }, [keyboard])

  // Auto-resize textarea (1 row min, 4 rows max)
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const lineHeight = 20 // ~13px font * 1.5 line-height
    const maxHeight = lineHeight * 4
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
  }, [value])

  // Focus input on mount
  useEffect(() => {
    if (!isStreaming && !disabled) {
      textareaRef.current?.focus()
    }
  }, [isStreaming, disabled])

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || isStreaming || disabled) return
    onSubmit(trimmed)
    keyboard.addToHistory(trimmed)
    setValue('')
    setHistoryIndex(-1)
  }, [value, isStreaming, disabled, onSubmit, keyboard])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Ctrl+Enter always submits
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault()
        handleSubmit()
        return
      }

      // Enter submits (unless Shift held for newline)
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  return (
    <div className="flex items-start gap-2 px-4 py-2 bg-terminal-bg-alt border-t border-terminal-border min-h-[40px]">
      {/* Prompt prefix */}
      <span className="terminal-prompt leading-[20px] shrink-0 pt-px">
        {promptPrefix}
      </span>

      {/* Input area */}
      {isStreaming ? (
        <span className="text-terminal-dim leading-[20px] pt-px">[streaming...]</span>
      ) : (
        <textarea
          ref={setRefs}
          data-terminal-input="true"
          className="terminal-input leading-[20px]"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="type a question..."
          disabled={disabled}
          rows={1}
          spellCheck={false}
          autoComplete="off"
        />
      )}

      {/* Keyboard hints */}
      {!isStreaming && (
        <span className="text-terminal-dim text-xs leading-[20px] shrink-0 hidden sm:inline pt-px">
          {value.trim() ? '[Enter]' : '[↑↓ history  Ctrl+L clear  Ctrl+C cancel]'}
        </span>
      )}
    </div>
  )
}
