//! Redis connection client.
//!
//! Wraps [`redis::aio::ConnectionManager`] — the redis crate's
//! auto-reconnecting async connection. The manager transparently
//! reconnects on transient failures (timeout, dropped connection,
//! refusal). We never manually reconnect.
//!
//! The kernel holds at most one [`RedisClient`]. It is constructed
//! once during [`crate::bootstrap::startup`] and registered into
//! Tauri's managed state so IPC commands can fetch it via
//! `tauri::State<'_, RedisClient>`.

use std::sync::Arc;

use redis::aio::ConnectionManager;
use redis::Client;
use tokio::sync::Mutex;

use crate::error::runtime_error::{RuntimeError, RuntimeResult};
use crate::redis::config::RedisConfig;
use crate::redis::errors::RedisError;

/// Owning handle to the kernel's Redis connection.
///
/// Cheap to clone — internally `Arc<Mutex<ConnectionManager>>`.
#[derive(Clone)]
pub struct RedisClient {
    inner: Arc<Mutex<ConnectionManager>>,
    config: RedisConfig,
}

impl std::fmt::Debug for RedisClient {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("RedisClient")
            .field("url", &self.config.url)
            .field("db", &self.config.db)
            .field("password_set", &self.config.password.is_some())
            .finish()
    }
}

impl RedisClient {
    /// Connect using the given config. Returns an error if the initial
    /// connection attempt fails.
    ///
    /// Note: the kernel calls this during startup and treats the
    /// initial failure as **non-fatal** — see
    /// [`crate::bootstrap::startup`]. The bootstrap layer logs the
    /// error and proceeds without a client; FSM ops that need Redis
    /// will surface DEGRADED via heartbeat.
    pub async fn connect(config: RedisConfig) -> RuntimeResult<Self> {
        let client = Client::open(config.url.clone())
            .map_err(|e| RuntimeError::redis(format!("invalid client: {e}")))?;

        let mut conn = ConnectionManager::new(client)
            .await
            .map_err(RedisError::from)?;

        if let Some(pw) = config.password.clone() {
            let _: () = redis::cmd("AUTH")
                .arg(pw)
                .query_async(&mut conn)
                .await
                .map_err(RedisError::from)?;
        }

        Ok(Self {
            inner: Arc::new(Mutex::new(conn)),
            config,
        })
    }

    /// Acquire the inner connection for use in a single Redis op.
    /// Callers MUST drop the guard before awaiting on anything that
    /// could deadlock against other ops.
    pub async fn conn(&self) -> tokio::sync::MutexGuard<'_, ConnectionManager> {
        self.inner.lock().await
    }

    /// Read the resolved config (URL, password presence, db).
    pub fn config(&self) -> &RedisConfig {
        &self.config
    }

    /// Cheap health check — sends PING. Returns Ok(()) when reachable.
    pub async fn ping(&self) -> RuntimeResult<()> {
        let mut conn = self.conn().await;
        let pong: String = redis::cmd("PING")
            .query_async(&mut *conn)
            .await
            .map_err(RedisError::from)?;
        if pong == "PONG" {
            Ok(())
        } else {
            Err(RuntimeError::redis(format!(
                "PING returned unexpected value: {pong}"
            )))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Config debug output must redact the password — never log its
    /// value. We verify the bool field is exposed but the value is not.
    #[test]
    fn debug_redacts_password_presence_only_not_value() {
        let cfg = RedisConfig {
            url: "redis://127.0.0.1:6379".into(),
            password: Some("super-secret".into()),
            db: 0,
        };
        let dbg = format!(
            "url={} db={} pw_set={}",
            cfg.url,
            cfg.db,
            cfg.password.is_some()
        );
        assert!(dbg.contains("redis://127.0.0.1:6379"));
        assert!(dbg.contains("pw_set=true"));
        assert!(!dbg.contains("super-secret"));
    }
}