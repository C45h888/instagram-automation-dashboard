/**
 * useTerminalKeyboard.ts — Phase 2 refactored.
 *
 * Public API is byte-identical to the legacy hook:
 *   - UseTerminalKeyboardOptions interface
 *   - UseTerminalKeyboardResult interface
 *   - { register, historyUp, historyDown, addToHistory }
 *
 * The implementation now delegates to
 * createTerminalKeyboardController from src/lib/bridge/terminalKeyboard.ts.
 * The controller owns the event listener, command history, and sessionStorage.
 * The hook wires options reactively and exposes the controller result.
 *
 * Options changes are propagated to the controller via updateOptions(),
 * which rebuilds the listener with live callbacks.
 */

import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { createTerminalKeyboardController } from '../lib/bridge/terminalKeyboard';

// ─────────────────────────────────────────────────────────────────────────────
// Result interface — unchanged from the legacy hook
// ─────────────────────────────────────────────────────────────────────────────

export interface UseTerminalKeyboardOptions {
  onClearScreen?: () => void;
  onCancel?: () => void;
  onHistoryUp?: () => string | undefined;
  onHistoryDown?: () => string | undefined;
  onEscape?: () => void;
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
// Hook — body delegates to the controller
// ─────────────────────────────────────────────────────────────────────────────

export function useTerminalKeyboard(
  options: UseTerminalKeyboardOptions = {},
): UseTerminalKeyboardResult {
  // Create the controller once. It is stable across re-renders.
  const controller = useMemo(
    () => createTerminalKeyboardController(options),
    [], // intentionally empty — controller is created once, options applied via updateOptions
  );

  // Track the previous options to avoid unnecessary updates
  const prevOptionsRef = useRef<UseTerminalKeyboardOptions | undefined>(undefined);

  // Sync options to the controller whenever they change
  useEffect(() => {
    // Shallow-compare: only update if any option actually changed
    const prev = prevOptionsRef.current;
    const changed =
      !prev ||
      prev.onClearScreen !== options.onClearScreen ||
      prev.onCancel !== options.onCancel ||
      prev.onHistoryUp !== options.onHistoryUp ||
      prev.onHistoryDown !== options.onHistoryDown ||
      prev.onEscape !== options.onEscape ||
      prev.inputFocused !== options.inputFocused ||
      prev.isStreaming !== options.isStreaming;

    if (changed) {
      controller.updateOptions(options);
      prevOptionsRef.current = options;
    }
  }, [controller, options]);

  // Dispose the controller on unmount
  useEffect(() => {
    return () => {
      controller.dispose();
    };
  }, [controller]);

  // The controller is stateless (result is always the same actions),
  // so useSyncExternalStore with a no-op subscribe is equivalent to
  // returning state() directly — but useSyncExternalStore is required
  // for the framework-agnostic controller pattern.
  return useSyncExternalStore(
    () => () => {}, // no-op subscribe — controller state is always the same
    () => controller.state(),
    () => controller.state(),
  );
}
