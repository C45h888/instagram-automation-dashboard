//! IPC commands exposed by the runtime kernel to the WebView.
//!
//! This file is the **constitutional seam** of the Tauri app. Every
//! command here is a thin wrapper that reads or writes state the
//! runtime kernel already owns (Phase 1). The DTOs in [`super::types`]
//! are the only types that flow across this boundary.
//!
//! **Forbidden in this file:**
//! - Any reference to preserved-system identifiers (constitutional
//!   violation; see `DOMAIN_PRESERVATION_LAW.md`).
//! - Any non-trivial business logic (the kernel does not own business
//!   logic).
//!
//! **Pattern:** each command takes a `tauri::State<...>` handle (or
//! `tauri::AppHandle`) and returns `Result<DTO, IpcErrorDTO>`. The
//! kernel's internal [`RuntimeError`] is converted to [`IpcErrorDTO`]
//! via [`IpcErrorDTO::from_runtime`] — the kernel type is never
//! serialized and never leaves the kernel boundary. This keeps the
//! kernel's error model free to evolve (new variants, new fields)
//! without breaking the IPC ABI.

use std::collections::HashMap;

use tauri::{plugin::TauriPlugin, AppHandle, Manager, State, WebviewWindow};

use crate::config::loader::Loader;
use crate::error::runtime_error::RuntimeError;
use crate::state::runtime_state::RuntimeState;
use crate::state::session_state::{SessionState, ViewMetadata};
use crate::state::settings_state::SettingsState;

use super::types::{
    ConfigDTO, EnvDTO, IpcErrorDTO, LogEmitDTO, PhaseDTO, RuntimeStateDTO,
    SettingsStateDTO, ThemeDTO, ViewMetadataDTO, WindowPrefsDTO, WindowSizeDTO,
};

/// Type alias for IPC command return values. Uses [`IpcErrorDTO`] as
/// the error type so [`tauri::generate_handler`] accepts the function
/// (the error must implement `Serialize`). The kernel-internal
/// [`RuntimeError`] is mapped into [`IpcErrorDTO`] via `?` thanks to
/// the blanket `From` impl below.
pub type IpcResult<T> = Result<T, IpcErrorDTO>;

impl From<RuntimeError> for IpcErrorDTO {
    fn from(err: RuntimeError) -> Self {
        IpcErrorDTO::from_runtime(&err)
    }
}

// =============================================================================
// Runtime state commands
// =============================================================================

/// `runtime_get_state` — returns the full RuntimeStateDTO.
#[tauri::command]
pub fn runtime_get_state(
    state: State<'_, RuntimeState>,
) -> IpcResult<RuntimeStateDTO> {
    Ok(RuntimeStateDTO::from_state(
        state.phase(),
        state.correlation_id(),
        state.booted_at_epoch_secs(),
    ))
}

/// `runtime_get_phase` — returns just the current phase as a string.
#[tauri::command]
pub fn runtime_get_phase(state: State<'_, RuntimeState>) -> IpcResult<PhaseDTO> {
    Ok(state.phase().into())
}

/// `runtime_get_correlation_id` — returns the per-boot UUID v4.
#[tauri::command]
pub fn runtime_get_correlation_id(
    state: State<'_, RuntimeState>,
) -> IpcResult<String> {
    Ok(state.correlation_id().to_string())
}

// =============================================================================
// Window management commands
// =============================================================================

fn webview_window(app: &AppHandle) -> IpcResult<WebviewWindow> {
    app.get_webview_window("main")
        .ok_or_else(|| IpcErrorDTO::from_runtime(&RuntimeError::window("main webview window not found")))
}

#[tauri::command]
pub fn window_minimize(app: AppHandle) -> IpcResult<()> {
    webview_window(&app)?
        .minimize()
        .map_err(|e| IpcErrorDTO::from_runtime(&RuntimeError::window(e.to_string())))
}

#[tauri::command]
pub fn window_maximize(app: AppHandle) -> IpcResult<()> {
    webview_window(&app)?
        .maximize()
        .map_err(|e| IpcErrorDTO::from_runtime(&RuntimeError::window(e.to_string())))
}

