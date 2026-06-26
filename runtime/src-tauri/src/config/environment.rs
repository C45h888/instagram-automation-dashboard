//! Environment resolution for the runtime configuration loader.

use std::env;
use std::str::FromStr;

use crate::error::runtime_error::RuntimeError;
use crate::error::runtime_error::RuntimeResult;

use super::config::Environment;

pub fn resolve_from_env() -> RuntimeResult<Environment> {
    let raw = env::var("RUNTIME_ENV").unwrap_or_else(|_| "dev".to_string());
    Environment::from_str(&raw).map_err(|_| {
        RuntimeError::config(format!(
            "invalid RUNTIME_ENV value '{raw}' (expected one of: dev, staging, prod)"
        ))
    })
}

impl FromStr for Environment {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.trim().to_ascii_lowercase().as_str() {
            "dev" | "development" => Ok(Self::Dev),
            "staging" | "stage" => Ok(Self::Staging),
            "prod" | "production" => Ok(Self::Prod),
            _ => Err(()),
        }
    }
}
