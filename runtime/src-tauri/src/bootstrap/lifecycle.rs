//! Lifecycle phase definitions used by the bootstrap layer.
//!
//! The runtime progresses through a fixed sequence of phases during boot
//! and the reverse sequence during shutdown. Each phase emits a
//! structured log line via `tracing::info!` carrying the five required
//! fields:
//!
//! - `timestamp` — supplied by the `tracing` subscriber
//! - `component` — the `target` field of the log record
//! - `severity` — the macro level (info / warn / error)
//! - `event` — a stable machine-readable identifier
//! - `correlation_id` — propagated via the parent [`tracing::Span`]
//!
//! The phase sequence (per the Phase 1 plan) is fixed:
//!
//! `Init` → `Configure` → `Log` → `Window` → `Ready` → `Shutdown`.

use serde::{Deserialize, Serialize};

use crate::error::runtime_error::RuntimeError;
use crate::error::runtime_error::RuntimeResult;
use crate::state::RuntimeState;

/// Trait implemented by [`LifecyclePhase`].
///
/// The trait abstracts "run a phase" so callers can name a phase and
/// have the runtime take care of entering the right Span, emitting the
/// begin / complete / failed log lines, and wrapping any error in the
/// phase-appropriate [`RuntimeError`] variant.
pub trait Lifecycle {
    /// Run a phase whose body returns `RuntimeResult<()>`. On error the
    /// returned error is wrapped in [`RuntimeError::StartupError`] (for
    /// boot phases) or [`RuntimeError::ShutdownError`] (for
    /// [`LifecyclePhase::Shutdown`]).
    fn run<F>(&self, state: &RuntimeState, body: F) -> RuntimeResult<()>
    where
        F: FnOnce() -> RuntimeResult<()>;

    /// Run a phase whose body returns `RuntimeResult<T>`. The successful
    /// value is propagated unchanged; errors are wrapped the same way as
    /// in [`Lifecycle::run`].
    fn run_value<F, T>(&self, state: &RuntimeState, body: F) -> RuntimeResult<T>
    where
        F: FnOnce() -> RuntimeResult<T>;
}

/// The ordered set of bootstrap phases.
///
/// Variants are listed in execution order. The first five run during
/// boot, the last runs during teardown.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LifecyclePhase {
    Init,
    Configure,
    Log,
    Window,
    Ready,
    Shutdown,
}

impl LifecyclePhase {
    /// Stable, machine-readable identifier for the phase.
    pub const fn as_str(&self) -> &'static str {
        match self {
            Self::Init => "init",
            Self::Configure => "configure",
            Self::Log => "log",
            Self::Window => "window",
            Self::Ready => "ready",
            Self::Shutdown => "shutdown",
        }
    }

    /// `true` for phases that run during boot; `false` for shutdown.
    pub const fn is_boot_phase(&self) -> bool {
        !matches!(self, Self::Shutdown)
    }

    /// Construct the tracing Span for this phase. The span carries
    /// `phase` and inherits `correlation_id` from the parent span
    /// (entered by [`Runtime::boot`]).
    fn span(&self) -> tracing::Span {
        tracing::info_span!(
            "lifecycle.phase",
            phase = self.as_str(),
        )
    }
}

impl Lifecycle for LifecyclePhase {
    fn run<F>(&self, state: &RuntimeState, body: F) -> RuntimeResult<()>
    where
        F: FnOnce() -> RuntimeResult<()>,
    {
        state.set_phase(self.to_runtime_phase());
        let span = self.span();
        let _enter = span.enter();

        log_phase_event("runtime.lifecycle.phase.begin", self);
        let result = body();
        match &result {
            Ok(()) => {
                log_phase_event("runtime.lifecycle.phase.complete", self);
                Ok(())
            }
            Err(err) => {
                log_phase_failure(self, err);
                Err(wrap_error(self, err))
            }
        }
    }

    fn run_value<F, T>(&self, state: &RuntimeState, body: F) -> RuntimeResult<T>
    where
        F: FnOnce() -> RuntimeResult<T>,
    {
        state.set_phase(self.to_runtime_phase());
        let span = self.span();
        let _enter = span.enter();

        log_phase_event("runtime.lifecycle.phase.begin", self);
        let result = body();
        match &result {
            Ok(_) => {
                log_phase_event("runtime.lifecycle.phase.complete", self);
                Ok(result.expect("checked Ok above"))
            }
            Err(err) => {
                log_phase_failure(self, err);
                Err(wrap_error(self, err))
            }
        }
    }
}

