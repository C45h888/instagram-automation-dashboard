//! Redis configuration loader.
//!
//! Resolves connection parameters from environment variables. Mirrors
//! the backend's existing connection shape (REDIS_URL + REDIS_PASSWORD
//! + REDIS_DB) so the WebView FSM and the backend lineage writer can
//! share the same Redis instance with the same credentials.
//!
//! Resolution order:
//!
//! 1. `REDIS_URL` (e.g. `redis://127.0.0.1:6379` or `rediss://...`).
//!    Defaults to `redis://127.0.0.1:6379` if unset.
//! 2. `REDIS_PASSWORD` — optional. If unset, no AUTH is sent.
//! 3. `REDIS_DB` — optional. Defaults to `0`.
//!
//! The loader never panics on missing env vars; it falls back to
//! sensible defaults so the kernel boots even if Redis is unconfigured.

use std::env;

use crate::error::runtime_error::{RuntimeError, RuntimeResult};

/// Resolved Redis connection configuration.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RedisConfig {
    /// Connection URL — e.g. `redis://127.0.0.1:6379`.
    pub url: String,
    /// Optional password for AUTH.
    pub password: Option<String>,
    /// Logical database index (0..15).
    pub db: u8,
}

impl RedisConfig {
    /// Load from process environment.
    pub fn from_env() -> RuntimeResult<Self> {
        let url =
            env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());

        if url.trim().is_empty() {
            return Err(RuntimeError::config("REDIS_URL is empty"));
        }
        if !(url.starts_with("redis://") || url.starts_with("rediss://")) {
            return Err(RuntimeError::config(format!(
                "REDIS_URL must start with redis:// or rediss://, got: {url}"
            )));
        }

        let password = env::var("REDIS_PASSWORD").ok().filter(|v| !v.is_empty());

        let db: u8 = match env::var("REDIS_DB") {
            Ok(s) => s.parse().map_err(|_| {
                RuntimeError::config(format!("REDIS_DB must be u8, got: {s}"))
            })?,
            Err(_) => 0,
        };

        Ok(Self { url, password, db })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Env-driven loader with safe defaults. Tests in this module
    /// mutate process env, so each test serialises access by unique
    /// var keys and restores the prior value at the end.
    #[test]
    fn from_env_defaults_when_unset() {
        // Wipe relevant env vars
        let prev_url = env::var("REDIS_URL").ok();
        let prev_pw = env::var("REDIS_PASSWORD").ok();
        let prev_db = env::var("REDIS_DB").ok();
        env::remove_var("REDIS_URL");
        env::remove_var("REDIS_PASSWORD");
        env::remove_var("REDIS_DB");

        let cfg = RedisConfig::from_env().expect("load defaults");
        assert_eq!(cfg.url, "redis://127.0.0.1:6379");
        assert_eq!(cfg.password, None);
        assert_eq!(cfg.db, 0);

        // Restore
        if let Some(v) = prev_url { env::set_var("REDIS_URL", v); }
        if let Some(v) = prev_pw { env::set_var("REDIS_PASSWORD", v); }
        if let Some(v) = prev_db { env::set_var("REDIS_DB", v); }
    }

    #[test]
    fn from_env_reads_url_password_db() {
        let prev_url = env::var("REDIS_URL").ok();
        let prev_pw = env::var("REDIS_PASSWORD").ok();
        let prev_db = env::var("REDIS_DB").ok();

        env::set_var("REDIS_URL", "redis://10.0.0.5:6380");
        env::set_var("REDIS_PASSWORD", "secret-123");
        env::set_var("REDIS_DB", "3");

        let cfg = RedisConfig::from_env().expect("load");
        assert_eq!(cfg.url, "redis://10.0.0.5:6380");
        assert_eq!(cfg.password.as_deref(), Some("secret-123"));
        assert_eq!(cfg.db, 3);

        env::remove_var("REDIS_URL");
        env::remove_var("REDIS_PASSWORD");
        env::remove_var("REDIS_DB");
        if let Some(v) = prev_url { env::set_var("REDIS_URL", v); }
        if let Some(v) = prev_pw { env::set_var("REDIS_PASSWORD", v); }
        if let Some(v) = prev_db { env::set_var("REDIS_DB", v); }
    }

    #[test]
    fn from_env_treats_empty_password_as_none() {
        let prev = env::var("REDIS_PASSWORD").ok();
        env::set_var("REDIS_PASSWORD", "");

        let cfg = RedisConfig::from_env().expect("load");
        assert_eq!(cfg.password, None);

        env::remove_var("REDIS_PASSWORD");
        if let Some(v) = prev { env::set_var("REDIS_PASSWORD", v); }
    }

    #[test]
    fn from_env_rejects_invalid_scheme() {
        let prev = env::var("REDIS_URL").ok();
        env::set_var("REDIS_URL", "http://nope");

        let err = RedisConfig::from_env().unwrap_err();
        assert_eq!(err.kind(), "RUNTIME_CONFIG_ERROR");
        assert!(err.message().contains("REDIS_URL"));

        env::remove_var("REDIS_URL");
        if let Some(v) = prev { env::set_var("REDIS_URL", v); }
    }

    #[test]
    fn from_env_rejects_invalid_db() {
        let prev_url = env::var("REDIS_URL").ok();
        let prev_db = env::var("REDIS_DB").ok();
        env::set_var("REDIS_URL", "redis://127.0.0.1:6379");
        env::set_var("REDIS_DB", "not-a-number");

        let err = RedisConfig::from_env().unwrap_err();
        assert_eq!(err.kind(), "RUNTIME_CONFIG_ERROR");

        env::remove_var("REDIS_URL");
        env::remove_var("REDIS_DB");
        if let Some(v) = prev_url { env::set_var("REDIS_URL", v); }
        if let Some(v) = prev_db { env::set_var("REDIS_DB", v); }
    }

    #[test]
    fn from_env_rejects_empty_url() {
        let prev = env::var("REDIS_URL").ok();
        env::set_var("REDIS_URL", "   ");

        let err = RedisConfig::from_env().unwrap_err();
        assert_eq!(err.kind(), "RUNTIME_CONFIG_ERROR");

        env::remove_var("REDIS_URL");
        if let Some(v) = prev { env::set_var("REDIS_URL", v); }
    }
}