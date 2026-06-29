// =====================================
// IPC TYPES — WebView-side DTO mirrors
// Phase 3f: Pass B — WebView adapter
//
// These are TYPE-ONLY mirrors of the DTOs declared in
// runtime/src-tauri/src/ipc/types.rs. Field naming is snake_case to
// match Rust → JSON marshaling is direct (no field remapping).
//
// Contract invariant: every variant here must match a Rust DTO.
// If a Rust DTO adds a field or variant, this file must follow.
// The Rust test `phase_dto_exhaustively_maps_seven_variants` is the
// authoritative source for variant counts; this file mirrors them.
// =====================================

// ─────────────────────────────────────────────────────────────────
// Error envelope
// ─────────────────────────────────────────────────────────────────

/**
 * Stable, machine-readable error envelope returned by every IPC
 * command on failure. `kind` is the stable error code from
 * `RuntimeError::kind()`; `message` is human-readable and not stable
 * across versions.
 */
export interface IpcErrorDTO {
  kind: string;
  message: string;
}

// ─────────────────────────────────────────────────────────────────
// Runtime state
// ─────────────────────────────────────────────────────────────────

/**
 * Phase enum for the runtime kernel's bootstrap lifecycle.
 * Mirrors `RuntimePhase` in runtime_state.rs. Seven variants,
 * snake_case serialization.
 */
export type PhaseDTO =
  | 'cold'
  | 'configuring'
  | 'logging'
  | 'window_init'
  | 'ready'
  | 'shutting_down'
  | 'stopped';

export interface RuntimeStateDTO {
  phase: PhaseDTO;
  correlation_id: string;
  booted_at_epoch_secs: number;
}

// ─────────────────────────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────────────────────────

export type ThemeDTO = 'system' | 'light' | 'dark';

export interface WindowPrefsDTO {
  start_maximized: boolean;
  remember_position: boolean;
}

export interface SettingsStateDTO {
  theme: ThemeDTO;
  font_scale: number;
  window_prefs: WindowPrefsDTO;
}

// ─────────────────────────────────────────────────────────────────
// Session (window session — NOT auth)
// ─────────────────────────────────────────────────────────────────

export interface ViewMetadataDTO {
  view_id: string;
  mounted_at_epoch_secs: number;
}

// ─────────────────────────────────────────────────────────────────
// Window
// ─────────────────────────────────────────────────────────────────

export interface WindowSizeDTO {
  width: number;
  height: number;
}

// ─────────────────────────────────────────────────────────────────
// Logging
// ─────────────────────────────────────────────────────────────────

/**
 * Structured event forwarded from the WebView into the kernel's
 * tracing pipeline. `fields` carries arbitrary structured context.
 */
export interface LogEmitDTO {
  component: string;
  event: string;
  fields: Record<string, string>;
}

// ─────────────────────────────────────────────────────────────────
// Configuration / Environment
// ─────────────────────────────────────────────────────────────────

export type EnvDTO = 'dev' | 'staging' | 'prod';

export interface WindowConfigDTO {
  title: string;
  width: number;
  height: number;
  min_width: number;
  min_height: number;
  resizable: boolean;
}

/**
 * Logging configuration — flat field mirror of
 * `crate::config::config::LoggingConfig`. The kernel passes this
 * through unchanged; the WebView only reads it for display.
 */
export interface LoggingConfigDTO {
  level: string;
  file_path: string | null;
  console: boolean;
  structured: boolean;
}

export interface ConfigDTO {
  env: EnvDTO;
  window: WindowConfigDTO;
  logging: LoggingConfigDTO;
}
