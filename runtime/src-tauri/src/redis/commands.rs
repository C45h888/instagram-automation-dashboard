//! FSM Redis commands — six primitives the WebView FSM calls via Tauri IPC.
//!
//! These are pure transport functions. They take a JSON-serialisable
//! [`Transition`] / [`HeartbeatPayload`] / [`WorkerLease`], hit Redis
//! with the appropriate command, and return a typed receipt or error.
//! No domain logic, no FSM state — the FSM (TS layer) owns state.
//!
//! Layout in Redis:
//!
//! - `lineage:ledger:entries` — LIST. Each transition is `RPUSH`ed as a
//!   JSON string. Backwards-compatible with the backend's
//!   lineage-ledger.js (which writes/reads the same key).
//! - `lineage:webview:transitions` — STREAM. `XADD` with fields
//!   `domain`, `from_state`, `to_state`, `correlation_id`,
//!   `transition_id`, `payload`. The backend's Constitutional Kernel
//!   consumes this stream for validation; it does not write back to
//!   the ledger.
//! - `lineage:webview:heartbeats` — STREAM. Health observations from
//!   the FSM. Backend can correlate with the transition stream.
//! - `lineage:webview:workers:available` — INTEGER counter.
//!   Decremented on `acquire_worker`, incremented on `release_worker`.
//!   Bounded by `WORKER_POOL_SIZE` (4).

use serde::{Deserialize, Serialize};

use crate::error::runtime_error::RuntimeResult;
use crate::redis::client::RedisClient;
use crate::redis::errors::RedisError;

// =============================================================================
// Constants — Redis key layout (canonical names; do not rename)
// =============================================================================

/// Canonical lineage ledger. Shared with backend lineage-ledger.js.
pub const LINEAGE_LEDGER_KEY: &str = "lineage:ledger:entries";

/// Stream backend consumes for WebView-originated transitions.
pub const WEBVIEW_TRANSITIONS_STREAM: &str = "lineage:webview:transitions";

/// Heartbeat stream.
pub const WEBVIEW_HEARTBEATS_STREAM: &str = "lineage:webview:heartbeats";

/// Worker-availability counter key.
pub const WORKER_AVAILABILITY_KEY: &str = "lineage:webview:workers:available";

/// Maximum worker leases — bounded per FSM spec.
pub const WORKER_POOL_SIZE: i64 = 4;

// =============================================================================
// DTOs at the IPC boundary (kept in this module for locality)
// =============================================================================

/// Transition shape passed across IPC. Mirrors the TS
/// `fsm/contracts/transition.ts` definition. Field naming is
/// snake_case to match the rest of the runtime kernel.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Transition {
    pub transition_id: String,
    pub correlation_id: String,
    pub domain: String,
    pub from_state: String,
    pub to_state: String,
    pub event: String,
    /// Free-form payload (JSON object). Serialised as a string for
    /// Redis storage; deserialised on read.
    pub payload: Option<serde_json::Value>,
    pub occurred_at_epoch_ms: u64,
}

impl Transition {
    /// Serialise to a stable JSON string for Redis LIST / STORAGE.
    pub fn to_redis_string(&self) -> Result<String, RedisError> {
        serde_json::to_string(self).map_err(RedisError::from)
    }

    /// Parse from a Redis LIST entry.
    pub fn from_redis_string(s: &str) -> Result<Self, RedisError> {
        serde_json::from_str(s).map_err(RedisError::from)
    }
}

/// Receipt returned by [`publish_transition`].
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PublishReceipt {
    pub transition_id: String,
    /// Position in the lineage ledger LIST (1-indexed, per Redis RPUSH).
    pub ledger_index: i64,
    /// Stream entry ID assigned by Redis XADD.
    pub stream_id: String,
}

/// Heartbeat payload — periodic liveness signal from the FSM.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct HeartbeatPayload {
    pub correlation_id: String,
    pub domain: String,
    pub state: String,
    pub observed_at_epoch_ms: u64,
}

/// Worker lease returned by [`acquire_worker`].
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct WorkerLease {
    pub lease_id: String,
    pub acquired_at_epoch_ms: u64,
    pub remaining: i64,
}

// =============================================================================
// Domain snapshot for rehydrate
// =============================================================================

/// Snapshot of the FSM's view of a domain — last N transitions from the
/// ledger plus the most recent state.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DomainSnapshot {
    pub domain: String,
    pub current_state: String,
    pub last_transitions: Vec<Transition>,
}

// =============================================================================
// Commands
// =============================================================================

