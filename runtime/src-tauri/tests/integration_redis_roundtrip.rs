//! integration_redis_roundtrip — end-to-end FSM-GSC-2 G10 verification.
//!
//! Spins up the Redis primitive against a live Redis 7.x server
//! (REDIS_URL=redis://127.0.0.1:6379 by default), exercises every
//! published command path, and asserts the on-disk shape matches the
//! DTOs the FSM expects.
//!
//! Skipped (logged and returned) if REDIS_URL is unset OR the server
//! is unreachable, so cargo test --lib still passes in environments
//! without Redis. Run explicitly with:
//!   REDIS_URL=redis://127.0.0.1:6379 cargo test --test
//!     integration_redis_roundtrip -- --nocapture
//!
//! Each test is `fn`-shaped (not `async fn`) and uses
//! `tokio::runtime::Runtime::block_on` because the test target is
//! compiled at edition 2015 (the lib uses 2021; the test target
//! does not inherit it under the deprecated `edition` field).

use std::env;
use std::sync::Mutex;

use automation_kernel::redis::client::RedisClient;
use automation_kernel::redis::commands::{
    self, HeartbeatPayload, Transition, WorkerLease,
};
use automation_kernel::redis::config::RedisConfig;
use redis::AsyncCommands;

/// All integration tests share one runtime + one connection
/// acquisition step. A static Mutex serialises test execution so
/// the wipe/publish/read sequence in each test is not stomped on
/// by a parallel test's wipe-on-exit.
static TEST_LOCK: Mutex<()> = Mutex::new(());

fn make_transition(correlation_id: &str, domain: &str, from: &str, to: &str) -> Transition {
    Transition {
        transition_id: uuid::Uuid::new_v4().to_string(),
        correlation_id: correlation_id.to_string(),
        domain: domain.to_string(),
        from_state: from.to_string(),
        to_state: to.to_string(),
        event: format!("{from}_to_{to}"),
        payload: Some(serde_json::json!({"test": true})),
        occurred_at_epoch_ms: 1_700_000_000_000,
    }
}

/// Try to connect to a live Redis. Returns None if REDIS_URL unset or
/// Redis unreachable; test then logs and returns silently. Caller
/// MUST hold TEST_LOCK for the duration of the test to avoid stomping
/// on a parallel test's wipe.
fn try_connect_with_lock() -> Option<(tokio::runtime::Runtime, RedisClient)> {
    let url = match env::var("REDIS_URL") {
        Ok(s) if !s.is_empty() => s,
        _ => {
            eprintln!("REDIS_URL not set; skipping integration test");
            return None;
        }
    };
    let cfg = RedisConfig { url, password: None, db: 0 };
    let rt = match tokio::runtime::Builder::new_multi_thread().enable_all().build() {
        Ok(rt) => rt,
        Err(e) => {
            eprintln!("tokio runtime build failed: {e}; skipping");
            return None;
        }
    };
    let client = match rt.block_on(RedisClient::connect(cfg)) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("Redis unreachable: {e}; skipping integration test");
            return None;
        }
    };
    Some((rt, client))
}

fn wipe_canonical_keys_blocking(
    rt: &tokio::runtime::Runtime,
    client: &RedisClient,
) -> redis::RedisResult<()> {
    rt.block_on(async {
        let mut conn = client.conn().await;
        let _: i64 = conn
            .del(&[
                commands::LINEAGE_LEDGER_KEY,
                commands::WEBVIEW_TRANSITIONS_STREAM,
                commands::WEBVIEW_HEARTBEATS_STREAM,
                commands::WORKER_AVAILABILITY_KEY,
            ])
            .await?;
        Ok(())
    })
}

