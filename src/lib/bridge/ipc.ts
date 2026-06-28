/**
 * src/lib/bridge/ipc.ts
 *
 * The TS interpretation plane for the Rust runtime kernel.
 *
 * Each function here is a typed wrapper around a `#[tauri::command]`
 * exposed by `runtime/src-tauri/src/ipc/commands.rs`. There is one
 * wrapper per Rust command — total: 21 functions, 5 groups
 * (runtime state, window, settings, session, logging, config).
 *
 * Scope rule (Phase 3e pass 5):
 *   No React consumer calls these yet. The plane exists so the
 *   Svelte migration target and any future WebView-side
 *   tooling has a typed entry point to the kernel.
 *
 * What this file is NOT:
 *   - Not a re-export of kernel functions. The kernel is the Rust
 *     side; this plane is the WebView side that calls into it.
 *   - Not a Svelte store. The wrapper returns Promises. A Svelte
 *     adapter can wrap these in stores when the migration begins.
 *
 * Adding a new IPC command:
 *   1. Add the `#[tauri::command]` fn in Rust commands.rs.
 *   2. Register it in `tauri::generate_handler![...]` in bootstrap/runtime.rs.
 *   3. Add a permission entry in capabilities/default.json.
 *   4. Add the DTO type to the appropriate contracts/ipc/*.contract.ts file.
 *   5. Add the typed wrapper here.
 */

import { invoke } from '@tauri-apps/api/core';
import type { IpcErrorDTO } from './ipc-errors';

import type { RuntimeStateDTO, PhaseDTO } from '../../../runtime/src-tauri/lib/contracts/ipc/runtime-state.contract';
import type { WindowSizeDTO } from '../../../runtime/src-tauri/lib/contracts/ipc/window.contract';
import type {
  SettingsStateDTO,
  ThemeDTO,
  WindowPrefsDTO,
} from '../../../runtime/src-tauri/lib/contracts/ipc/settings.contract';
import type { ViewMetadataDTO } from '../../../runtime/src-tauri/lib/contracts/ipc/session.contract';
import type { LogEmitDTO } from '../../../runtime/src-tauri/lib/contracts/ipc/logging.contract';
import type { EnvDTO, ConfigDTO } from '../../../runtime/src-tauri/lib/contracts/ipc/config.contract';

/**
 * Internal helper — unwraps the Rust `IpcErrorDTO` envelope into a thrown Error.
 * Every IPC command returns `Result<T, IpcErrorDTO>` from Rust. Tauri 2.x
 * surfaces the error variant as a rejected Promise on the JS side, so we
 * re-throw with the kind + message preserved.
 */
function throwIpcError(err: unknown): never {
  if (err && typeof err === 'object' && 'kind' in err && 'message' in err) {
    const dto = err as IpcErrorDTO;
    const e = new Error(dto.message);
    (e as Error & { kind?: string }).kind = dto.kind;
    throw e;
  }
  throw err instanceof Error ? err : new Error(String(err));
}

// ─────────────────────────────────────────────────────────────────────────────
// Runtime state commands
// ─────────────────────────────────────────────────────────────────────────────

export async function ipc_runtime_get_state(): Promise<RuntimeStateDTO> {
  try {
    return await invoke<RuntimeStateDTO>('runtime_get_state');
  } catch (err) {
    throwIpcError(err);
  }
}

export async function ipc_runtime_get_phase(): Promise<PhaseDTO> {
  try {
    return await invoke<PhaseDTO>('runtime_get_phase');
  } catch (err) {
    throwIpcError(err);
  }
}

export async function ipc_runtime_get_correlation_id(): Promise<string> {
  try {
    return await invoke<string>('runtime_get_correlation_id');
  } catch (err) {
    throwIpcError(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Window management commands
// ─────────────────────────────────────────────────────────────────────────────

export async function ipc_window_minimize(): Promise<void> {
  try {
    await invoke<void>('window_minimize');
  } catch (err) {
    throwIpcError(err);
  }
}

export async function ipc_window_maximize(): Promise<void> {
  try {
    await invoke<void>('window_maximize');
  } catch (err) {
    throwIpcError(err);
  }
}

export async function ipc_window_unmaximize(): Promise<void> {
  try {
    await invoke<void>('window_unmaximize');
  } catch (err) {
    throwIpcError(err);
  }
}

export async function ipc_window_close(): Promise<void> {
  try {
    await invoke<void>('window_close');
  } catch (err) {
    throwIpcError(err);
  }
}

export async function ipc_window_set_title(title: string): Promise<void> {
  try {
    await invoke<void>('window_set_title', { title });
  } catch (err) {
    throwIpcError(err);
  }
}

export async function ipc_window_focus(): Promise<void> {
  try {
    await invoke<void>('window_focus');
  } catch (err) {
    throwIpcError(err);
  }
}

export async function ipc_window_inner_size(): Promise<WindowSizeDTO> {
  try {
    return await invoke<WindowSizeDTO>('window_inner_size');
  } catch (err) {
    throwIpcError(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings commands
// ─────────────────────────────────────────────────────────────────────────────

export async function ipc_settings_get(): Promise<SettingsStateDTO> {
  try {
    return await invoke<SettingsStateDTO>('settings_get');
  } catch (err) {
    throwIpcError(err);
  }
}

export async function ipc_settings_set_theme(theme: ThemeDTO): Promise<void> {
  try {
    await invoke<void>('settings_set_theme', { theme });
  } catch (err) {
    throwIpcError(err);
  }
}

export async function ipc_settings_set_font_scale(scale: number): Promise<void> {
  try {
    await invoke<void>('settings_set_font_scale', { scale });
  } catch (err) {
    throwIpcError(err);
  }
}

export async function ipc_settings_set_window_prefs(prefs: WindowPrefsDTO): Promise<void> {
  try {
    await invoke<void>('settings_set_window_prefs', { prefs });
  } catch (err) {
    throwIpcError(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Session commands
// ─────────────────────────────────────────────────────────────────────────────

export async function ipc_session_get_current_view(): Promise<ViewMetadataDTO | null> {
  try {
    return await invoke<ViewMetadataDTO | null>('session_get_current_view');
  } catch (err) {
    throwIpcError(err);
  }
}

export async function ipc_session_mount_view(view: ViewMetadataDTO): Promise<void> {
  try {
    await invoke<void>('session_mount_view', { view });
  } catch (err) {
    throwIpcError(err);
  }
}

export async function ipc_session_unmount_view(): Promise<void> {
  try {
    await invoke<void>('session_unmount_view');
  } catch (err) {
    throwIpcError(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Logging commands
// ─────────────────────────────────────────────────────────────────────────────

export async function ipc_log_emit_event(event: LogEmitDTO): Promise<void> {
  try {
    await invoke<void>('log_emit_event', { event });
  } catch (err) {
    throwIpcError(err);
  }
}

export async function ipc_log_get_session_log_path(): Promise<string | null> {
  try {
    return await invoke<string | null>('log_get_session_log_path');
  } catch (err) {
    throwIpcError(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuration commands
// ─────────────────────────────────────────────────────────────────────────────

export async function ipc_config_get_env(): Promise<EnvDTO> {
  try {
    return await invoke<EnvDTO>('config_get_env');
  } catch (err) {
    throwIpcError(err);
  }
}

export async function ipc_config_get_runtime_config(): Promise<ConfigDTO> {
  try {
    return await invoke<ConfigDTO>('config_get_runtime_config');
  } catch (err) {
    throwIpcError(err);
  }
}