//! FSM IPC commands — six typed boundaries between the WebView FSM and
//! the kernel's Redis transport primitive.
//!
//! These commands are the **only** path the FSM has to Redis. The
//! renderer never opens a socket. Each command:
//!
//! 1. Takes a typed DTO from [`crate::redis::commands`]
//! 2. Fetches the [`RedisClient`] from Tauri-managed state
//! 3. Dispatches to the appropriate Redis op
//! 4. Returns `Result<DTO, IpcErrorDTO>` — the same `IpcResult<DTO>`
//!    seam every other command uses
//!
//! No command contains FSM logic. No command knows about domain
//! semantics. They are transport primitives.
//!
//! The six commands:
//!
//! - `fsm_publish_transition` — RPUSH + XADD a transition.
//! - `fsm_read_lineage` — LRANGE the most recent N transitions for a domain.
//! - `fsm_rehydrate_state` — DomainSnapshot for boot-time state recovery.
//! - `fsm_acquire_worker` — bounded worker lease (returns None when exhausted).
//! - `fsm_release_worker` — release a previously held lease.
//! - `fsm_emit_heartbeat` — XADD a liveness observation.

use tauri::State;

use crate::error::runtime_error::{RuntimeError, RuntimeResult};
use crate::ipc::commands::IpcResult;
use crate::ipc::types::IpcErrorDTO;
use crate::redis::client::RedisClient;
use crate::redis::commands::{
    self, DomainSnapshot, HeartbeatPayload, PublishReceipt, Transition, WorkerLease,
};

/// Helper: convert a `RedisClient` "not available" state (kernel booted
/// without a working Redis) into a typed IPC error so the FSM can
/// surface DEGRADED without crashing.
fn map_runtime(err: RuntimeError) -> IpcErrorDTO {
    IpcErrorDTO::from_runtime(&err)
}

fn map_runtime_opt<T>(res: RuntimeResult<T>) -> IpcResult<T> {
    res.map_err(map_runtime)
}

/// `fsm_publish_transition` — append a transition to the lineage
/// ledger and emit it on the WebView stream. Both ops are issued
/// against the same connection.
#[tauri::command]
pub async fn fsm_publish_transition(
    client: State<'_, RedisClient>,
    transition: Transition,
) -> IpcResult<PublishReceipt> {
    map_runtime_opt(commands::publish_transition(&client, &transition).await)
}

/// `fsm_read_lineage` — return up to `count` most-recent transitions
/// for the given domain. Reads the canonical ledger LIST.
#[tauri::command]
pub async fn fsm_read_lineage(
    client: State<'_, RedisClient>,
    domain: String,
    count: usize,
) -> IpcResult<Vec<Transition>> {
    map_runtime_opt(commands::read_lineage(&client, &domain, count).await)
}

/// `fsm_rehydrate_state` — return a DomainSnapshot suitable for
/// boot-time FSM state reconstruction.
#[tauri::command]
pub async fn fsm_rehydrate_state(
    client: State<'_, RedisClient>,
    domain: String,
) -> IpcResult<DomainSnapshot> {
    map_runtime_opt(commands::rehydrate_state(&client, &domain).await)
}

/// `fsm_acquire_worker` — try to acquire a bounded worker lease.
/// Returns `None` when the pool is exhausted (FSM emits DEGRADED).
#[tauri::command]
pub async fn fsm_acquire_worker(client: State<'_, RedisClient>) -> IpcResult<Option<WorkerLease>> {
    map_runtime_opt(commands::acquire_worker(&client).await)
}

/// `fsm_release_worker` — return a previously acquired lease.
#[tauri::command]
pub async fn fsm_release_worker(
    client: State<'_, RedisClient>,
    lease: WorkerLease,
) -> IpcResult<()> {
    map_runtime_opt(commands::release_worker(&client, &lease).await)
}

/// `fsm_emit_heartbeat` — emit a liveness observation for a domain.
#[tauri::command]
pub async fn fsm_emit_heartbeat(
    client: State<'_, RedisClient>,
    payload: HeartbeatPayload,
) -> IpcResult<()> {
    map_runtime_opt(commands::emit_heartbeat(&client, &payload).await)
}

/// Internal helper: ensure the worker-availability counter exists.
/// Called once during startup; not exposed as an IPC command.
pub async fn ensure_worker_counter(client: &RedisClient) -> RuntimeResult<i64> {
    commands::ensure_worker_counter(client).await
}

// =============================================================================
// Tests — IPC layer is thin; behaviour covered by `redis::commands` tests.
// Here we verify the signature shape and the From-conversion path.
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::runtime_error::RuntimeError;
    use crate::RuntimeResult;

    /// The kernel error envelope must preserve kind + message when
    /// crossing the IPC seam. This is the same invariant the existing
    /// 21 commands rely on.
    #[test]
    fn map_runtime_preserves_kind_and_message() {
        let rt = RuntimeError::redis("connection refused");
        let dto = map_runtime(rt);
        assert_eq!(dto.kind, "RUNTIME_REDIS_ERROR");
        assert!(dto.message.contains("connection refused"));
    }

    #[test]
    fn map_runtime_opt_unwraps_ok() {
        let ok: RuntimeResult<i64> = Ok(7);
        let res = map_runtime_opt(ok);
        assert!(matches!(res, Ok(7)));
    }

    #[test]
    fn map_runtime_opt_wraps_err() {
        let err: RuntimeResult<i64> = Err(RuntimeError::redis("nope"));
        let res = map_runtime_opt(err);
        assert!(res.is_err());
        assert_eq!(res.unwrap_err().kind, "RUNTIME_REDIS_ERROR");
    }
}