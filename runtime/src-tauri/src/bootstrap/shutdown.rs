//! Shutdown sequencing for the runtime.
//!
//! Shutdown is idempotent. Calling it twice does not panic. Each phase
//! emits a structured log via `tracing::info!`. The runtime transitions
//! the state to [`RuntimePhase::ShuttingDown`] then
//! [`RuntimePhase::Stopped`].
//!
//! Note: there is no `Stopped` variant in [`LifecyclePhase`] — the
//! Phase 1 plan defines exactly six phases
//! (`Init → Configure → Log → Window → Ready → Shutdown`). The
//! post-shutdown transition is recorded by setting
//! [`RuntimePhase::Stopped`] directly and emitting one final
//! "runtime.shutdown.complete" log line.

use crate::bootstrap::lifecycle::{Lifecycle, LifecyclePhase};
use crate::error::runtime_error::RuntimeError;
use crate::error::runtime_error::RuntimeResult;
use crate::state::RuntimeState;

#[derive(Debug)]
pub struct Shutdown;

impl Shutdown {
    pub fn run(state: &RuntimeState) -> RuntimeResult<()> {
        // Idempotency: if we are already stopped, return Ok. This makes
        // Shutdown safe to call from multiple paths (Tauri's
        // ExitRequested event, signal handlers, panic unwind, etc.).
        if state.phase() == crate::state::RuntimePhase::Stopped {
            return Ok(());
        }

        // Shutdown phase is best-effort. The tracing::info! logs inside
        // the `run` call carry the correlation_id inherited from the
        // boot Span.
        LifecyclePhase::Shutdown
            .run(state, || Ok(()))
            .map_err(|e| RuntimeError::shutdown(e.to_string()))?;

        // Final transition — record the terminal state and emit a
        // completion log. Closing of the window is handled by Tauri's
        // run loop exit; we just publish the fact that the runtime
        // kernel considers itself shut down.
        tracing::info!(
            target: "bootstrap::shutdown",
            event = "runtime.shutdown.complete",
            "shutdown complete",
        );
        state.set_phase(crate::state::RuntimePhase::Stopped);

        Ok(())
    }
}
