//! Configuration loader.
//!
//! Resolution order:
//!
//! 1. If `RUNTIME_CONFIG` env var points to a TOML file, load it.
//! 2. Otherwise, attempt to load `runtime/config/{environment}.toml`.
//! 3. If neither path exists, fall back to [`Config::dev_default`].
//!
//! The loaded value is then run through [`validate`]. Invalid config
//! returns [`RuntimeError::ConfigError`] and the process never boots.

use std::path::PathBuf;

use crate::error::runtime_error::RuntimeError;
use crate::error::runtime_error::RuntimeResult;

use super::config::{Config, Environment};
use super::environment;
use super::validation;

#[derive(Debug)]
pub struct Loader;

impl Loader {
    pub fn load() -> RuntimeResult<Config> {
        let env = environment::resolve_from_env()?;

        let config = if let Some(path) = explicit_path() {
            load_from_file(&path)?
        } else if let Some(default_path) = default_path_for(env) {
            if default_path.exists() {
                load_from_file(&default_path)?
            } else {
                Config::dev_default()
            }
        } else {
            Config::dev_default()
        };

        validation::validate(&config)?;
        Ok(config)
    }
}

fn explicit_path() -> Option<PathBuf> {
    std::env::var("RUNTIME_CONFIG").ok().map(PathBuf::from)
}

fn default_path_for(env: Environment) -> Option<PathBuf> {
    Some(PathBuf::from(format!(
        "runtime/config/{}.toml",
        env.as_str()
    )))
}

fn load_from_file(path: &std::path::Path) -> RuntimeResult<Config> {
    let raw = std::fs::read_to_string(path).map_err(|e| {
        RuntimeError::config(format!(
            "could not read config file '{}': {}",
            path.display(),
            e
        ))
    })?;
    let parsed: Config = toml::from_str(&raw).map_err(|e| {
        RuntimeError::config(format!(
            "could not parse config file '{}': {}",
            path.display(),
            e
        ))
    })?;
    Ok(parsed)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn dev_default_validates() {
        let cfg = Config::dev_default();
        validation::validate(&cfg).expect("dev default must validate");
    }

    #[test]
    fn explicit_path_overrides_default() {
        let dir = tempdir();
        let path = dir.join("test.toml");
        let mut file = std::fs::File::create(&path).unwrap();
        writeln!(
            file,
            r#"
            environment = "dev"
            [window]
            title = "Test"
            width = 1024
            height = 768
            min_width = 800
            min_height = 600
            resizable = true
            [logging]
            level = "info"
            format = "text"
            stdout = true
            file_path = ""
            [runtime]
            product_name = "test"
            identifier = "com.test"
            "#
        )
        .unwrap();
        std::env::set_var("RUNTIME_CONFIG", &path);
        let cfg = Loader::load().expect("load");
        assert_eq!(cfg.window.title, "Test");
        std::env::remove_var("RUNTIME_CONFIG");
    }

    #[test]
    fn invalid_config_fails_validation() {
        let bad = Config {
            environment: Environment::Dev,
            window: super::super::config::WindowConfig {
                width: 100,
                height: 100,
                min_width: 200,
                ..Default::default()
            },
            logging: Default::default(),
            runtime: Default::default(),
        };
        let err = validation::validate(&bad).unwrap_err();
        assert_eq!(err.kind(), "RUNTIME_CONFIG_ERROR");
    }

    fn tempdir() -> PathBuf {
        let p = std::env::temp_dir().join(format!(
            "automation-kernel-test-{}",
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(&p).unwrap();
        p
    }
}
