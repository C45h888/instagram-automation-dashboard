//! Runtime entry point.
//!
//! `Runtime::boot()` is the only function called from `main.rs`. It is
//! responsible for:
//!
//! 1. Generating the per-boot correlation id (UUID v4).
//! 2. Constructing the Tauri application.
//! 3. Running the startup sequence.
//! 4. Entering the Tauri event loop.
//! 5. Running the shutdown sequence on exit.
//!
//! On success, `boot()` returns a [`RuntimeHandle`] that exposes the
//! correlation id and boot timestamp to `main.rs`. The handle is a
//! read-only marker — runtime state continues to live in Tauri's managed
//! state after `boot()` returns.
//!
//! The runtime never touches domain concerns. It hosts the WebView; the
//! preserved TypeScript platform is responsible for what runs inside it.

use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::Manager;

use crate::bootstrap::shutdown::Shutdown;
use crate::bootstrap::startup::Startup;
use crate::error::runtime_error::{RuntimeError, RuntimeResult};

/// The runtime itself. Pure namespace — every member is a static method.
#[derive(Debug)]
pub struct Runtime;

/// Read-only handle returned from [`Runtime::boot`].
///
/// `RuntimeHandle` is what `main.rs` sees when the boot sequence
/// completes successfully. It carries:
///
/// - `correlation_id` — the UUID v4 that threads through every log line
///   emitted during this boot session.
/// - `booted_at_epoch_secs` — the Unix timestamp of the moment `boot()`
///   was called. Useful for tests and for `main.rs` to log a final
///   "process complete" line.
///
/// The handle intentionally holds *no domain-shaped data*. It cannot be
/// used to send commands, read window state, or influence the runtime
/// after `boot()` returns.
#[derive(Debug, Clone)]
pub struct RuntimeHandle {
    correlation_id: String,
    booted_at_epoch_secs: u64,
}

impl RuntimeHandle {
    /// The per-boot UUID v4 that threads through every log line in this
    /// session.
    pub fn correlation_id(&self) -> &str {
        &self.correlation_id
    }

    /// Unix-epoch seconds at the moment [`Runtime::boot`] was entered.
    pub fn booted_at_epoch_secs(&self) -> u64 {
        self.booted_at_epoch_secs
    }
}

impl Runtime {
    /// Boot the runtime. Returns when the user closes the main window.
    ///
    /// On success returns a [`RuntimeHandle`] that exposes the
    /// correlation id and boot timestamp. On failure returns a
    /// [`RuntimeError`] describing which phase failed.
    pub fn boot() -> RuntimeResult<RuntimeHandle> {
        // Generate the correlation id FIRST, then enter a tracing Span
        // that carries it. Every log emitted inside the Span (and any
        // child Span) automatically includes `correlation_id` as a
        // structured field — this is how the plan's "threaded through
        // every log" requirement is satisfied without manual plumbing.
        let correlation_id = uuid::Uuid::new_v4().to_string();
        let boot_span = tracing::info_span!(
            "runtime.boot",
            correlation_id = %correlation_id,
        );
        let _boot_guard = boot_span.enter();

        let booted_at_epoch_secs = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);

        let context = tauri::generate_context!();
        let app = tauri::Builder::default()
            .invoke_handler(tauri::generate_handler![
                crate::ipc::commands::runtime_get_state,
                crate::ipc::commands::runtime_get_phase,
                crate::ipc::commands::runtime_get_correlation_id,
                crate::ipc::commands::window_minimize,
                crate::ipc::commands::window_maximize,
                crate::ipc::commands::window_unmaximize,
                crate::ipc::commands::window_close,
                crate::ipc::commands::window_set_title,
                crate::ipc::commands::window_focus,
                crate::ipc::commands::window_inner_size,
                crate::ipc::commands::settings_get,
                crate::ipc::commands::settings_set_theme,
                crate::ipc::commands::settings_set_font_scale,
                crate::ipc::commands::settings_set_window_prefs,
                crate::ipc::commands::session_get_current_view,
                crate::ipc::commands::session_mount_view,
                crate::ipc::commands::session_unmount_view,
                crate::ipc::commands::log_emit_event,
                crate::ipc::commands::log_get_session_log_path,
                crate::ipc::commands::config_get_env,
                crate::ipc::commands::config_get_runtime_config,
            ])
            .setup(|app| {
                // Run the startup sequence. If it fails, the setup
                // callback returns an error and Tauri's run loop
                // exits.
                let app_state = Startup::run(app)?;
                // Capture the runtime state so the shutdown hook can
                // reach it. (The full AppState is also managed with
                // Tauri for IPC consumers.)
                app.manage(BootstrapHandle {
                    runtime: app_state.runtime.clone(),
                });
                Ok(())
            })
            .build(context)
            .map_err(|e| RuntimeError::startup(e.to_string()))?;

        app.run(|_app, event| {
            if let tauri::RunEvent::ExitRequested { .. } = event {
                // Best-effort shutdown. We cannot return a Result from
                // this callback; log any error and continue.
                if let Some(handle) = _app.try_state::<BootstrapHandle>() {
                    let _ = Shutdown::run(&handle.runtime);
                }
            }
        });

        Ok(RuntimeHandle {
            correlation_id,
            booted_at_epoch_secs,
        })
    }
}

/// Internal handle kept in Tauri-managed state so the shutdown hook can
/// reach the runtime state without going through `app.manage(AppState)`
/// (which only IPC commands can access).
struct BootstrapHandle {
    runtime: Arc<crate::state::RuntimeState>,
}