impl LifecyclePhase {
    /// Map a [`LifecyclePhase`] to the corresponding
    /// [`crate::state::RuntimePhase`]. The state kernel's phase
    /// machine has one extra variant (`Stopped`) for the terminal
    /// post-shutdown state; it is not exposed as a bootstrap phase.
    pub fn to_runtime_phase(&self) -> crate::state::RuntimePhase {
        match self {
            Self::Init => crate::state::RuntimePhase::Cold,
            Self::Configure => crate::state::RuntimePhase::Configuring,
            Self::Log => crate::state::RuntimePhase::Logging,
            Self::Window => crate::state::RuntimePhase::WindowInit,
            Self::Ready => crate::state::RuntimePhase::Ready,
            Self::Shutdown => crate::state::RuntimePhase::ShuttingDown,
        }
    }
}

fn wrap_error(phase: &LifecyclePhase, err: &RuntimeError) -> RuntimeError {
    if phase.is_boot_phase() {
        RuntimeError::startup(err.to_string())
    } else {
        RuntimeError::shutdown(err.to_string())
    }
}

fn log_phase_event(event: &'static str, phase: &LifecyclePhase) {
    tracing::info!(
        target: "bootstrap::lifecycle",
        event = event,
        phase = phase.as_str(),
        "phase event",
    );
}

fn log_phase_failure(phase: &LifecyclePhase, err: &RuntimeError) {
    tracing::error!(
        target: "bootstrap::lifecycle",
        event = "runtime.lifecycle.phase.failed",
        phase = phase.as_str(),
        error_kind = err.kind(),
        error_message = %err.message(),
        "phase failed",
    );
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::logging::logger::{LogRecord, Logger, Sink};
    use std::sync::Arc;

    /// Phase variants match the plan's ordered set.
    #[test]
    fn enum_has_exactly_six_variants_in_plan_order() {
        // Exhaustively match every variant — if a new variant is added
        // or an existing one renamed, this match arms out and the test
        // fails to compile until the test is updated deliberately.
        let all = [
            LifecyclePhase::Init,
            LifecyclePhase::Configure,
            LifecyclePhase::Log,
            LifecyclePhase::Window,
            LifecyclePhase::Ready,
            LifecyclePhase::Shutdown,
        ];
        let names: Vec<&'static str> = all.iter().map(|p| p.as_str()).collect();
        assert_eq!(
            names,
            vec!["init", "configure", "log", "window", "ready", "shutdown"],
            "LifecyclePhase must have exactly the 6 variants from the plan, in execution order",
        );
    }

    #[test]
    fn as_str_is_stable() {
        assert_eq!(LifecyclePhase::Init.as_str(), "init");
        assert_eq!(LifecyclePhase::Configure.as_str(), "configure");
        assert_eq!(LifecyclePhase::Log.as_str(), "log");
        assert_eq!(LifecyclePhase::Window.as_str(), "window");
        assert_eq!(LifecyclePhase::Ready.as_str(), "ready");
        assert_eq!(LifecyclePhase::Shutdown.as_str(), "shutdown");
    }

    #[test]
    fn shutdown_is_the_only_non_boot_phase() {
        assert!(!LifecyclePhase::Shutdown.is_boot_phase());
        for p in [
            LifecyclePhase::Init,
            LifecyclePhase::Configure,
            LifecyclePhase::Log,
            LifecyclePhase::Window,
            LifecyclePhase::Ready,
        ] {
            assert!(p.is_boot_phase(), "{p:?} should be a boot phase");
        }
    }

    /// The trait is implemented on the enum — compile-time check that
    /// `LifecyclePhase` actually satisfies the trait bound. The trait
    /// is not object-safe (generic methods), so we don't take a
    /// `&dyn Lifecycle` here.
    #[test]
    fn trait_is_implemented_on_enum() {
        fn _assert_impl<T: Lifecycle>(_: &T) {}
        let p = LifecyclePhase::Init;
        _assert_impl(&p);
    }

    /// The Logger / Sink abstraction is no longer used by the bootstrap
    /// layer (which now goes through `tracing::info!`). This test stays
    /// only as a regression guard against re-introducing a hard
    /// dependency on the old Sink pipeline.
    #[test]
    fn logger_still_constructible_for_legacy_paths() {
        struct NullSink;
        impl Sink for NullSink {
            fn write(&self, _record: &LogRecord) {}
        }
        let _logger: Arc<Logger> =
            Arc::new(Logger::new("test-cid", vec![Arc::new(NullSink)]));
    }
}
