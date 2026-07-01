//! Configuration validation.
//!
//! Validation is run after loading. The runtime fails fast on any
//! invariant violation — the process never boots with bad config.

use crate::error::runtime_error::RuntimeError;
use crate::error::runtime_error::RuntimeResult;

use super::config::Config;

pub fn validate(config: &Config) -> RuntimeResult<()> {
    if config.window.width < config.window.min_width {
        return Err(RuntimeError::config(format!(
            "window.width ({}) must be >= window.min_width ({})",
            config.window.width, config.window.min_width
        )));
    }
    if config.window.height < config.window.min_height {
        return Err(RuntimeError::config(format!(
            "window.height ({}) must be >= window.min_height ({})",
            config.window.height, config.window.min_height
        )));
    }
    if config.window.width == 0 || config.window.height == 0 {
        return Err(RuntimeError::config(
            "window dimensions must be non-zero",
        ));
    }
    if config.runtime.identifier.is_empty() {
        return Err(RuntimeError::config(
            "runtime.identifier must not be empty",
        ));
    }
    if config.runtime.product_name.is_empty() {
        return Err(RuntimeError::config(
            "runtime.product_name must not be empty",
        ));
    }
    if config.logging.level.is_empty() {
        return Err(RuntimeError::config(
            "logging.level must not be empty",
        ));
    }
    // Frontend config is validated — required fields must be present.
    // api_base_url defaults to a safe fallback so we only error if it
    // is explicitly set to empty string (meaning misconfigured).
    if config.frontend.api_base_url.is_empty() {
        return Err(RuntimeError::config(
            "frontend.api_base_url must not be empty; set a valid URL or omit to use the default",
        ));
    }
    Ok(())
}