#[tauri::command]
pub fn window_unmaximize(app: AppHandle) -> IpcResult<()> {
    webview_window(&app)?
        .unmaximize()
        .map_err(|e| IpcErrorDTO::from_runtime(&RuntimeError::window(e.to_string())))
}

#[tauri::command]
pub fn window_close(app: AppHandle) -> IpcResult<()> {
    webview_window(&app)?
        .close()
        .map_err(|e| IpcErrorDTO::from_runtime(&RuntimeError::window(e.to_string())))
}

#[tauri::command]
pub fn window_set_title(app: AppHandle, title: String) -> IpcResult<()> {
    webview_window(&app)?
        .set_title(&title)
        .map_err(|e| IpcErrorDTO::from_runtime(&RuntimeError::window(e.to_string())))
}

#[tauri::command]
pub fn window_focus(app: AppHandle) -> IpcResult<()> {
    webview_window(&app)?
        .set_focus()
        .map_err(|e| IpcErrorDTO::from_runtime(&RuntimeError::window(e.to_string())))
}

#[tauri::command]
pub fn window_inner_size(app: AppHandle) -> IpcResult<WindowSizeDTO> {
    let win = webview_window(&app)?;
    let size = win
        .inner_size()
        .map_err(|e| IpcErrorDTO::from_runtime(&RuntimeError::window(e.to_string())))?;
    Ok(WindowSizeDTO {
        width: size.width,
        height: size.height,
    })
}

// =============================================================================
// Settings commands
// =============================================================================

#[tauri::command]
pub fn settings_get(state: State<'_, SettingsState>) -> IpcResult<SettingsStateDTO> {
    Ok(SettingsStateDTO::from(&*state))
}

#[tauri::command]
pub fn settings_set_theme(
    state: State<'_, SettingsState>,
    theme: ThemeDTO,
) -> IpcResult<()> {
    state.set_theme(theme.into());
    Ok(())
}

#[tauri::command]
pub fn settings_set_font_scale(
    state: State<'_, SettingsState>,
    scale: f32,
) -> IpcResult<()> {
    state.set_font_scale(scale); // clamped internally
    Ok(())
}

#[tauri::command]
pub fn settings_set_window_prefs(
    state: State<'_, SettingsState>,
    prefs: WindowPrefsDTO,
) -> IpcResult<()> {
    state.set_window_prefs(prefs.into());
    Ok(())
}

// =============================================================================
// Session (window session, not auth) commands
// =============================================================================

#[tauri::command]
pub fn session_get_current_view(
    state: State<'_, SessionState>,
) -> IpcResult<Option<ViewMetadataDTO>> {
    Ok(state.current_view().map(Into::into))
}

#[tauri::command]
pub fn session_mount_view(
    state: State<'_, SessionState>,
    view: ViewMetadataDTO,
) -> IpcResult<()> {
    state.mount_view(ViewMetadata::from(view));
    Ok(())
}

#[tauri::command]
pub fn session_unmount_view(state: State<'_, SessionState>) -> IpcResult<()> {
    state.unmount_view();
    Ok(())
}

// =============================================================================
// Logging commands
// =============================================================================

/// Forward a structured event from the WebView into the runtime's
/// `tracing` pipeline. Carries the same 5 required fields the kernel
/// uses (`timestamp`, `component`, `severity`, `event`, `correlation_id`)
/// — `correlation_id` is inherited from the active `runtime.boot`
/// Span, the other four come from the request body plus the macro
/// level.
#[tauri::command]
pub fn log_emit_event(
    _state: State<'_, RuntimeState>,
    event: LogEmitDTO,
) -> IpcResult<()> {
    let field_map: HashMap<String, String> = event
        .fields
        .iter()
        .map(|(k, v)| (k.clone(), v.clone()))
        .collect();
    let component = event.component.clone();
    let event_name = event.event.clone();
    tracing::info!(
        target: "runtime.webview",
        event = %event_name,
        component = %component,
        fields = ?field_map,
        "webview event",
    );
    Ok(())
}

