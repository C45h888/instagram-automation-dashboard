//! Runtime error taxonomy.
//!
//! This module defines [`RuntimeError`] — the *only* error type the runtime
//! kernel uses. It is intentionally domain-free.
//!
//! Any concern that needs to carry business-domain vocabulary
//! is the responsibility of the preserved TypeScript platform.
//! The runtime logs them and returns
//! [`RuntimeError::InternalRuntimeError`] if the calling context is unable to
//! recover.
//!
//! See `DOMAIN_PRESERVATION_LAW_001` (repo root) for the protected systems.

use std::fmt;
use thiserror::Error;

/// All errors that can be raised by the runtime kernel.
#[derive(Debug, Error)]
pub enum RuntimeError {
    #[error("runtime startup failed: {message}")]
    StartupError { message: String },

    #[error("runtime shutdown failed: {message}")]
    ShutdownError { message: String },

    #[error("configuration error: {message}")]
    ConfigError { message: String },

    #[error("state kernel error: {message}")]
    StateError { message: String },

    #[error("window management error: {message}")]
    WindowError { message: String },

    #[error("ipc error: {message}")]
    IPCError { message: String },

    #[error("filesystem error: {message}")]
    FilesystemError { message: String },

    #[error("plugin error: {message}")]
    PluginError { message: String },

    #[error("serialization error: {message}")]
    SerializationError { message: String },

    #[error("observability error: {message}")]
    ObservabilityError { message: String },

    #[error("redis transport error: {message}")]
    RedisError { message: String },

    #[error("internal runtime error: {message}")]
    InternalRuntimeError { message: String },
}

impl RuntimeError {
    /// Construct a [`RuntimeError::StartupError`].
    pub fn startup(message: impl Into<String>) -> Self {
        Self::StartupError { message: message.into() }
    }

    /// Construct a [`RuntimeError::ShutdownError`].
    pub fn shutdown(message: impl Into<String>) -> Self {
        Self::ShutdownError { message: message.into() }
    }

    /// Construct a [`RuntimeError::ConfigError`].
    pub fn config(message: impl Into<String>) -> Self {
        Self::ConfigError { message: message.into() }
    }

    /// Construct a [`RuntimeError::StateError`].
    pub fn state(message: impl Into<String>) -> Self {
        Self::StateError { message: message.into() }
    }

    /// Construct a [`RuntimeError::WindowError`].
    pub fn window(message: impl Into<String>) -> Self {
        Self::WindowError { message: message.into() }
    }

    /// Construct a [`RuntimeError::IPCError`].
    pub fn ipc(message: impl Into<String>) -> Self {
        Self::IPCError { message: message.into() }
    }

    /// Construct a [`RuntimeError::FilesystemError`].
    pub fn filesystem(message: impl Into<String>) -> Self {
        Self::FilesystemError { message: message.into() }
    }

    /// Construct a [`RuntimeError::PluginError`].
    pub fn plugin(message: impl Into<String>) -> Self {
        Self::PluginError { message: message.into() }
    }

    /// Construct a [`RuntimeError::SerializationError`].
    pub fn serialization(message: impl Into<String>) -> Self {
        Self::SerializationError { message: message.into() }
    }

    /// Construct a [`RuntimeError::ObservabilityError`].
    pub fn observability(message: impl Into<String>) -> Self {
        Self::ObservabilityError { message: message.into() }
    }

    /// Construct a [`RuntimeError::RedisError`].
    pub fn redis(message: impl Into<String>) -> Self {
        Self::RedisError { message: message.into() }
    }

    /// Construct a [`RuntimeError::InternalRuntimeError`].
    pub fn internal(message: impl Into<String>) -> Self {
        Self::InternalRuntimeError { message: message.into() }
    }

    /// Return a stable, machine-readable error code.
    ///
    /// These codes are part of the runtime's public contract with logs and
    /// callers. They MUST NOT change without a coordinated update to any
    /// consumer that pattern-matches on them.
    pub fn kind(&self) -> &'static str {
        match self {
            Self::StartupError { .. } => "RUNTIME_STARTUP_ERROR",
            Self::ShutdownError { .. } => "RUNTIME_SHUTDOWN_ERROR",
            Self::ConfigError { .. } => "RUNTIME_CONFIG_ERROR",
            Self::StateError { .. } => "RUNTIME_STATE_ERROR",
            Self::WindowError { .. } => "RUNTIME_WINDOW_ERROR",
            Self::IPCError { .. } => "RUNTIME_IPC_ERROR",
            Self::FilesystemError { .. } => "RUNTIME_FILESYSTEM_ERROR",
            Self::PluginError { .. } => "RUNTIME_PLUGIN_ERROR",
            Self::SerializationError { .. } => "RUNTIME_SERIALIZATION_ERROR",
            Self::ObservabilityError { .. } => "RUNTIME_OBSERVABILITY_ERROR",
            Self::RedisError { .. } => "RUNTIME_REDIS_ERROR",
            Self::InternalRuntimeError { .. } => "RUNTIME_INTERNAL_ERROR",
        }
    }

    /// Return the human-readable message attached to the variant.
    pub fn message(&self) -> &str {
        match self {
            Self::StartupError { message }
            | Self::ShutdownError { message }
            | Self::ConfigError { message }
            | Self::StateError { message }
            | Self::WindowError { message }
            | Self::IPCError { message }
            | Self::FilesystemError { message }
            | Self::PluginError { message }
            | Self::SerializationError { message }
            | Self::ObservabilityError { message }
                    | Self::RedisError { message }
                    | Self::InternalRuntimeError { message } => message,
        }
    }
}

