//! IPC (Inter-Process Communication) layer for the runtime kernel.
//!
//! This module is the **constitutional seam** between the Rust runtime
//! and the Svelte WebView. Every Tauri command the WebView can invoke
//! is defined here. The contract is:
//!
//! - All commands are pure reads or writes on state the Rust kernel
//!   already owns (Phase 1).
//! - All request and response types are DTOs from [`types`].
//! - **No command touches domain concerns.** The kernel does not know
//!   about auth, Instagram, agents, queues, or workflows. Those live
//!   in the preserved TypeScript layer.
//!
//! See `runtime/contracts/PHASE2_development-contract.md` for the full
//! authoritative contract.

pub mod commands;
pub mod fsm_commands;
pub mod types;

pub use commands::*;
pub use commands::kernel;
pub use fsm_commands::*;
pub use types::*;
