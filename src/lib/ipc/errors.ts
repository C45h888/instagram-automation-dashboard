// =====================================
// IPC ERRORS — WebView-side error envelope
// Phase 3f: Pass B — WebView adapter
//
// `IpcError` is the typed wrapper around `IpcErrorDTO`. The Rust
// kernel never serializes `RuntimeError` directly — it projects into
// `IpcErrorDTO` at the seam, and the WebView reconstructs it here.
//
// Match on `kind` (stable), NOT on `message` (human-readable, may
// change across kernel versions).
// =====================================

import type { IpcErrorDTO } from './types';

/**
 * Stable error-kind codes. These MUST match the strings returned by
 * `RuntimeError::kind()` in runtime_error.rs. Adding a new variant
 * in Rust without updating this constant is a contract drift.
 */
export const RUNTIME_ERROR_KINDS = {
  STARTUP: 'RUNTIME_STARTUP_ERROR',
  SHUTDOWN: 'RUNTIME_SHUTDOWN_ERROR',
  CONFIG: 'RUNTIME_CONFIG_ERROR',
  STATE: 'RUNTIME_STATE_ERROR',
  WINDOW: 'RUNTIME_WINDOW_ERROR',
  IPC: 'RUNTIME_IPC_ERROR',
  FILESYSTEM: 'RUNTIME_FILESYSTEM_ERROR',
  PLUGIN: 'RUNTIME_PLUGIN_ERROR',
  SERIALIZATION: 'RUNTIME_SERIALIZATION_ERROR',
  OBSERVABILITY: 'RUNTIME_OBSERVABILITY_ERROR',
  INTERNAL: 'RUNTIME_INTERNAL_ERROR',
} as const;

export type RuntimeErrorKind =
  (typeof RUNTIME_ERROR_KINDS)[keyof typeof RUNTIME_ERROR_KINDS];

/**
 * Typed error thrown by every IPC command wrapper on failure.
 * Carries the stable kind code from the Rust kernel and the
 * human-readable message for surfacing in UI.
 */
export class IpcError extends Error {
  readonly kind: string;

  constructor(dto: IpcErrorDTO) {
    super(dto.message);
    this.name = 'IpcError';
    this.kind = dto.kind;
  }

  static isIpcError(e: unknown): e is IpcError {
    return e instanceof IpcError;
  }

  /** Stable-code matcher. Use this, not message-matching. */
  is(kind: RuntimeErrorKind): boolean {
    return this.kind === kind;
  }
}

/**
 * Detect whether the current JS context is running inside the Tauri
 * WebView. Browser dev mode and tests will return false; the desktop
 * runtime will return true.
 *
 * The `__TAURI_INTERNALS__` global is Tauri v2's runtime marker.
 */
export function isTauriRuntime(): boolean {
  return (
    typeof window !== 'undefined' &&
    '__TAURI_INTERNALS__' in (window as unknown as Record<string, unknown>)
  );
}
