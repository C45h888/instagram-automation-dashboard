//! Runtime configuration types.
//!
//! These types are intentionally domain-free. They describe the runtime
//! itself (window dimensions, log level, sink configuration) — not the
//! business platform the runtime hosts.

use serde::{Deserialize, Serialize};

/// Frontend-facing configuration values. Exposed to the WebView via IPC
/// so that all WebView code reads config from the kernel rather than
/// directly from Vite environment variables.
///
/// This separates **where config comes from** (kernel: TOML + env vars)
/// from **who consumes it** (kernel + WebView via IPC).
///
/// Defaults are safe dev-mode fallbacks. Production values come from
/// the TOML config file or environment variables resolved at boot.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FrontendConfig {
    /// Base URL for the backend REST API (oversight chat, health,
    /// queue-monitor, content analytics).
    pub api_base_url: String,
    /// Primary Supabase project URL.
    pub supabase_url: String,
    /// Optional tunnel URL for browser-based Supabase access.
    pub supabase_tunnel_url: Option<String>,
    /// Optional direct URL for Supabase (bypasses tunnel).
    pub supabase_direct_url: Option<String>,
    /// Supabase anon key (safe to expose to WebView).
    pub supabase_anon_key: String,
    /// Optional admin email for dev-admin policy gating.
    pub admin_email: Option<String>,
}

impl Default for FrontendConfig {
    fn default() -> Self {
        Self {
            api_base_url: "https://api.888intelligenceautomation.in".into(),
            supabase_url: String::new(),
            supabase_tunnel_url: None,
            supabase_direct_url: None,
            supabase_anon_key: String::new(),
            admin_email: None,
        }
    }
}

/// Top-level runtime configuration.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Config {
    pub environment: Environment,
    pub window: WindowConfig,
    pub logging: LoggingConfig,
    pub runtime: RuntimeConfig,
    pub frontend: FrontendConfig,
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
            frontend: FrontendConfig::default(),
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
