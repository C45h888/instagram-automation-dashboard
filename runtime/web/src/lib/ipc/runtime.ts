/**
 * Tauri IPC runtime — type stubs (Phase 2).
 *
 * Phase 2 only defines the contract. The Svelte adapter is wired in
 * Phase 7 once the Svelte/Vite build pipeline is set up. Until then
 * `invoke` falls back to a clear error so consumers fail loud rather
 * than silently returning undefined.
 */

declare global {
  interface Window {
    __TAURI_INTERNALS__?: {
      invoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T>;
    };
  }
}

export function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const tauriInternals = (typeof window !== 'undefined' ? window.__TAURI_INTERNALS__ : undefined);
  if (!tauriInternals) {
    return Promise.reject(
      new Error(
        `Tauri IPC not available (cmd=${cmd}). ` +
          `This is expected in non-Tauri environments (tests, browser dev). ` +
          `The Svelte adapter is wired in Phase 7.`,
      ),
    );
  }
  return tauriInternals.invoke<T>(cmd, args);
}

// ---------------------------------------------------------------------------
// DTOs — must stay byte-identical to runtime/src-tauri/src/ipc/types.rs
// ---------------------------------------------------------------------------

export type Phase =
  | 'cold'
  | 'configuring'
  | 'logging'
  | 'window_init'
  | 'ready'
  | 'shutting_down'
  | 'stopped';

export type Theme = 'system' | 'light' | 'dark';
export type Environment = 'dev' | 'staging' | 'prod';

export interface RuntimeStateDTO {
  phase: Phase;
  correlation_id: string;
  booted_at_epoch_secs: number;
}

export interface WindowPrefsDTO {
  start_maximized: boolean;
  remember_position: boolean;
}

export interface SettingsStateDTO {
  theme: Theme;
  font_scale: number;
  window_prefs: WindowPrefsDTO;
}

export interface ViewMetadataDTO {
  view_id: string;
  mounted_at_epoch_secs: number;
}

export interface WindowSizeDTO {
  width: number;
  height: number;
}

export interface LogEmitDTO {
  component: string;
  event: string;
  fields?: Record<string, string>;
}

export interface WindowConfigDTO {
  title: string;
  width: number;
  height: number;
  min_width: number;
  min_height: number;
  resizable: boolean;
}

export interface LoggingConfigDTO {
  level: string;
  format: 'json' | 'text';
  stdout: boolean;
  file_path: string | null;
}

export interface RuntimeConfigDTO {
  product_name: string;
  identifier: string;
}

export interface ConfigDTO {
  env: Environment;
  window: WindowConfigDTO;
  logging: LoggingConfigDTO;
  runtime: RuntimeConfigDTO;
}

export interface IpcErrorDTO {
  /** Stable error kind, e.g. "RUNTIME_WINDOW_ERROR". */
  kind: string;
  /** Human-readable error message. */
  message: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const runtime = {
  getState: () => invoke<RuntimeStateDTO>('runtime_get_state'),
  getPhase: () => invoke<Phase>('runtime_get_phase'),
  getCorrelationId: () => invoke<string>('runtime_get_correlation_id'),
} as const;

export type RuntimeApi = typeof runtime;
