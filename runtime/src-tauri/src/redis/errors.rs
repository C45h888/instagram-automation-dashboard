//! Redis error type. Thin wrapper that converts upstream
//! [`redis::RedisError`] into a kernel-shaped error.
//!
//! The FSM IPC commands map every Redis error to
//! [`crate::error::RuntimeError::RedisError`] via the blanket `From`
//! impl below. The WebView FSM never sees a `redis::RedisError` —
//! only `IpcErrorDTO { kind: "RUNTIME_REDIS_ERROR", message }`.

use thiserror::Error;

use crate::error::runtime_error::RuntimeError;

#[derive(Debug, Error)]
pub enum RedisError {
    #[error("redis connection error: {0}")]
    Connection(String),

    #[error("redis command error: {0}")]
    Command(String),

    #[error("redis serialization error: {0}")]
    Serialization(String),
}

impl From<redis::RedisError> for RedisError {
    fn from(err: redis::RedisError) -> Self {
        // Categorise by kind when possible. The redis crate exposes
        // `is_io_error`, `is_connection_dropped`, `is_connection_refusal`,
        // `is_timeout`, `is_cluster_error`. We treat all of those as
        // Connection errors; everything else is a Command error.
        if err.is_io_error()
            || err.is_connection_dropped()
            || err.is_connection_refusal()
            || err.is_timeout()
        {
            Self::Connection(err.to_string())
        } else {
            Self::Command(err.to_string())
        }
    }
}

impl From<RedisError> for RuntimeError {
    fn from(err: RedisError) -> Self {
        RuntimeError::redis(err.to_string())
    }
}

impl From<serde_json::Error> for RedisError {
    fn from(err: serde_json::Error) -> Self {
        Self::Serialization(err.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redis_error_maps_to_runtime_error_with_redis_kind() {
        let r: RuntimeError = RedisError::Connection("conn refused".into()).into();
        assert_eq!(r.kind(), "RUNTIME_REDIS_ERROR");
        assert!(r.message().contains("conn refused"));
    }

    #[test]
    fn command_error_maps_to_runtime_error_with_redis_kind() {
        let r: RuntimeError = RedisError::Command("WRONGTYPE".into()).into();
        assert_eq!(r.kind(), "RUNTIME_REDIS_ERROR");
        assert!(r.message().contains("WRONGTYPE"));
    }

    #[test]
    fn serde_error_maps_to_redis_serialization() {
        let json_err = serde_json::from_str::<serde_json::Value>("not json").unwrap_err();
        let r: RedisError = json_err.into();
        assert!(matches!(r, RedisError::Serialization(_)));
    }
}