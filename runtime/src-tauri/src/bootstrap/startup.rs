//! Startup sequencing for the runtime.
//!
//! The startup phase runs the lifecycle in this fixed order:
//!
//! 1. `Init` — initial state, no subscriber yet
//! 2. `Configure` — load and validate configuration
//! 3. `Log` — install the global `tracing` subscriber
//! 4. `Window` — open the main window
//! 5. `Ready` — runtime is ready to serve
//!
//! On any phase failure, the function returns an error. The bootstrap
//! layer is responsible for translating that error into a clean exit.

use std::sync::Arc;

use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

use crate::bootstrap::lifecycle::{Lifecycle, LifecyclePhase};
use crate::config::loader::Loader;
use crate::config::Config;
use crate::error::runtime_error::RuntimeError;
use crate::error::runtime_error::RuntimeResult;
use crate::logging::Logger;
use crate::state::{
    AppState, RuntimeState, SessionState, SettingsState, ViewMetadata, WindowState,
};

#[derive(Debug)]
pub struct Startup;

impl Startup {
    pub fn run(app: &mut tauri::App) -> RuntimeResult<Arc<AppState>> {
        // 1. Init: construct the initial runtime state. The tracing
        //    subscriber is NOT installed yet — `tracing::info!` calls in
        //    this phase are no-ops by design (per the Phase 1 plan:
        //    the subscriber is installed in the `Log` phase below).
        let correlation_id = uuid::Uuid::new_v4().to_string();
        let state = Arc::new(RuntimeState::new(correlation_id));
        LifecyclePhase::Init
            .run(&state, || Ok(()))
            .map_err(|e| RuntimeError::startup(e.to_string()))?;

        // 2. Configure: load config, validate.
        let config: Config = LifecyclePhase::Configure
            .run_value(&state, Loader::load)
            .map_err(|e| RuntimeError::startup(e.to_string()))?;

        // 3. Log: install the global tracing subscriber via
        //    `Logger::init`. From this point on, every `tracing::info!`
        //    emitted inside the `runtime.boot` Span carries the
        //    correlation_id automatically.
        LifecyclePhase::Log
            .run_value(&state, || Logger::init(&config.logging))
            .map_err(|e| RuntimeError::startup(e.to_string()))?;

        // 4. Window: open the main window.
        let window: Arc<WindowState> = LifecyclePhase::Window
            .run_value(&state, || open_window(app, &config.window))
            .map_err(|e| RuntimeError::startup(e.to_string()))?;

        // 5. Manage the four state containers individually (Tauri
        //    requires each `manage` to be a distinct type) AND the
        //    composite `AppState` for callers that want all four at
        //    once. The individual `manage` calls are kept because
        //    `tauri::State<T>` extraction is by type, not by struct
        //    member.
        let settings = Arc::new(SettingsState::new());
        let session = Arc::new(SessionState::new(uuid::Uuid::new_v4().to_string()));
        session.mount_view(ViewMetadata::new(window.label()));
        let app_state = Arc::new(AppState::new(
            state.clone(),
            window.clone(),
            settings.clone(),
            session.clone(),
        ));

        app.manage(state);
        app.manage(window);
        app.manage(settings);
        app.manage(session);
        app.manage(app_state.clone());

        // 6. Ready.
        LifecyclePhase::Ready
            .run(&app_state.runtime, || Ok(()))
            .map_err(|e| RuntimeError::startup(e.to_string()))?;

        Ok(app_state)
    }
}

fn open_window(
    app: &tauri::App,
    cfg: &crate::config::WindowConfig,
) -> RuntimeResult<Arc<WindowState>> {
    let builder = WebviewWindowBuilder::new(
        app,
        "main",
        WebviewUrl::App("about:blank".into()),
    )
    .title(&cfg.title)
    .inner_size(cfg.width as f64, cfg.height as f64)
    .min_inner_size(cfg.min_width as f64, cfg.min_height as f64)
    .resizable(cfg.resizable);

    let window = builder
        .build()
        .map_err(|e| RuntimeError::window(e.to_string()))?;
    let state = Arc::new(WindowState::new(
        window.label(),
        cfg.title.clone(),
        cfg.width,
        cfg.height,
    ));
    Ok(state)
}
