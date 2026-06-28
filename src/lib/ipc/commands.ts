// =====================================
// IPC COMMANDS — typed wrappers for the 21 Rust commands
// Phase 3f: Pass B — WebView adapter
//
// One wrapper per `#[tauri::command]` in
// runtime/src-tauri/src/ipc/commands.rs. Function names mirror the
// Rust command names exactly (snake_case). The arg object's keys
// are camelCase — Tauri's IPC marshals camelCase→snake_case on the
// Rust side automatically (Tauri v2 default).
//
// Every wrapper:
//   - Has an explicit return type (matches the Rust DTO)
//   - Throws `IpcError` on failure (see ./errors.ts)
//   - Is the ONLY public surface for invoking that command
// =====================================

import type {
  RuntimeStateDTO,
  PhaseDTO,
  SettingsStateDTO,
  ThemeDTO,
  WindowPrefsDTO,
  ViewMetadataDTO,
  WindowSizeDTO,
  LogEmitDTO,
  EnvDTO,
  ConfigDTO,
} from './types';
import { invoke } from './client';

// ─────────────────────────────────────────────────────────────────
// Runtime state (3 commands)
// ─────────────────────────────────────────────────────────────────

/** Returns the full RuntimeStateDTO. */
export const runtimeGetState = (): Promise<RuntimeStateDTO> =>
  invoke<RuntimeStateDTO>('runtime_get_state');

/** Returns just the current phase as a string tag. */
export const runtimeGetPhase = (): Promise<PhaseDTO> =>
  invoke<PhaseDTO>('runtime_get_phase');

/** Returns the per-boot UUID v4 correlation id. */
export const runtimeGetCorrelationId = (): Promise<string> =>
  invoke<string>('runtime_get_correlation_id');

// ─────────────────────────────────────────────────────────────────
// Window management (7 commands)
// ─────────────────────────────────────────────────────────────────

export const windowMinimize = (): Promise<void> =>
  invoke<void>('window_minimize');

export const windowMaximize = (): Promise<void> =>
  invoke<void>('window_maximize');

export const windowUnmaximize = (): Promise<void> =>
  invoke<void>('window_unmaximize');

export const windowClose = (): Promise<void> =>
  invoke<void>('window_close');

export const windowSetTitle = (title: string): Promise<void> =>
  invoke<void>('window_set_title', { title });

export const windowFocus = (): Promise<void> =>
  invoke<void>('window_focus');

export const windowInnerSize = (): Promise<WindowSizeDTO> =>
  invoke<WindowSizeDTO>('window_inner_size');

// ─────────────────────────────────────────────────────────────────
// Settings (4 commands)
// ─────────────────────────────────────────────────────────────────

export const settingsGet = (): Promise<SettingsStateDTO> =>
  invoke<SettingsStateDTO>('settings_get');

export const settingsSetTheme = (theme: ThemeDTO): Promise<void> =>
  invoke<void>('settings_set_theme', { theme });

export const settingsSetFontScale = (scale: number): Promise<void> =>
  invoke<void>('settings_set_font_scale', { scale });

export const settingsSetWindowPrefs = (prefs: WindowPrefsDTO): Promise<void> =>
  invoke<void>('settings_set_window_prefs', { prefs });

// ─────────────────────────────────────────────────────────────────
// Session — window session, NOT auth (3 commands)
// ─────────────────────────────────────────────────────────────────

export const sessionGetCurrentView = (): Promise<ViewMetadataDTO | null> =>
  invoke<ViewMetadataDTO | null>('session_get_current_view');

export const sessionMountView = (view: ViewMetadataDTO): Promise<void> =>
  invoke<void>('session_mount_view', { view });

export const sessionUnmountView = (): Promise<void> =>
  invoke<void>('session_unmount_view');

// ─────────────────────────────────────────────────────────────────
// Logging (2 commands)
// ─────────────────────────────────────────────────────────────────

/**
 * Forward a structured event from the WebView into the kernel's
 * tracing pipeline. The event lands in the same correlation-id-aware
 * log stream as Rust-side emissions.
 */
export const logEmitEvent = (event: LogEmitDTO): Promise<void> =>
  invoke<void>('log_emit_event', { event });

/**
 * Returns the file path of the per-session log file, if FileSink is
 * configured. The WebView can read this directly via Tauri's fs
 * plugin to surface historical logs.
 */
export const logGetSessionLogPath = (): Promise<string | null> =>
  invoke<string | null>('log_get_session_log_path');

// ─────────────────────────────────────────────────────────────────
// Configuration (2 commands)
// ─────────────────────────────────────────────────────────────────

export const configGetEnv = (): Promise<EnvDTO> =>
  invoke<EnvDTO>('config_get_env');

export const configGetRuntimeConfig = (): Promise<ConfigDTO> =>
  invoke<ConfigDTO>('config_get_runtime_config');

// ─────────────────────────────────────────────────────────────────
// Total: 21 wrappers — matches generate_handler! list at
// runtime/src-tauri/src/bootstrap/runtime.rs:92-114
// ─────────────────────────────────────────────────────────────────
