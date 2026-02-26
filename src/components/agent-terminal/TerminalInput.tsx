/**
 * TerminalInput.tsx
 *
 * Fixed bottom input bar with terminal prompt style.
 * Handles Enter to submit, Shift+Enter for newline, auto-expanding textarea.
 */

import { useState, useRef, useCallback, useEffect } from 'react'

interface TerminalInputProps {
  onSubmit: (input: string) => void
  isStreaming: boolean
  disabled: boolean
  promptPrefix?: string
}

export default function TerminalInput({
  onSubmit,
  isStreaming,
  disabled,
  promptPrefix = 'oversight@agent ~ $',
}: TerminalInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
    setValue('')
  }, [value, isStreaming, disabled, onSubmit])

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
          ref={textareaRef}
          data-terminal-input="true"
          className="terminal-input leading-[20px]"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="type a question..."
          disabled={disabled}
          rows={1}
          spellCheck={false}
          autoComplete="off"
        />
      )}

      {/* Submit hint */}
      {!isStreaming && value.trim() && (
        <span className="text-terminal-dim text-xs leading-[20px] shrink-0 hidden sm:inline pt-px">
          [Enter]
        </span>
      )}
    </div>
  )
}