/// Append a transition to the lineage ledger and XADD it to the
/// WebView stream. Both ops happen in one logical publish; the FSM
/// considers the transition "accepted" only when both succeed.
pub async fn publish_transition(
    client: &RedisClient,
    transition: &Transition,
) -> RuntimeResult<PublishReceipt> {
    let payload = transition.to_redis_string()?;
    let mut conn = client.conn().await;

    // RPUSH to the canonical ledger. Returns the new length; the
    // index of this entry is that length.
    let ledger_index: i64 = redis::cmd("RPUSH")
        .arg(LINEAGE_LEDGER_KEY)
        .arg(&payload)
        .query_async(&mut *conn)
        .await
        .map_err(RedisError::from)?;

    // XADD to the WebView stream. Stream entry ID is returned by Redis
    // (e.g. "1700000000000-0"). Auto-generate via "*".
    let stream_id: String = redis::cmd("XADD")
        .arg(WEBVIEW_TRANSITIONS_STREAM)
        .arg("*")
        .arg("transition_id")
        .arg(&transition.transition_id)
        .arg("correlation_id")
        .arg(&transition.correlation_id)
        .arg("domain")
        .arg(&transition.domain)
        .arg("from_state")
        .arg(&transition.from_state)
        .arg("to_state")
        .arg(&transition.to_state)
        .arg("event")
        .arg(&transition.event)
        .arg("occurred_at_epoch_ms")
        .arg(transition.occurred_at_epoch_ms.to_string())
        .query_async(&mut *conn)
        .await
        .map_err(RedisError::from)?;

    Ok(PublishReceipt {
        transition_id: transition.transition_id.clone(),
        ledger_index,
        stream_id,
    })
}

/// Read the most recent N transitions for a domain from the lineage
/// ledger. The ledger is shared across domains, so we filter by
/// deserialised `domain` field after `LRANGE`.
pub async fn read_lineage(
    client: &RedisClient,
    domain: &str,
    count: usize,
) -> RuntimeResult<Vec<Transition>> {
    if count == 0 {
        return Ok(Vec::new());
    }
    let mut conn = client.conn().await;

    // LRANGE takes inclusive start/end indices. -count means "the last
    // `count` entries". -1 is the most recent.
    let start = -(count as i64);
    let end = -1;
    let raw_entries: Vec<String> = redis::cmd("LRANGE")
        .arg(LINEAGE_LEDGER_KEY)
        .arg(start)
        .arg(end)
        .query_async(&mut *conn)
        .await
        .map_err(RedisError::from)?;

    let mut transitions = Vec::with_capacity(raw_entries.len());
    for entry in raw_entries {
        match Transition::from_redis_string(&entry) {
            Ok(t) if t.domain == domain => transitions.push(t),
            // Skip entries for other domains — single LIST holds all
            // domains in interleaved order. Skip also on parse failure
            // rather than fail the whole read; corrupt entries shouldn't
            // blind the FSM.
            Ok(_) => {}
            Err(_) => {}
        }
    }
    Ok(transitions)
}

/// Snapshot for rehydrate on boot.
pub async fn rehydrate_state(
    client: &RedisClient,
    domain: &str,
) -> RuntimeResult<DomainSnapshot> {
    let transitions = read_lineage(client, domain, 1024).await?;
    let current_state = transitions
        .last()
        .map(|t| t.to_state.clone())
        .unwrap_or_else(|| "IDLE".to_string());
    Ok(DomainSnapshot {
        domain: domain.to_string(),
        current_state,
        last_transitions: transitions,
    })
}

/// Try to acquire a worker lease. Returns Ok(None) when the pool is
/// exhausted (FSM observes this and emits DEGRADED). Returns Ok(Some)
/// with the lease details when acquired.
pub async fn acquire_worker(client: &RedisClient) -> RuntimeResult<Option<WorkerLease>> {
    let mut conn = client.conn().await;

    // DECR returns the new value. If we go below 0, immediately
    // re-INCR to restore the invariant and signal "no lease available".
    let new_value: i64 = redis::cmd("DECR")
        .arg(WORKER_AVAILABILITY_KEY)
        .query_async(&mut *conn)
        .await
        .map_err(RedisError::from)?;

    if new_value < 0 {
        // Roll back.
        let _: i64 = redis::cmd("INCR")
            .arg(WORKER_AVAILABILITY_KEY)
            .query_async(&mut *conn)
            .await
            .map_err(RedisError::from)?;
        return Ok(None);
    }

    let lease_id = uuid::Uuid::new_v4().to_string();
    let acquired_at_epoch_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    Ok(Some(WorkerLease {
        lease_id,
        acquired_at_epoch_ms,
        remaining: new_value,
    }))
}

/// Release a previously acquired lease. Caps the counter at
/// WORKER_POOL_SIZE so a buggy client cannot inflate availability.
pub async fn release_worker(
    client: &RedisClient,
    _lease: &WorkerLease,
) -> RuntimeResult<()> {
    let mut conn = client.conn().await;
    let new_value: i64 = redis::cmd("INCR")
        .arg(WORKER_AVAILABILITY_KEY)
        .query_async(&mut *conn)
        .await
        .map_err(RedisError::from)?;

    if new_value > WORKER_POOL_SIZE {
        // Restore the cap.
        let _: () = redis::cmd("SET")
            .arg(WORKER_AVAILABILITY_KEY)
            .arg(WORKER_POOL_SIZE.to_string())
            .query_async(&mut *conn)
            .await
            .map_err(RedisError::from)?;
    }
    Ok(())
}

