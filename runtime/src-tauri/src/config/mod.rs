//! Configuration framework for the runtime kernel.
//!
//! The runtime reads its bootstrap configuration from
//! `runtime/config/{env}.toml` and from environment variables.
//! See [`loader::Loader`] for the entry point and
//! [`validation`] for the invariant checks.

// `config::config` is the plan-specified module name (matches the
// Phase 1 deliverable contract). The naming is intentional — it keeps
// every deliverable's directory layout exactly as the plan author
// wrote it. The lint would force a rename we don't want.
#[allow(clippy::module_inception)]
pub mod config;
pub mod environment;
pub mod loader;
pub mod validation;

pub use config::{Config, Environment, LoggingConfig, LoggingFormat, RuntimeConfig, WindowConfig};
