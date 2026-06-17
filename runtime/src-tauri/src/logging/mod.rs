//! Logging framework for the runtime kernel.
//!
//! The runtime emits structured logs only. The five required fields
//! (`timestamp`, `component`, `severity`, `event`, `correlation_id`) are
//! populated by every record. See [`formatter`] for the canonical line
//! layout and [`logger`] for the [`Logger`] entry point.

pub mod formatter;
pub mod logger;
pub mod sinks;

pub use formatter::{now_record, now_rfc3339, Formatter};
pub use logger::{LogRecord, Logger, Severity, Sink};
pub use sinks::{FileSink, StdoutSink};
