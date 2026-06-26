//! Runtime-level state owned by the kernel.
//!
//! This type holds metadata about the *runtime process itself*: when it
//! started, what phase it is in, the active correlation id. It is not an
//! authenticated user session, not a tenant context, not a business
//! record.

use std::sync::atomic::{AtomicU8, Ordering};

use serde::{Deserialize, Serialize};

/// Phase of the bootstrap lifecycle.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RuntimePhase {
    Cold,
    Configuring,
    Logging,
    WindowInit,
    Ready,
    ShuttingDown,
    Stopped,
}

impl RuntimePhase {
    pub const fn as_str(&self) -> &'static str {
        match self {
            Self::Cold => "cold",
            Self::Configuring => "configuring",
            Self::Logging => "logging",
            Self::WindowInit => "window_init",
            Self::Ready => "ready",
            Self::ShuttingDown => "shutting_down",
            Self::Stopped => "stopped",
        }
    }
}

/// Runtime state, owned by the kernel.
///
/// Per the Phase 1 Step C contract, `RuntimeState` exposes exactly three
/// fields:
///
/// - `booted_at_epoch_secs` — when `Runtime::boot` was entered
/// - `correlation_id` — the per-boot UUID v4
/// - `phase` — current [`RuntimePhase`] (atomic, lock-free)
///
/// This is the metadata the kernel needs to make decisions; it is **not**
/// a logger, not a config, not a window handle. The bootstrap layer logs
/// through `tracing` and looks up other state via Tauri-managed
/// `tauri::State<T>` handles.
#[derive(Debug)]
pub struct RuntimeState {
    booted_at_epoch_secs: u64,
    correlation_id: String,
    phase: AtomicU8,
}

impl RuntimeState {
    /// Construct a fresh `RuntimeState`. `correlation_id` should be the
    /// UUID v4 generated at the very start of `Runtime::boot`.
    pub fn new(correlation_id: impl Into<String>) -> Self {
        Self {
            booted_at_epoch_secs: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0),
            correlation_id: correlation_id.into(),
            phase: AtomicU8::new(RuntimePhase::Cold as u8),
        }
    }

    pub fn correlation_id(&self) -> &str {
        &self.correlation_id
    }

    pub fn booted_at_epoch_secs(&self) -> u64 {
        self.booted_at_epoch_secs
    }

    pub fn phase(&self) -> RuntimePhase {
        match self.phase.load(Ordering::SeqCst) {
            x if x == RuntimePhase::Cold as u8 => RuntimePhase::Cold,
            x if x == RuntimePhase::Configuring as u8 => RuntimePhase::Configuring,
            x if x == RuntimePhase::Logging as u8 => RuntimePhase::Logging,
            x if x == RuntimePhase::WindowInit as u8 => RuntimePhase::WindowInit,
            x if x == RuntimePhase::Ready as u8 => RuntimePhase::Ready,
            x if x == RuntimePhase::ShuttingDown as u8 => RuntimePhase::ShuttingDown,
            _ => RuntimePhase::Stopped,
        }
    }

    pub fn set_phase(&self, phase: RuntimePhase) {
        self.phase.store(phase as u8, Ordering::SeqCst);
    }
}

/// Composite state handle — every IPC command and every observer of the
/// runtime reaches into this single `Arc<AppState>` instead of holding
/// four separate `tauri::State<T>` handles.
///
/// Per the Phase 1 Step C contract:
/// "`runtime_state.rs` defines `pub struct AppState { runtime, window,
/// settings, session }` (composite, also `Send + Sync`)"
///
/// `AppState` is automatically `Send + Sync` because each field is
/// `Arc<T>` where `T: Send + Sync`.
#[derive(Debug, Clone)]
pub struct AppState {
    pub runtime: std::sync::Arc<RuntimeState>,
    pub window: std::sync::Arc<crate::state::WindowState>,
    pub settings: std::sync::Arc<crate::state::SettingsState>,
    pub session: std::sync::Arc<crate::state::SessionState>,
}

impl AppState {
    pub fn new(
        runtime: std::sync::Arc<RuntimeState>,
        window: std::sync::Arc<crate::state::WindowState>,
        settings: std::sync::Arc<crate::state::SettingsState>,
        session: std::sync::Arc<crate::state::SessionState>,
    ) -> Self {
        Self {
            runtime,
            window,
            settings,
            session,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn runtime_state_initial_phase_is_cold() {
        let state = RuntimeState::new("test-cid");
        assert_eq!(state.phase(), RuntimePhase::Cold);
    }

    #[test]
    fn runtime_state_phase_transitions() {
        let state = RuntimeState::new("test-cid");
        state.set_phase(RuntimePhase::Configuring);
        assert_eq!(state.phase(), RuntimePhase::Configuring);
        state.set_phase(RuntimePhase::Ready);
        assert_eq!(state.phase(), RuntimePhase::Ready);
        state.set_phase(RuntimePhase::ShuttingDown);
        assert_eq!(state.phase(), RuntimePhase::ShuttingDown);
        state.set_phase(RuntimePhase::Stopped);
        assert_eq!(state.phase(), RuntimePhase::Stopped);
    }

    #[test]
    fn runtime_state_serde_round_trip() {
        // The phase enum is serde; verifying the wire format is stable.
        let json = serde_json::to_string(&RuntimePhase::Ready).unwrap();
        assert_eq!(json, "\"ready\"");
        let back: RuntimePhase = serde_json::from_str(&json).unwrap();
        assert_eq!(back, RuntimePhase::Ready);
    }

    #[test]
    fn correlation_id_is_preserved() {
        let state = RuntimeState::new("00000000-0000-0000-0000-000000000000");
        assert_eq!(state.correlation_id(), "00000000-0000-0000-0000-000000000000");
    }

    #[test]
    fn booted_at_is_set_at_construction() {
        let before = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let state = RuntimeState::new("cid");
        let after = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let booted = state.booted_at_epoch_secs();
        assert!(
            booted >= before && booted <= after,
            "booted_at {booted} not in [{before}, {after}]",
        );
    }

    #[test]
    fn app_state_field_layout_matches_contract() {
        // Compile-time + structural assertion: AppState has exactly
        // four fields with the names the Phase 1 contract requires.
        let cid = "cid".to_string();
        let runtime = std::sync::Arc::new(RuntimeState::new(cid.clone()));
        let window = std::sync::Arc::new(crate::state::WindowState::new(
            "main", "title", 800, 600,
        ));
        let settings = std::sync::Arc::new(crate::state::SettingsState::new());
        let session = std::sync::Arc::new(crate::state::SessionState::new("s1"));
        let app = AppState::new(
            std::sync::Arc::clone(&runtime),
            std::sync::Arc::clone(&window),
            std::sync::Arc::clone(&settings),
            std::sync::Arc::clone(&session),
        );
        assert_eq!(app.runtime.correlation_id(), "cid");
        assert_eq!(app.window.label(), "main");
        assert_eq!(app.session.session_id(), "s1");
    }
}
