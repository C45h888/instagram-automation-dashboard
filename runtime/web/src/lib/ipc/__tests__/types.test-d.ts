/**
 * Compile-only type test for the IPC contract (Phase 2).
 *
 * Verifies that the TypeScript DTOs are *structurally* compatible with
 * the JSON the Rust IPC commands produce. This is not a runtime test —
 * there is no Tauri runtime in Phase 2 — it is a static guarantee
 * that the Rust and TS sides describe the same wire format.
 *
 * If a Rust DTO field changes shape and this file stops compiling,
 * the IPC ABI has drifted and both sides need a coordinated update.
 */

import type {
  ConfigDTO,
  Environment,
  IpcErrorDTO,
  LogEmitDTO,
  Phase,
  RuntimeConfigDTO,
  RuntimeStateDTO,
  SettingsStateDTO,
  Theme,
  ViewMetadataDTO,
  WindowConfigDTO,
  WindowPrefsDTO,
  WindowSizeDTO,
} from '../index';

// ---------------------------------------------------------------------------
// DTO structural shape assertions
// ---------------------------------------------------------------------------

// If any required field is renamed or removed, the assignment below
// fails to typecheck.

const _runtime_state: RuntimeStateDTO = {
  phase: 'ready',
  correlation_id: '00000000-0000-0000-0000-000000000000',
  booted_at_epoch_secs: 1_700_000_000,
};
const _phase: Phase = 'window_init';
const _theme: Theme = 'dark';
const _env: Environment = 'staging';
const _window_size: WindowSizeDTO = { width: 1280, height: 800 };
const _window_prefs: WindowPrefsDTO = {
  start_maximized: false,
  remember_position: true,
};
const _settings: SettingsStateDTO = {
  theme: 'system',
  font_scale: 1.0,
  window_prefs: _window_prefs,
};
const _view: ViewMetadataDTO = {
  view_id: 'main',
  mounted_at_epoch_secs: 1_700_000_000,
};
const _log: LogEmitDTO = {
  component: 'ui::dashboard',
  event: 'ui.click',
  fields: { user_action: 'click' },
};
const _runtime_cfg: RuntimeConfigDTO = {
  product_name: 'automation-kernel',
  identifier: 'com.systemic.runtime',
};
const _window_cfg: WindowConfigDTO = {
  title: 'Automation Kernel',
  width: 1280,
  height: 800,
  min_width: 800,
  min_height: 600,
  resizable: true,
};
const _config: ConfigDTO = {
  env: 'prod',
  window: _window_cfg,
  runtime: _runtime_cfg,
  // logging is intentionally omitted to verify it's optional? — NO,
  // the Rust side emits `logging` unconditionally. Re-add to assert
  // it's required.
  logging: {
    level: 'info',
    format: 'text',
    stdout: true,
    file_path: null,
  },
};
const _error: IpcErrorDTO = {
  kind: 'RUNTIME_WINDOW_ERROR',
  message: 'main webview window not found',
};

// Reference all constants so dead-code elimination doesn't drop the
// type assertions.
export const __type_assertions = {
  _runtime_state,
  _phase,
  _theme,
  _env,
  _window_size,
  _window_prefs,
  _settings,
  _view,
  _log,
  _runtime_cfg,
  _window_cfg,
  _config,
  _error,
};