#[test]
fn publish_then_read_roundtrip_preserves_correlation_id() {
    let _guard = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let Some((rt, client)) = try_connect_with_lock() else {
        return;
    };
    wipe_canonical_keys_blocking(&rt, &client).expect("wipe");

    let correlation_id = format!("test-cid-{}", uuid::Uuid::new_v4());
    let t1 = make_transition(&correlation_id, "analytics-reports", "IDLE", "POLLING");
    let t2 = make_transition(&correlation_id, "analytics-reports", "POLLING", "STALE");
    let t3 = make_transition(&correlation_id, "analytics-reports", "STALE", "POLLING");

    let r1 = rt.block_on(commands::publish_transition(&client, &t1)).expect("pub 1");
    let r2 = rt.block_on(commands::publish_transition(&client, &t2)).expect("pub 2");
    let r3 = rt.block_on(commands::publish_transition(&client, &t3)).expect("pub 3");

    assert_ne!(r1.ledger_index, r2.ledger_index, "ledger indices monotonic");
    assert_ne!(r2.ledger_index, r3.ledger_index, "ledger indices monotonic");
    assert!(
        !r1.stream_id.is_empty() && !r2.stream_id.is_empty() && !r3.stream_id.is_empty(),
        "stream ids present"
    );

    let entries: Vec<String> = rt.block_on(async {
        let mut conn = client.conn().await;
        conn.lrange(commands::LINEAGE_LEDGER_KEY, -3, -1).await
    }).expect("lrange last 3");
    assert_eq!(entries.len(), 3, "exactly 3 latest entries");

    let parsed: Vec<Transition> = entries
        .iter()
        .map(|s| Transition::from_redis_string(s).expect("parse entry"))
        .collect();
    for t in &parsed {
        assert_eq!(
            t.correlation_id, correlation_id,
            "correlation_id preserved through publish→list"
        );
    }
    assert_eq!(
        parsed[2].to_state, "POLLING",
        "last entry's to_state is POLLING"
    );

    wipe_canonical_keys_blocking(&rt, &client).expect("cleanup");
}

#[test]
fn rehydrate_state_returns_last_to_state() {
    let _guard = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let Some((rt, client)) = try_connect_with_lock() else {
        return;
    };
    wipe_canonical_keys_blocking(&rt, &client).expect("wipe");

    let cid = format!("rehydrate-cid-{}", uuid::Uuid::new_v4());
    rt.block_on(commands::publish_transition(
        &client,
        &make_transition(&cid, "scheduled-posts", "IDLE", "FETCHING"),
    ))
    .expect("pub 1");
    rt.block_on(commands::publish_transition(
        &client,
        &make_transition(&cid, "scheduled-posts", "FETCHING", "READY"),
    ))
    .expect("pub 2");

    let snap = rt
        .block_on(commands::rehydrate_state(&client, "scheduled-posts"))
        .expect("rehydrate");
    assert_eq!(snap.domain, "scheduled-posts");
    assert_eq!(snap.current_state, "READY", "current_state is last to_state");
    assert!(
        snap.last_transitions.len() >= 2,
        "snapshot carries recent transitions"
    );

    wipe_canonical_keys_blocking(&rt, &client).expect("cleanup");
}

#[test]
fn acquire_release_worker_balances_counter() {
    let _guard = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let Some((rt, client)) = try_connect_with_lock() else {
        return;
    };
    wipe_canonical_keys_blocking(&rt, &client).expect("wipe");

    let initial = rt.block_on(commands::ensure_worker_counter(&client)).expect("ensure");
    assert_eq!(initial, commands::WORKER_POOL_SIZE);

    let lease = rt
        .block_on(commands::acquire_worker(&client))
        .expect("acquire")
        .expect("lease returned");
    let after_acquire = rt.block_on(commands::ensure_worker_counter(&client)).expect("re-read");
    assert_eq!(after_acquire, commands::WORKER_POOL_SIZE - 1);

    rt.block_on(commands::release_worker(&client, &lease)).expect("release");
    let after_release = rt.block_on(commands::ensure_worker_counter(&client)).expect("re-read");
    assert_eq!(after_release, commands::WORKER_POOL_SIZE);

    wipe_canonical_keys_blocking(&rt, &client).expect("cleanup");
}