/// Emit a heartbeat to the heartbeats stream.
pub async fn emit_heartbeat(
    client: &RedisClient,
    payload: &HeartbeatPayload,
) -> RuntimeResult<()> {
    let mut conn = client.conn().await;
    let _id: String = redis::cmd("XADD")
        .arg(WEBVIEW_HEARTBEATS_STREAM)
        .arg("*")
        .arg("correlation_id")
        .arg(&payload.correlation_id)
        .arg("domain")
        .arg(&payload.domain)
        .arg("state")
        .arg(&payload.state)
        .arg("observed_at_epoch_ms")
        .arg(payload.observed_at_epoch_ms.to_string())
        .query_async(&mut *conn)
        .await
        .map_err(RedisError::from)?;
    Ok(())
}

/// Initialise the worker-availability counter on first boot. Idempotent:
/// only sets the value if the key doesn't exist. Returns the value
/// after the operation.
pub async fn ensure_worker_counter(client: &RedisClient) -> RuntimeResult<i64> {
    let mut conn = client.conn().await;
    let _: () = redis::cmd("SET")
        .arg(WORKER_AVAILABILITY_KEY)
        .arg(WORKER_POOL_SIZE.to_string())
        .arg("NX")
        .query_async(&mut *conn)
        .await
        .map_err(RedisError::from)?;

    let value: i64 = redis::cmd("GET")
        .arg(WORKER_AVAILABILITY_KEY)
        .query_async(&mut *conn)
        .await
        .map_err(RedisError::from)?;
    Ok(value)
}

// =============================================================================
// Tests — type shape and serialisation round-trip; Redis ops themselves
// are exercised via integration tests against a live Redis.
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn transition_serialises_to_snake_case_json() {
        let t = Transition {
            transition_id: "tx-1".into(),
            correlation_id: "cid-1".into(),
            domain: "analytics-reports".into(),
            from_state: "IDLE".into(),
            to_state: "POLLING".into(),
            event: "mount".into(),
            payload: Some(serde_json::json!({"key": "value"})),
            occurred_at_epoch_ms: 1_700_000_000_000,
        };
        let json = serde_json::to_string(&t).unwrap();
        assert!(json.contains("\"transition_id\":\"tx-1\""));
        assert!(json.contains("\"to_state\":\"POLLING\""));
        assert!(json.contains("\"occurred_at_epoch_ms\":1700000000000"));
    }

    #[test]
    fn transition_round_trips_via_redis_string() {
        let t = Transition {
            transition_id: "tx-2".into(),
            correlation_id: "cid-2".into(),
            domain: "scheduled-posts".into(),
            from_state: "IDLE".into(),
            to_state: "FETCHING".into(),
            event: "fetch".into(),
            payload: None,
            occurred_at_epoch_ms: 1_700_000_000_001,
        };
        let s = t.to_redis_string().unwrap();
        let back = Transition::from_redis_string(&s).unwrap();
        assert_eq!(back, t);
    }

    #[test]
    fn invalid_json_fails_serde_cleanly() {
        let err = Transition::from_redis_string("not-json").unwrap_err();
        assert!(matches!(err, RedisError::Serialization(_)));
    }

    #[test]
    fn publish_receipt_serialises_with_expected_keys() {
        let r = PublishReceipt {
            transition_id: "tx-x".into(),
            ledger_index: 42,
            stream_id: "1700000000000-0".into(),
        };
        let v = serde_json::to_value(&r).unwrap();
        assert_eq!(v["transition_id"], "tx-x");
        assert_eq!(v["ledger_index"], 42);
        assert_eq!(v["stream_id"], "1700000000000-0");
    }

    #[test]
    fn worker_lease_carries_lease_id_and_remaining() {
        let l = WorkerLease {
            lease_id: "lease-1".into(),
            acquired_at_epoch_ms: 1_700_000_000_002,
            remaining: 3,
        };
        let v = serde_json::to_value(&l).unwrap();
        assert_eq!(v["lease_id"], "lease-1");
        assert_eq!(v["remaining"], 3);
    }

    #[test]
    fn worker_pool_size_constant_is_four() {
        assert_eq!(WORKER_POOL_SIZE, 4);
    }

    #[test]
    fn canonical_keys_are_stable() {
        // The backend's lineage-ledger.js depends on these exact names.
        // Drift here is a contract break.
        assert_eq!(LINEAGE_LEDGER_KEY, "lineage:ledger:entries");
        assert_eq!(WEBVIEW_TRANSITIONS_STREAM, "lineage:webview:transitions");
        assert_eq!(WEBVIEW_HEARTBEATS_STREAM, "lineage:webview:heartbeats");
        assert_eq!(WORKER_AVAILABILITY_KEY, "lineage:webview:workers:available");
    }
}