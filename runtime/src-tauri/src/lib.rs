//! Automation Kernel — runtime substrate for the systemic refactor program.
//!
//! This crate is the Infrastructure Runtime. It owns:
//! - Window Management
//! - Lifecycle Management
//! - IPC Infrastructure
//! - Configuration
//! - Logging
//! - Filesystem Access
//! - Desktop Services
//!
//! It does NOT own domain logic. The preserved TypeScript platform (in
//! `../../src/` at the repo root) holds all business concerns.

#![deny(unsafe_code)]
#![warn(missing_debug_implementations)]

pub mod bootstrap;
pub mod config;
pub mod error;
pub mod ipc;
pub mod logging;
pub mod state;

pub use error::runtime_error::{RuntimeError, RuntimeResult};
