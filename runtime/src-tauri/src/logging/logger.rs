//! Logging framework for the runtime kernel.
//!
//! All runtime logs are structured and carry the five required fields:
//!
//! - `timestamp`
//! - `component`
//! - `severity`
//! - `event`
//! - `correlation_id`
//!
//! The framework exposes a [`Logger::init`] entry point used by the
//! bootstrap layer, plus a [`Sink`] abstraction and a [`Formatter`] that
//! guarantees the field set.

use std::sync::Arc;

use crate::config::config::{LoggingConfig, LoggingFormat};
use crate::error::runtime_error::RuntimeResult;

/// Severity levels recognised by the runtime logger.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Severity {
    Trace,
    Debug,
    Info,
    Warn,
    Error,
}

impl Severity {
    pub const fn as_str(&self) -> &'static str {
        match self {
            Self::Trace => "TRACE",
            Self::Debug => "DEBUG",
            Self::Info => "INFO",
            Self::Warn => "WARN",
            Self::Error => "ERROR",
        }
    }
}

/// A single log record carrying the required structured fields.
#[derive(Debug, Clone)]
pub struct LogRecord {
    pub timestamp: String,
    pub component: String,
    pub severity: Severity,
    pub event: String,
    pub correlation_id: String,
    pub fields: Vec<(String, String)>,
}

/// A destination for log records. Implementations are responsible for
/// handling I/O failures internally — they MUST NOT panic.
pub trait Sink: Send + Sync {
    fn write(&self, record: &LogRecord);
}

/// The runtime logger. Holds a configured set of sinks and the active
/// correlation id.
pub struct Logger {
    correlation_id: String,
    sinks: Vec<Arc<dyn Sink>>,
}

impl std::fmt::Debug for Logger {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Logger")
            .field("correlation_id", &self.correlation_id)
            .field("sink_count", &self.sinks.len())
            .finish()
    }
}

impl Logger {
    /// Construct a new logger with the given correlation id and sinks.
    pub fn new(correlation_id: impl Into<String>, sinks: Vec<Arc<dyn Sink>>) -> Self {
        Self {
            correlation_id: correlation_id.into(),
            sinks,
        }
    }

    /// Initialise the global `tracing` subscriber using the runtime
    /// configuration. The Logger returned is the runtime-internal handle
    /// used by the bootstrap layer to emit domain-flavoured records.
    pub fn init(config: &LoggingConfig) -> RuntimeResult<Self> {
        let correlation_id = uuid::Uuid::new_v4().to_string();

        // Build the tracing subscriber first — it powers stderr / file
        // output for the wider crate ecosystem.
        let env_filter = tracing_subscriber::EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new(&config.level));
        let subscriber = tracing_subscriber::fmt()
            .with_env_filter(env_filter)
            .with_target(true);
        match config.format {
            LoggingFormat::Json => {
                subscriber
                    .json()
                    .try_init()
                    .map_err(|e| crate::error::runtime_error::RuntimeError::observability(e.to_string()))?;
            }
            LoggingFormat::Text => {
                subscriber
                    .try_init()
                    .map_err(|e| crate::error::runtime_error::RuntimeError::observability(e.to_string()))?;
            }
        }

        // Build the structured sink set from the config.
        let mut sinks: Vec<Arc<dyn Sink>> = Vec::new();
        if config.stdout {
            sinks.push(Arc::new(crate::logging::StdoutSink));
        }
        if let Some(path) = config.file_path.as_ref() {
            let sink = crate::logging::FileSink::new(path).map_err(|e| {
                crate::error::runtime_error::RuntimeError::filesystem(e.to_string())
            })?;
            sinks.push(Arc::new(sink));
        }
        if sinks.is_empty() {
            sinks.push(Arc::new(crate::logging::StdoutSink));
        }

        Ok(Self {
            correlation_id,
            sinks,
        })
    }

    pub fn correlation_id(&self) -> &str {
        &self.correlation_id
    }

    pub fn emit(&self, record: LogRecord) {
        for sink in &self.sinks {
            sink.write(&record);
        }
    }
}
