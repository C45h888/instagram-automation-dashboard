//! IPC type bridge — DTOs that flow across the Tauri IPC boundary.
//!
//! Every type in this module is a **plain-data mirror** of a kernel type.
//! Conversions live next to each DTO. No business types cross this
//! boundary — auth, agents, queues, and workflows all stay in the
//! preserved TypeScript layer.
//!
//! The DTOs derive `Serialize`/`Deserialize` so Tauri can marshal them
//! across the WebView boundary as JSON. Field naming is `snake_case` to
//! match the rest of the runtime.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::config::config::{Environment, LoggingConfig};
use crate::error::runtime_error::RuntimeError;
use crate::state::runtime_state::RuntimePhase;
use crate::state::session_state::ViewMetadata;
use crate::state::settings_state::{SettingsState, Theme, WindowPrefs};

// =============================================================================
// IPC error envelope
// =============================================================================
//
// The kernel's `RuntimeError` is intentionally NOT serializable — it's an
// internal taxonomy. At the IPC seam we project it into `IpcErrorDTO`
// which is the public error contract the WebView sees. The mapping is
// lossless on the discriminant (`kind` string) and the human message,
// but internal-only fields (like the auto-mapped `From` source errors)
// are flattened into `message`.
//
// This keeps the kernel's error model free to evolve (add fields,
// add variants) without breaking the IPC ABI.

/// Stable, machine-readable error envelope returned to the WebView when
/// an IPC command fails. Matches the shape the WebView's typed adapter
/// (`runtime/web/src/lib/ipc/errors.ts`) is written against.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct IpcErrorDTO {
    /// The error kind code from [`RuntimeError::kind`], e.g.
    /// `"RUNTIME_WINDOW_ERROR"`. **Stable across IPC ABI versions.**
    pub kind: String,
    /// Human-readable error message. Suitable for surfacing in the UI
    /// but not stable across versions.
    pub message: String,
}

impl IpcErrorDTO {
    pub fn from_runtime(err: &RuntimeError) -> Self {
        Self {
            kind: err.kind().to_string(),
            message: err.to_string(),
        }
    }
}

// =============================================================================
// Runtime state
// =============================================================================

/// DTO mirror of [`crate::state::RuntimeState`]. Returned by
/// `runtime_get_state`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RuntimeStateDTO {
    pub phase: PhaseDTO,
    pub correlation_id: String,
    pub booted_at_epoch_secs: u64,
}

/// String-tagged phase enum for the IPC boundary. Mirrors
/// [`RuntimePhase`] but uses lowercase strings that map cleanly to TS
/// discriminated unions.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PhaseDTO {
    Cold,
    Configuring,
    Logging,
    WindowInit,
    Ready,
    ShuttingDown,
    Stopped,
}

impl From<RuntimePhase> for PhaseDTO {
    fn from(p: RuntimePhase) -> Self {
        match p {
            RuntimePhase::Cold => Self::Cold,
            RuntimePhase::Configuring => Self::Configuring,
            RuntimePhase::Logging => Self::Logging,
            RuntimePhase::WindowInit => Self::WindowInit,
            RuntimePhase::Ready => Self::Ready,
            RuntimePhase::ShuttingDown => Self::ShuttingDown,
            RuntimePhase::Stopped => Self::Stopped,
        }
    }
}

impl From<PhaseDTO> for RuntimePhase {
    fn from(d: PhaseDTO) -> Self {
        match d {
            PhaseDTO::Cold => Self::Cold,
            PhaseDTO::Configuring => Self::Configuring,
            PhaseDTO::Logging => Self::Logging,
            PhaseDTO::WindowInit => Self::WindowInit,
            PhaseDTO::Ready => Self::Ready,
            PhaseDTO::ShuttingDown => Self::ShuttingDown,
            PhaseDTO::Stopped => Self::Stopped,
        }
    }
}

impl RuntimeStateDTO {
    pub fn from_state(
        phase: RuntimePhase,
        correlation_id: impl Into<String>,
        booted_at_epoch_secs: u64,
    ) -> Self {
        Self {
            phase: phase.into(),
            correlation_id: correlation_id.into(),
            booted_at_epoch_secs,
        }
    }
}

// =============================================================================
// Settings
// =============================================================================

