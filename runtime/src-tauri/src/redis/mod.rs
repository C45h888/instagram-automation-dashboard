//! Redis transport primitive.
//!
//! The runtime kernel owns the **only** Redis socket in the system.
//! The WebView FSM (governance layer) calls into Rust via Tauri IPC
//! commands to perform Redis ops; the renderer never opens a socket.
//!
//! This module is intentionally domain-free. The Redis client does not
//! know about auth, agents, queues, or workflows. It exposes a small
//! typed surface for the six FSM IPC commands:
//!
//! - [`publish_transition`] — append a Transition entry to
//!   `lineage:ledger:entries` (LIST) and `XADD` it to
//!   `lineage:webview:transitions` (STREAM).
//! - [`read_lineage`] — `LRANGE` the last N entries from the ledger.
//! - [`rehydrate_state`] — snapshot for a domain on boot.
//! - [`acquire_worker`] — bounded worker lease check.
//! - [`release_worker`] — bounded worker lease release.
//! - [`emit_heartbeat`] — record health status for the FSM.
//!
//! Connection model: [`redis::aio::ConnectionManager`] handles reconnect
//! automatically; we only surface fatal errors.

pub mod client;
pub mod commands;
pub mod config;
pub mod errors;

pub use client::RedisClient;
pub use commands::{
    acquire_worker, emit_heartbeat, publish_transition, read_lineage, rehydrate_state,
    release_worker, HeartbeatPayload, PublishReceipt, WorkerLease,
};
pub use config::RedisConfig;
pub use errors::RedisError;