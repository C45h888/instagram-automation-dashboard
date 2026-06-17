//! Runtime configuration types.
//!
//! These types are intentionally domain-free. They describe the runtime
//! itself (window dimensions, log level, sink configuration) — not the
//! business platform the runtime hosts.

use serde::{Deserialize, Serialize};

/// Top-level runtime configuration.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Config {
    pub environment: Environment,
    pub window: WindowConfig,
    pub logging: LoggingConfig,
    pub runtime: RuntimeConfig,
}

impl Config {
    /// Return a development-friendly default configuration. Used when
    /// neither a config file nor a complete env-var override is present.
    pub fn dev_default() -> Self {
        Self {
            environment: Environment::Dev,
            window: WindowConfig::default(),
            logging: LoggingConfig::default(),
            runtime: RuntimeConfig::default(),
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Environment {
    Dev,
    Staging,
    Prod,
}

impl Environment {
    pub const fn as_str(&self) -> &'static str {
        match self {
            Self::Dev => "dev",
            Self::Staging => "staging",
            Self::Prod => "prod",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WindowConfig {
    pub title: String,
    pub width: u32,
    pub height: u32,
    pub min_width: u32,
    pub min_height: u32,
    pub resizable: bool,
}

impl Default for WindowConfig {
    fn default() -> Self {
        Self {
            title: "Automation Kernel".into(),
            width: 1280,
            height: 800,
            min_width: 800,
            min_height: 600,
            resizable: true,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum LoggingFormat {
    Json,
    Text,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LoggingConfig {
    pub level: String,
    pub format: LoggingFormat,
    pub stdout: bool,
    pub file_path: Option<String>,
}

impl Default for LoggingConfig {
    fn default() -> Self {
        Self {
            level: "info".into(),
            format: LoggingFormat::Text,
            stdout: true,
            file_path: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RuntimeConfig {
    pub product_name: String,
    pub identifier: String,
}

impl Default for RuntimeConfig {
    fn default() -> Self {
        Self {
            product_name: "automation-kernel".into(),
            identifier: "com.systemic.runtime".into(),
        }
    }
}