/// DTO mirror of [`SettingsState`].
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SettingsStateDTO {
    pub theme: ThemeDTO,
    pub font_scale: f32,
    pub window_prefs: WindowPrefsDTO,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ThemeDTO {
    System,
    Light,
    Dark,
}

impl From<Theme> for ThemeDTO {
    fn from(t: Theme) -> Self {
        match t {
            Theme::System => Self::System,
            Theme::Light => Self::Light,
            Theme::Dark => Self::Dark,
        }
    }
}

impl From<ThemeDTO> for Theme {
    fn from(d: ThemeDTO) -> Self {
        match d {
            ThemeDTO::System => Self::System,
            ThemeDTO::Light => Self::Light,
            ThemeDTO::Dark => Self::Dark,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct WindowPrefsDTO {
    pub start_maximized: bool,
    pub remember_position: bool,
}

impl From<WindowPrefs> for WindowPrefsDTO {
    fn from(p: WindowPrefs) -> Self {
        Self {
            start_maximized: p.start_maximized,
            remember_position: p.remember_position,
        }
    }
}

impl From<WindowPrefsDTO> for WindowPrefs {
    fn from(d: WindowPrefsDTO) -> Self {
        Self {
            start_maximized: d.start_maximized,
            remember_position: d.remember_position,
        }
    }
}

impl From<&SettingsState> for SettingsStateDTO {
    fn from(s: &SettingsState) -> Self {
        Self {
            theme: s.theme().into(),
            font_scale: s.font_scale(),
            window_prefs: s.window_prefs().into(),
        }
    }
}

// =============================================================================
// Session view
// =============================================================================

/// DTO mirror of [`ViewMetadata`].
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ViewMetadataDTO {
    pub view_id: String,
    pub mounted_at_epoch_secs: u64,
}

impl From<ViewMetadata> for ViewMetadataDTO {
    fn from(v: ViewMetadata) -> Self {
        Self {
            view_id: v.view_id,
            mounted_at_epoch_secs: v.mounted_at_epoch_secs,
        }
    }
}

impl From<ViewMetadataDTO> for ViewMetadata {
    fn from(d: ViewMetadataDTO) -> Self {
        Self {
            view_id: d.view_id,
            mounted_at_epoch_secs: d.mounted_at_epoch_secs,
        }
    }
}

// =============================================================================
// Window
// =============================================================================

/// Result of `window_inner_size`.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub struct WindowSizeDTO {
    pub width: u32,
    pub height: u32,
}

// =============================================================================
// Logging
// =============================================================================

/// Request type for `log_emit_event`. The WebView forwards a structured
/// event with arbitrary fields. The kernel forwards it to `tracing` so
/// the same correlation-id-aware log pipeline sees it.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEmitDTO {
    pub component: String,
    pub event: String,
    #[serde(default)]
    pub fields: HashMap<String, String>,
}

// =============================================================================
// Configuration / Environment
// =============================================================================

/// String-tagged environment enum for the IPC boundary. Mirrors
/// [`Environment`].
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum EnvDTO {
    Dev,
    Staging,
    Prod,
}

impl From<Environment> for EnvDTO {
    fn from(e: Environment) -> Self {
        match e {
            Environment::Dev => Self::Dev,
            Environment::Staging => Self::Staging,
            Environment::Prod => Self::Prod,
        }
    }
}

impl From<EnvDTO> for Environment {
    fn from(d: EnvDTO) -> Self {
        match d {
            EnvDTO::Dev => Self::Dev,
            EnvDTO::Staging => Self::Staging,
            EnvDTO::Prod => Self::Prod,
        }
    }
}

/// Snapshot of [`crate::config::config::Config`] for the WebView.
/// Includes `env`, `window`, and `logging` sub-objects.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigDTO {
    pub env: EnvDTO,
    pub window: WindowConfigDTO,
    pub logging: LoggingConfig,
}

/// DTO mirror of [`crate::config::config::WindowConfig`].
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowConfigDTO {
    pub title: String,
    pub width: u32,
    pub height: u32,
    pub min_width: u32,
    pub min_height: u32,
    pub resizable: bool,
}

impl From<crate::config::config::WindowConfig> for WindowConfigDTO {
    fn from(w: crate::config::config::WindowConfig) -> Self {
        Self {
            title: w.title,
            width: w.width,
            height: w.height,
            min_width: w.min_width,
            min_height: w.min_height,
            resizable: w.resizable,
        }
    }
}

impl From<crate::config::config::Config> for ConfigDTO {
    fn from(c: crate::config::config::Config) -> Self {
        Self {
            env: c.environment.into(),
            window: c.window.into(),
            logging: c.logging,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::runtime_state::RuntimePhase as KernelRuntimePhase;

    #[test]
    fn phase_dto_round_trips_through_serde() {
        let original = PhaseDTO::WindowInit;
        let json = serde_json::to_string(&original).unwrap();
        assert_eq!(json, "\"window_init\"");
        let back: PhaseDTO = serde_json::from_str(&json).unwrap();
        assert_eq!(back, original);
    }

    #[test]
    fn phase_dto_kernel_round_trip() {
        for kernel_phase in [
            KernelRuntimePhase::Cold,
            KernelRuntimePhase::Configuring,
            KernelRuntimePhase::Logging,
            KernelRuntimePhase::WindowInit,
            KernelRuntimePhase::Ready,
            KernelRuntimePhase::ShuttingDown,
            KernelRuntimePhase::Stopped,
        ] {
            let dto: PhaseDTO = kernel_phase.into();
            let back: KernelRuntimePhase = dto.into();
            assert_eq!(back, kernel_phase, "round-trip for {kernel_phase:?}");
        }
    }

    #[test]
    fn theme_dto_kernel_round_trip() {
        for theme in [Theme::System, Theme::Light, Theme::Dark] {
            let dto: ThemeDTO = theme.into();
            let back: Theme = dto.into();
            assert_eq!(back, theme);
        }
    }

    #[test]
    fn env_dto_kernel_round_trip() {
        for env in [Environment::Dev, Environment::Staging, Environment::Prod] {
            let dto: EnvDTO = env.into();
            let back: Environment = dto.into();
            assert_eq!(back, env);
        }
    }

    #[test]
    fn runtime_state_dto_serializes_with_expected_keys() {
        let dto = RuntimeStateDTO::from_state(
            KernelRuntimePhase::Ready,
            "00000000-0000-0000-0000-000000000000",
            1_700_000_000,
        );
        let value: serde_json::Value = serde_json::to_value(&dto).unwrap();
        assert_eq!(value["phase"], "ready");
        assert_eq!(value["correlation_id"], "00000000-0000-0000-0000-000000000000");
        assert_eq!(value["booted_at_epoch_secs"], 1_700_000_000u64);
    }
}
