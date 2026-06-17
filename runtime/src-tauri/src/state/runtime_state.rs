//! Runtime-level state owned by the kernel.
//!
//! This type holds metadata about the *runtime process itself*: when it
//! started, what phase it is in, the active correlation id. It is not an
//! authenticated user session, not a tenant context, not a business
//! record.

use std::sync::Arc;
use std::sync::atomic::{AtomicU8, Ordering};

use serde::{Deserialize, Serialize};

use crate::logging::Logger;

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

/// Runtime state, owned by the kernel. Thread-safe.
#[derive(Debug)]
pub struct RuntimeState {
    booted_at: chrono_like::Instant,
    correlation_id: String,
    phase: AtomicU8,
    logger: Arc<Logger>,
}

impl RuntimeState {
    pub fn new(logger: Arc<Logger>) -> Self {
        Self {
            booted_at: chrono_like::Instant::now(),
            correlation_id: logger.correlation_id().to_string(),
            phase: AtomicU8::new(RuntimePhase::Cold as u8),
            logger,
        }
    }

    /// Re-construct a [`RuntimeState`] preserving the boot timestamp and
    /// correlation id from `existing`, but using a different logger. Used
    /// by the bootstrap layer to swap the cold-start logger for the
    /// configured one.
    pub fn with_logger(existing: &Self, logger: Arc<Logger>) -> Self {
        Self {
            booted_at: existing.booted_at,
            correlation_id: existing.correlation_id.clone(),
            phase: AtomicU8::new(existing.phase.load(Ordering::SeqCst)),
            logger,
        }
    }

    pub fn correlation_id(&self) -> &str {
        &self.correlation_id
    }

    pub fn booted_at(&self) -> chrono_like::Instant {
        self.booted_at
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

    pub fn logger(&self) -> &Arc<Logger> {
        &self.logger
    }
}

mod chrono_like {
    use serde::{Deserialize, Serialize};
    use std::time::{SystemTime, UNIX_EPOCH};

    #[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
    pub struct Instant {
        epoch_secs: u64,
    }

    impl Instant {
        pub fn now() -> Self {
            Self {
                epoch_secs: SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .map(|d| d.as_secs())
                    .unwrap_or(0),
            }
        }

        pub fn epoch_secs(&self) -> u64 {
            self.epoch_secs
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::logging::logger::{LogRecord, Severity, Sink};
    use crate::logging::formatter::Formatter;

    struct CaptureSink(std::sync::Mutex<Vec<String>>);
    impl Sink for CaptureSink {
        fn write(&self, record: &LogRecord) {
            self.0.lock().unwrap().push(Formatter::format(record));
        }
    }

    fn logger() -> Arc<Logger> {
        let sink: Arc<dyn Sink> = Arc::new(CaptureSink(std::sync::Mutex::new(Vec::new())));
        Arc::new(Logger::new("test-correlation", vec![sink]))
    }

    #[test]
    fn runtime_state_initial_phase_is_cold() {
        let state = RuntimeState::new(logger());
        assert_eq!(state.phase(), RuntimePhase::Cold);
    }

    #[test]
    fn runtime_state_phase_transitions() {
        let state = RuntimeState::new(logger());
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
        let log = logger();
        let cid = log.correlation_id().to_string();
        let state = RuntimeState::new(log);
        assert_eq!(state.correlation_id(), cid);
    }

    #[test]
    fn severity_strings_are_stable() {
        assert_eq!(Severity::Info.as_str(), "INFO");
        assert_eq!(Severity::Error.as_str(), "ERROR");
    }
}
