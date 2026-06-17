//! Bootstrap layer for the runtime kernel.
//!
//! - [`runtime::Runtime`] is the entry point, called from `main.rs`.
//! - [`startup::Startup`] runs the boot phases.
//! - [`shutdown::Shutdown`] runs the teardown phases.
//! - [`lifecycle::LifecyclePhase`] enumerates the phase names.

pub mod lifecycle;
pub mod runtime;
pub mod shutdown;
pub mod startup;