#[test]
fn acquire_worker_exhausts_pool_then_returns_none() {
    let _guard = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let Some((rt, client)) = try_connect_with_lock() else {
        return;
    };
    wipe_canonical_keys_blocking(&rt, &client).expect("wipe");
    rt.block_on(commands::ensure_worker_counter(&client)).expect("ensure");

    let mut leases: Vec<WorkerLease> = Vec::new();
    for _ in 0..commands::WORKER_POOL_SIZE {
        let l = rt
            .block_on(commands::acquire_worker(&client))
            .expect("acquire")
            .expect("lease");
        leases.push(l);
    }
    let exhausted = rt.block_on(commands::acquire_worker(&client)).expect("acquire");
    assert!(exhausted.is_none(), "pool exhausted → None");

    rt.block_on(commands::release_worker(&client, &leases.remove(0))).expect("release");
    let recovered = rt.block_on(commands::acquire_worker(&client)).expect("acquire");
    assert!(recovered.is_some(), "after release, acquire succeeds");

    while let Some(l) = leases.pop() {
        rt.block_on(commands::release_worker(&client, &l)).expect("release");
    }

    wipe_canonical_keys_blocking(&rt, &client).expect("cleanup");
}

#[test]
fn emit_heartbeat_xadds_to_stream() {
    let _guard = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let Some((rt, client)) = try_connect_with_lock() else {
        return;
    };

    let before: i64 = rt
        .block_on(async {
            let mut conn = client.conn().await;
            conn.xlen(commands::WEBVIEW_HEARTBEATS_STREAM).await
        })
        .unwrap_or(0);

    let payload = HeartbeatPayload {
        correlation_id: format!("hb-cid-{}", uuid::Uuid::new_v4()),
        domain: "analytics-reports".to_string(),
        state: "HEARTBEAT".to_string(),
        observed_at_epoch_ms: 1_700_000_000_000,
    };
    rt.block_on(commands::emit_heartbeat(&client, &payload)).expect("emit");

    let after: i64 = rt
        .block_on(async {
            let mut conn = client.conn().await;
            conn.xlen(commands::WEBVIEW_HEARTBEATS_STREAM).await
        })
        .expect("xlen after");
    assert!(
        after > before,
        "heartbeats stream grew (was {before}, now {after})"
    );
}

#[test]
fn read_lineage_filters_by_domain() {
    let _guard = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let Some((rt, client)) = try_connect_with_lock() else {
        return;
    };
    wipe_canonical_keys_blocking(&rt, &client).expect("wipe");

    let cid = format!("filter-cid-{}", uuid::Uuid::new_v4());
    rt.block_on(commands::publish_transition(
        &client,
        &make_transition(&cid, "analytics-reports", "IDLE", "POLLING"),
    ))
    .expect("pub ar 1");
    rt.block_on(commands::publish_transition(
        &client,
        &make_transition(&cid, "analytics-reports", "POLLING", "STALE"),
    ))
    .expect("pub ar 2");
    rt.block_on(commands::publish_transition(
        &client,
        &make_transition(&cid, "scheduled-posts", "IDLE", "FETCHING"),
    ))
    .expect("pub sp 1");

    let ar_only = rt
        .block_on(commands::read_lineage(&client, "analytics-reports", 100))
        .expect("read ar");
    assert!(
        ar_only.iter().all(|t| t.domain == "analytics-reports"),
        "all entries are analytics-reports"
    );
    assert!(
        ar_only.len() >= 2,
        "got at least 2 analytics-reports entries, got {}",
        ar_only.len()
    );

    let sp_only = rt
        .block_on(commands::read_lineage(&client, "scheduled-posts", 100))
        .expect("read sp");
    assert!(
        sp_only.iter().all(|t| t.domain == "scheduled-posts"),
        "all entries are scheduled-posts"
    );

    wipe_canonical_keys_blocking(&rt, &client).expect("cleanup");
}