impl fmt::Display for RuntimeErrorKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

/// Re-exported alias used across the runtime kernel.
pub type RuntimeResult<T> = Result<T, RuntimeError>;

/// A read-only view of the error code, useful for downstream logging and
/// observability layers that want to match on codes without holding the
/// full error.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct RuntimeErrorKind(&'static str);

impl RuntimeErrorKind {
    /// Construct a [`RuntimeErrorKind`] from a variant's [`RuntimeError::kind`].
    pub const fn new(code: &'static str) -> Self {
        Self(code)
    }

    /// Borrow the underlying code.
    pub const fn as_str(&self) -> &'static str {
        self.0
    }
}

impl From<&RuntimeError> for RuntimeErrorKind {
    fn from(err: &RuntimeError) -> Self {
        Self::new(err.kind())
    }
}

// ---- Automatic conversions from upstream error types -------------------------
//
// These map foreign error types to the appropriate runtime variant. Each
// conversion MUST be unambiguous: if a foreign error could plausibly belong
// to multiple runtime variants, the conversion MUST NOT exist; the caller is
// forced to be explicit. This is by design — it keeps the runtime error
// surface auditable.

impl From<std::io::Error> for RuntimeError {
    fn from(err: std::io::Error) -> Self {
        Self::filesystem(err.to_string())
    }
}

impl From<serde_json::Error> for RuntimeError {
    fn from(err: serde_json::Error) -> Self {
        Self::serialization(err.to_string())
    }
}

impl From<toml::de::Error> for RuntimeError {
    fn from(err: toml::de::Error) -> Self {
        Self::config(err.to_string())
    }
}

impl From<toml::ser::Error> for RuntimeError {
    fn from(err: toml::ser::Error) -> Self {
        Self::serialization(err.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn all_variants_have_unique_kind_codes() {
        let variants = [
            RuntimeError::startup("x"),
            RuntimeError::shutdown("x"),
            RuntimeError::config("x"),
            RuntimeError::state("x"),
            RuntimeError::window("x"),
            RuntimeError::ipc("x"),
            RuntimeError::filesystem("x"),
            RuntimeError::plugin("x"),
            RuntimeError::serialization("x"),
            RuntimeError::observability("x"),
            RuntimeError::redis("x"),
            RuntimeError::internal("x"),
        ];
        let mut codes: Vec<&'static str> = variants.iter().map(|v| v.kind()).collect();
        codes.sort_unstable();
        codes.dedup();
        assert_eq!(codes.len(), variants.len(), "duplicate kind() code");
    }

    #[test]
    fn kind_codes_match_contract() {
        assert_eq!(RuntimeError::startup("x").kind(), "RUNTIME_STARTUP_ERROR");
        assert_eq!(RuntimeError::shutdown("x").kind(), "RUNTIME_SHUTDOWN_ERROR");
        assert_eq!(RuntimeError::config("x").kind(), "RUNTIME_CONFIG_ERROR");
        assert_eq!(RuntimeError::state("x").kind(), "RUNTIME_STATE_ERROR");
        assert_eq!(RuntimeError::window("x").kind(), "RUNTIME_WINDOW_ERROR");
        assert_eq!(RuntimeError::ipc("x").kind(), "RUNTIME_IPC_ERROR");
        assert_eq!(
            RuntimeError::filesystem("x").kind(),
            "RUNTIME_FILESYSTEM_ERROR"
        );
        assert_eq!(RuntimeError::plugin("x").kind(), "RUNTIME_PLUGIN_ERROR");
        assert_eq!(
            RuntimeError::serialization("x").kind(),
            "RUNTIME_SERIALIZATION_ERROR"
        );
        assert_eq!(
            RuntimeError::observability("x").kind(),
            "RUNTIME_OBSERVABILITY_ERROR"
        );
        assert_eq!(
            RuntimeError::redis("x").kind(),
            "RUNTIME_REDIS_ERROR"
        );
        assert_eq!(
            RuntimeError::internal("x").kind(),
            "RUNTIME_INTERNAL_ERROR"
        );
    }

    #[test]
    fn from_io_error_maps_to_filesystem() {
        let io = std::io::Error::new(std::io::ErrorKind::NotFound, "missing");
        let r: RuntimeError = io.into();
        assert_eq!(r.kind(), "RUNTIME_FILESYSTEM_ERROR");
    }

    #[test]
    fn from_serde_json_error_maps_to_serialization() {
        let json = serde_json::from_str::<serde_json::Value>("not json").unwrap_err();
        let r: RuntimeError = json.into();
        assert_eq!(r.kind(), "RUNTIME_SERIALIZATION_ERROR");
    }

    #[test]
    fn from_toml_de_error_maps_to_config() {
        let toml_err = toml::from_str::<toml::Value>("= = =").unwrap_err();
        let r: RuntimeError = toml_err.into();
        assert_eq!(r.kind(), "RUNTIME_CONFIG_ERROR");
    }

    #[test]
    fn kind_helper_round_trips() {
        let err = RuntimeError::startup("boot");
        let kind: RuntimeErrorKind = (&err).into();
        assert_eq!(kind.as_str(), err.kind());
    }

    #[test]
    fn message_is_preserved() {
        let err = RuntimeError::config("bad env");
        assert_eq!(err.message(), "bad env");
    }
}
