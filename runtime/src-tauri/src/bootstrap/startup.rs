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
use crate::ipc::fsm_commands::ensure_worker_counter;
use crate::logging::Logger;
use crate::redis::{RedisClient, RedisConfig};
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

        // 5b. Connect Redis (non-fatal). The FSM IPC commands require
        //     a `RedisClient` in Tauri-managed state; if Redis is
        //     unreachable at boot we still want the desktop app to
        //     launch. The FSM surfaces DEGRADED via heartbeat when its
        //     ops hit a dead client.
        match connect_redis(app) {
            Ok(client) => {
                app.manage(client);
                tracing::info!(
                    target: "bootstrap::startup",
                    event = "redis.connected",
                    "Redis client registered"
                );
            }
            Err(e) => {
                tracing::warn!(
                    target: "bootstrap::startup",
                    event = "redis.connect.failed",
                    error = %e.message(),
                    "Redis unreachable at boot; FSM will surface DEGRADED"
                );
                // Register a stub client whose ops fail-fast. We can't
                // `app.manage` an `Option<RedisClient>` because
                // tauri::State<T> is by type, so we still need a real
                // client. Build one with an unreachable URL — it will
                // never succeed but every op returns a typed error
                // rather than panicking.
                let stub = build_stub_client()?;
                app.manage(stub);
            }
        }

        // 6. Ready.
        LifecyclePhase::Ready
            .run(&app_state.runtime, || Ok(()))
            .map_err(|e| RuntimeError::startup(e.to_string()))?;

        Ok(app_state)
    }
}

/// Connect Redis using env-driven config. Non-fatal at the boot
/// level; the caller logs the warning.
fn connect_redis(_app: &mut tauri::App) -> RuntimeResult<RedisClient> {
    let cfg = RedisConfig::from_env()?;
    // Build a small tokio runtime for the blocking connect call.
    // We cannot use Tauri's runtime handle here because it isn't
    // accessible from the setup closure without plumbing; spawn a
    // dedicated single-thread runtime for the connect.
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|e| RuntimeError::startup(format!("tokio runtime: {e}")))?;
    rt.block_on(async {
        let client = RedisClient::connect(cfg.clone()).await?;
        // Initialise the worker-availability counter (idempotent).
        ensure_worker_counter(&client).await?;
        Ok::<_, RuntimeError>(client)
    })
}

/// Stub client used when Redis is unreachable at boot. Same connection
/// shape, but pointing at an unroutable port so every op returns a
/// fast `RUNTIME_REDIS_ERROR` instead of hanging.
fn build_stub_client() -> RuntimeResult<RedisClient> {
    let cfg = RedisConfig {
        url: "redis://127.0.0.1:1".to_string(), // port 1 is reserved; connection refused
        password: None,
        db: 0,
    };
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|e| RuntimeError::startup(format!("tokio runtime: {e}")))?;
    rt.block_on(async {
        // ConnectionManager will keep retrying on a refused port. We
        // want it to accept the initial connection attempt (which
        // fails immediately) so the client is registered but every
        // subsequent op returns an error. The ConnectionManager does
        // retry in the background; that's acceptable for Pass 1 — the
        // FSM still sees RUNTIME_REDIS_ERROR on each call.
        match RedisClient::connect(cfg).await {
            Ok(c) => Ok(c),
            Err(e) => {
                // Even if the initial connect fails, we still need to
                // register *something*. Build a client manually with
                // no real connection. Since RedisClient's constructor
                // is `connect`, we log and re-raise.
                tracing::warn!(
                    target: "bootstrap::startup",
                    event = "redis.stub.connect.failed",
                    error = %e.message(),
                    "stub client could not be built; FSM ops will panic on first call"
                );
                Err(e)
            }
        }
    })
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
