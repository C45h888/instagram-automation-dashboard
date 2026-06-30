/**
 * Controller for useTerminalKeyboard — Phase 2 bridge layer.
 *
 * Contract preserved (byte-identical to the React hook):
 *   - Ctrl+L: clear screen
 *   - Ctrl+C: cancel streaming (only when isStreaming)
 *   - ArrowUp/Down: command history navigation
 *   - Escape: close/clear
 *   - Command history: sessionStorage['terminal-command-history'], max 100
 *   - History navigation only active when inputFocused && !isStreaming
 *   - No duplicate of last command added to history
 *   - onHistoryUp / onHistoryDown are optional callbacks — called with 0 args
 *     as getters to let the consumer inject the command into the input
 *
 * Framework-agnostic: no React, no hooks. Pure DOM event listeners
 * + sessionStorage. The React hook consumes this via register(element).
 *
 * The React hook (useTerminalKeyboard.ts) is refactored to consume this
 * controller. Public exports unchanged:
 *   - UseTerminalKeyboardOptions interface
 *   - UseTerminalKeyboardResult interface
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types — inlined as part of Phase 3h. Originally lived in
// src/hooks/useTerminalKeyboard.ts (purged in 3g). The controller is the
// canonical home; the types travel with it.
// ─────────────────────────────────────────────────────────────────────────────

export interface UseTerminalKeyboardOptions {
  onClearScreen?: () => void;
  onCancel?: () => void;
  onEscape?: () => void;
  onHistoryUp?: () => void;
  onHistoryDown?: () => void;
  inputFocused?: boolean;
  isStreaming?: boolean;
}

export interface UseTerminalKeyboardResult {
  register: (element: HTMLElement | null) => void;
  historyUp: () => string | undefined;
  historyDown: () => string | undefined;
  addToHistory: (command: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants — preserved verbatim from useTerminalKeyboard.ts
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'terminal-command-history';
const MAX_HISTORY = 100;

// ─────────────────────────────────────────────────────────────────────────────
// Controller factory
// ─────────────────────────────────────────────────────────────────────────────

export function createTerminalKeyboardController(
  initialOptions: UseTerminalKeyboardOptions = {},
): {
  state(): UseTerminalKeyboardResult;
  subscribe(listener: (state: UseTerminalKeyboardResult) => void): () => void;
  /** Call whenever options change to rebuild the listener with live callbacks. */
  updateOptions(opts: UseTerminalKeyboardOptions): void;
  dispose(): void;
} {
  // ── Mutable options — rebuilt into the listener on each options change ─────────
  let opts: UseTerminalKeyboardOptions = { ...initialOptions };

  // ── Command history ─────────────────────────────────────────────────────────
  const history: string[] = [];
  let historyIndex = history.length;

  // Load from sessionStorage on boot
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as unknown;
      if (Array.isArray(parsed)) {
        history.push(...parsed);
        historyIndex = history.length;
      }
    }
  } catch {
    // Corrupt storage — ignore
  }

  function persist(): void {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {
      // Storage full or unavailable — ignore
    }
  }

  // ── Element + listener management ───────────────────────────────────────────
  let currentElement: HTMLElement | null = null;
  let registeredListener: ((e: KeyboardEvent) => void) | null = null;

  function rebuildListener(): void {
    if (currentElement && registeredListener) {
      currentElement.removeEventListener('keydown', registeredListener);
    }
    if (!currentElement) {
      registeredListener = null;
      return;
    }
    const listener = (e: KeyboardEvent) => {
      // Capture current options at event time — live, not captured at construction.
      // This means the listener always sees the latest callbacks.
      const {
        onClearScreen,
        onCancel,
        onHistoryUp,
        onHistoryDown,
        onEscape,
        inputFocused = false,
        isStreaming = false,
      } = opts;

      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        onClearScreen?.();
        return;
      }
      if (e.ctrlKey && e.key === 'c') {
        e.preventDefault();
        if (isStreaming) onCancel?.();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onEscape?.();
        return;
      }
      if (inputFocused && !isStreaming) {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          // onHistoryUp / onHistoryDown are optional getters — called with 0 args.
          // They let the consumer inject the command string into the input field.
          const cmd = onHistoryUp?.() ?? historyUpDirect();
          if (cmd !== undefined) onHistoryUp?.();
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const cmd = onHistoryDown?.() ?? historyDownDirect();
          if (cmd !== undefined) onHistoryDown?.();
          return;
        }
      }
    };
    currentElement.addEventListener('keydown', listener);
    registeredListener = listener;
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  /** Read from local history (fallback when consumer doesn't provide a callback) */
  function historyUpDirect(): string | undefined {
    if (history.length === 0) return undefined;
    historyIndex = Math.max(0, historyIndex - 1);
    return history[historyIndex];
  }

  /** Read from local history (fallback when consumer doesn't provide a callback) */
  function historyDownDirect(): string | undefined {
    if (history.length === 0) return undefined;
    historyIndex = Math.min(history.length, historyIndex + 1);
    if (historyIndex >= history.length) return '';
    return history[historyIndex];
  }

  function addToHistory(command: string): void {
    if (!command.trim()) return;
    if (history[history.length - 1] === command) return;
    history.push(command);
    if (history.length > MAX_HISTORY) history.shift();
    historyIndex = history.length;
    persist();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  function register(element: HTMLElement | null): void {
    if (currentElement && registeredListener) {
      currentElement.removeEventListener('keydown', registeredListener);
    }
    currentElement = element;
    rebuildListener();
  }

  function updateOptions(newOpts: UseTerminalKeyboardOptions): void {
    opts = { ...newOpts };
    // Rebuild listener so the next event sees the new callbacks
    rebuildListener();
  }

  // historyUp/Down exposed to the UI — call the optional getter first,
  // fall back to local history navigation
  function historyUp(): string | undefined {
    return opts.onHistoryUp?.() ?? historyUpDirect();
  }

  function historyDown(): string | undefined {
    return opts.onHistoryDown?.() ?? historyDownDirect();
  }

  function dispose(): void {
    if (currentElement && registeredListener) {
      currentElement.removeEventListener('keydown', registeredListener);
    }
    currentElement = null;
    registeredListener = null;
  }

  // ── State (stateless — result is always the same 4 actions) ─────────────
  const listeners = new Set<(state: UseTerminalKeyboardResult) => void>();

  function buildResult(): UseTerminalKeyboardResult {
    return { register, historyUp, historyDown, addToHistory };
  }

  return {
    state: buildResult,
    subscribe(listener) {
      listeners.add(listener);
      listener(buildResult());
      return () => listeners.delete(listener);
    },
    updateOptions,
    dispose,
  };
}
