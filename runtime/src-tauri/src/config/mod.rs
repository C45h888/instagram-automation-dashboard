//! Configuration framework for the runtime kernel.
//!
//! See [`config::Config`] for the top-level type and [`loader::Loader`]
//! for the resolution rules.

pub mod config;
pub mod environment;
pub mod loader;
pub mod validation;

pub use config::{Config, Environment, LoggingConfig, LoggingFormat, RuntimeConfig, WindowConfig};