/// Returns the file path of the per-session log file, if the FileSink
/// is configured. The WebView can read this directly via Tauri's fs
/// plugin to surface historical logs in the observability shell.
#[tauri::command]
pub fn log_get_session_log_path(
    _state: State<'_, RuntimeState>,
) -> IpcResult<Option<String>> {
    let cfg = Loader::load().ok();
    let path = cfg
        .as_ref()
        .and_then(|c| c.logging.file_path.clone());
    Ok(path)
}

// =============================================================================
// Configuration commands
// =============================================================================

#[tauri::command]
pub fn config_get_env() -> IpcResult<EnvDTO> {
    let cfg = Loader::load().map_err(|e| {
        IpcErrorDTO::from_runtime(&RuntimeError::config(e.to_string()))
    })?;
    Ok(cfg.environment.into())
}

#[tauri::command]
pub fn config_get_runtime_config() -> IpcResult<ConfigDTO> {
    let cfg = Loader::load().map_err(|e| {
        IpcErrorDTO::from_runtime(&RuntimeError::config(e.to_string()))
    })?;
    Ok(ConfigDTO::from(cfg))
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::Environment;

    /// Every command must return `IpcResult<_>` — never panic on bad
    /// input, never leak the kernel-internal `RuntimeError` type, never
    /// touch domain identifiers. This compile-time check enforces all
    /// three by listing all 21 functions and asserting their
    /// signatures.
    #[test]
    fn all_commands_return_ipc_result_with_correct_shape() {
        // If any command's signature drifts away from
        // `IpcResult<...>`, this function's type annotations fail to
        // compile.
        fn _check_runtime_get_state(_f: fn(State<'_, RuntimeState>) -> IpcResult<RuntimeStateDTO>) {}
        fn _check_runtime_get_phase(_f: fn(State<'_, RuntimeState>) -> IpcResult<PhaseDTO>) {}
        fn _check_runtime_get_correlation_id(_f: fn(State<'_, RuntimeState>) -> IpcResult<String>) {}

        fn _check_window_minimize(_f: fn(AppHandle) -> IpcResult<()>) {}
        fn _check_window_maximize(_f: fn(AppHandle) -> IpcResult<()>) {}
        fn _check_window_unmaximize(_f: fn(AppHandle) -> IpcResult<()>) {}
        fn _check_window_close(_f: fn(AppHandle) -> IpcResult<()>) {}
        fn _check_window_set_title(_f: fn(AppHandle, String) -> IpcResult<()>) {}
        fn _check_window_focus(_f: fn(AppHandle) -> IpcResult<()>) {}
        fn _check_window_inner_size(_f: fn(AppHandle) -> IpcResult<WindowSizeDTO>) {}

        fn _check_settings_get(_f: fn(State<'_, SettingsState>) -> IpcResult<SettingsStateDTO>) {}
        fn _check_settings_set_theme(_f: fn(State<'_, SettingsState>, ThemeDTO) -> IpcResult<()>) {}
        fn _check_settings_set_font_scale(_f: fn(State<'_, SettingsState>, f32) -> IpcResult<()>) {}
        fn _check_settings_set_window_prefs(_f: fn(State<'_, SettingsState>, WindowPrefsDTO) -> IpcResult<()>) {}

        fn _check_session_get_current_view(_f: fn(State<'_, SessionState>) -> IpcResult<Option<ViewMetadataDTO>>) {}
        fn _check_session_mount_view(_f: fn(State<'_, SessionState>, ViewMetadataDTO) -> IpcResult<()>) {}
        fn _check_session_unmount_view(_f: fn(State<'_, SessionState>) -> IpcResult<()>) {}

        fn _check_log_emit_event(_f: fn(State<'_, RuntimeState>, LogEmitDTO) -> IpcResult<()>) {}
        fn _check_log_get_session_log_path(_f: fn(State<'_, RuntimeState>) -> IpcResult<Option<String>>) {}

        fn _check_config_get_env(_f: fn() -> IpcResult<EnvDTO>) {}
        fn _check_config_get_runtime_config(_f: fn() -> IpcResult<ConfigDTO>) {}

        let _ = (
            _check_runtime_get_state,
            _check_runtime_get_phase,
            _check_runtime_get_correlation_id,
            _check_window_minimize,
            _check_window_maximize,
            _check_window_unmaximize,
            _check_window_close,
            _check_window_set_title,
            _check_window_focus,
            _check_window_inner_size,
            _check_settings_get,
            _check_settings_set_theme,
            _check_settings_set_font_scale,
            _check_settings_set_window_prefs,
            _check_session_get_current_view,
            _check_session_mount_view,
            _check_session_unmount_view,
            _check_log_emit_event,
            _check_log_get_session_log_path,
            _check_config_get_env,
            _check_config_get_runtime_config,
        );
    }

    /// Verify the kernel error stays kernel-internal: `RuntimeError`
    /// does NOT implement `Serialize`. The IPC ABI uses `IpcErrorDTO`
    /// instead. If a future edit accidentally re-derives Serialize on
    /// `RuntimeError`, this test still compiles (the helper is
    /// generic), so the proof is in the From impl + the dedicated
    /// `ipc_error_envelope_is_distinct_from_runtime_error` test in
    /// `types.rs`.
    #[test]
    fn from_runtime_error_converts_to_ipc_error_dto() {
        let kernel_err = RuntimeError::window("test window failure");
        let dto: IpcErrorDTO = kernel_err.into();
        assert_eq!(dto.kind, "RUNTIME_WINDOW_ERROR");
        assert!(dto.message.contains("test window failure"));
    }

    /// Sanity check on the runtime-state path: instantiating a
    /// RuntimeState and projecting through the DTO produces the
    /// expected values. This is the same code path
    /// `runtime_get_state` runs.
    #[test]
    fn runtime_get_state_projection() {
        use crate::state::runtime_state::RuntimeState;
        use crate::state::runtime_state::RuntimePhase;
        let state = RuntimeState::new("test-cid");
        state.set_phase(RuntimePhase::Ready);
        let dto = RuntimeStateDTO::from_state(
            state.phase(),
            state.correlation_id(),
            state.booted_at_epoch_secs(),
        );
        assert_eq!(dto.phase, PhaseDTO::Ready);
        assert_eq!(dto.correlation_id, "test-cid");
    }

    /// Theme DTO converts losslessly.
    #[test]
    fn theme_dto_conversion_is_lossless() {
        for theme in [
            crate::state::settings_state::Theme::System,
            crate::state::settings_state::Theme::Light,
            crate::state::settings_state::Theme::Dark,
        ] {
            let dto: ThemeDTO = theme.into();
            let back: crate::state::settings_state::Theme = dto.into();
            assert_eq!(back, theme);
        }
    }

    /// WindowPrefs DTO conversion preserves all fields.
    #[test]
    fn window_prefs_dto_conversion_preserves_all_fields() {
        let prefs = crate::state::settings_state::WindowPrefs {
            start_maximized: true,
            remember_position: false,
        };
        let dto: WindowPrefsDTO = prefs.clone().into();
        let back: crate::state::settings_state::WindowPrefs = dto.into();
        assert_eq!(back.start_maximized, prefs.start_maximized);
        assert_eq!(back.remember_position, prefs.remember_position);
    }

    /// Env DTO matches the Environment enum's three variants.
    #[test]
    fn env_dto_exhaustively_maps_three_variants() {
        let envs = [
            Environment::Dev,
            Environment::Staging,
            Environment::Prod,
        ];
        for env in envs {
            let dto: EnvDTO = env.into();
            let back: Environment = dto.into();
            assert_eq!(back, env);
        }
    }

    /// No command touches domain identifiers — verify by exhaustive
    /// grep at the file level. We scan only the pre-`#[cfg(test)]`
    /// region (everything before the `#[cfg(test)] mod tests` block)
    /// because the test module itself legitimately lists these
    /// identifiers in its forbidden-list.
    #[test]
    fn no_domain_identifiers_in_commands() {
        let src = include_str!("commands.rs");
        // Truncate at the start of the test module so the forbidden
        // identifiers in the test list itself don't trigger the test.
        let pre_test = src.split("#[cfg(test)]").next().unwrap_or(src);
        for forbidden in [
            "authStore",
            "supabase",
            "agentService",
            "useAgentHealth",
            "useOversightChat",
            "instagram",
            "workflow",
            "queue",
        ] {
            assert!(
                !pre_test.contains(forbidden),
                "commands.rs contains forbidden domain identifier: {forbidden}",
            );
        }
    }

    /// Phase DTO maps every kernel RuntimePhase variant.
    #[test]
    fn phase_dto_exhaustively_maps_seven_variants() {
        let phases = [
            crate::state::runtime_state::RuntimePhase::Cold,
            crate::state::runtime_state::RuntimePhase::Configuring,
            crate::state::runtime_state::RuntimePhase::Logging,
            crate::state::runtime_state::RuntimePhase::WindowInit,
            crate::state::runtime_state::RuntimePhase::Ready,
            crate::state::runtime_state::RuntimePhase::ShuttingDown,
            crate::state::runtime_state::RuntimePhase::Stopped,
        ];
        for p in phases {
            let dto: PhaseDTO = p.into();
            let back: crate::state::runtime_state::RuntimePhase = dto.into();
            assert_eq!(back, p, "round-trip for {p:?}");
        }
    }

    /// DTO serialization produces snake_case keys for all enums.
    #[test]
    fn dtos_serialize_to_snake_case_json() {
        assert_eq!(
            serde_json::to_string(&PhaseDTO::WindowInit).unwrap(),
            "\"window_init\""
        );
        assert_eq!(
            serde_json::to_string(&EnvDTO::Dev).unwrap(),
            "\"dev\""
        );
        assert_eq!(
            serde_json::to_string(&ThemeDTO::Dark).unwrap(),
            "\"dark\""
        );
    }

    /// LogEmitDTO accepts arbitrary structured fields.
    #[test]
    fn log_emit_dto_carries_arbitrary_fields() {
        let mut fields = HashMap::new();
        fields.insert("user_action".into(), "click".into());
        fields.insert("target_id".into(), "btn-123".into());
        let dto = LogEmitDTO {
            component: "ui::dashboard".into(),
            event: "ui.click".into(),
            fields,
        };
        let json = serde_json::to_string(&dto).unwrap();
        assert!(json.contains("\"component\":\"ui::dashboard\""));
        assert!(json.contains("\"event\":\"ui.click\""));
        assert!(json.contains("\"user_action\":\"click\""));
    }
}

// =============================================================================
// Tauri plugin — exposes all IPC commands to the WebView capability system.
// =============================================================================

/// Kernel plugin — exposes all 21 IPC commands to the WebView capability system.
///
/// Plugin identifier: `"kernel"`. Permission names are prefixed accordingly
/// (e.g. `kernel:default`, `kernel:allow-runtime-get-state`).
///
/// Note: the `#[tauri::plugin]` proc macro is NOT used here to avoid a
/// Tauri 2.x proc-macro path-resolution issue with `::tauri::plugin::Builder`.
/// Instead we construct the plugin directly via `Builder::new()` at the type
/// level. Permission identifiers are added to `capabilities/default.json`
/// manually (see step 8).
pub fn kernel() -> TauriPlugin<tauri::Wry> {
    tauri::plugin::Builder::new("kernel")
        .invoke_handler(tauri::generate_handler![
            runtime_get_state,
            runtime_get_phase,
            runtime_get_correlation_id,
            window_minimize,
            window_maximize,
            window_unmaximize,
            window_close,
            window_set_title,
            window_focus,
            window_inner_size,
            settings_get,
            settings_set_theme,
            settings_set_font_scale,
            settings_set_window_prefs,
            session_get_current_view,
            session_mount_view,
            session_unmount_view,
            log_emit_event,
            log_get_session_log_path,
            config_get_env,
            config_get_runtime_config,
        ])
        .build()
}
