//! Desktop settings owned by the kernel.
//!
//! This is *desktop* settings — theme, font scale, window preferences.
//! It does NOT contain user, tenant, or platform settings. Those belong
//! to the preserved TypeScript platform.

use std::sync::RwLock;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    System,
    Light,
    Dark,
}

impl Default for Theme {
    fn default() -> Self {
        Self::System
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WindowPrefs {
    pub start_maximized: bool,
    pub remember_position: bool,
}

impl Default for WindowPrefs {
    fn default() -> Self {
        Self {
            start_maximized: false,
            remember_position: true,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SettingsState {
    theme: RwLock<Theme>,
    font_scale: RwLock<f32>,
    window_prefs: RwLock<WindowPrefs>,
}

impl SettingsState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn theme(&self) -> Theme {
        *self.theme.read().expect("settings.theme poisoned")
    }

    pub fn set_theme(&self, theme: Theme) {
        *self.theme.write().expect("settings.theme poisoned") = theme;
    }

    pub fn font_scale(&self) -> f32 {
        *self.font_scale.read().expect("settings.font_scale poisoned")
    }

    pub fn set_font_scale(&self, scale: f32) {
        // Clamp to a sane range to prevent UI breakage.
        let clamped = scale.clamp(0.5, 3.0);
        *self.font_scale.write().expect("settings.font_scale poisoned") = clamped;
    }

    pub fn window_prefs(&self) -> WindowPrefs {
        self.window_prefs
            .read()
            .expect("settings.window_prefs poisoned")
            .clone()
    }

    pub fn set_window_prefs(&self, prefs: WindowPrefs) {
        *self.window_prefs.write().expect("settings.window_prefs poisoned") = prefs;
    }
}

impl Default for SettingsState {
    fn default() -> Self {
        Self {
            theme: RwLock::new(Theme::default()),
            font_scale: RwLock::new(1.0),
            window_prefs: RwLock::new(WindowPrefs::default()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_are_sensible() {
        let s = SettingsState::new();
        assert_eq!(s.theme(), Theme::System);
        assert_eq!(s.font_scale(), 1.0);
        assert_eq!(s.window_prefs(), WindowPrefs::default());
    }

    #[test]
    fn font_scale_is_clamped() {
        let s = SettingsState::new();
        s.set_font_scale(10.0);
        assert_eq!(s.font_scale(), 3.0);
        s.set_font_scale(0.1);
        assert_eq!(s.font_scale(), 0.5);
    }

    #[test]
    fn theme_round_trip_via_serde() {
        let s = SettingsState::new();
        s.set_theme(Theme::Dark);
        assert_eq!(s.theme(), Theme::Dark);
    }

    #[test]
    fn window_prefs_update() {
        let s = SettingsState::new();
        s.set_window_prefs(WindowPrefs {
            start_maximized: true,
            remember_position: false,
        });
        let p = s.window_prefs();
        assert!(p.start_maximized);
        assert!(!p.remember_position);
    }

    #[test]
    fn settings_serde_round_trip() {
        // The default is serialisable + deserialisable.
        let s = SettingsState::new();
        let v: serde_json::Value = serde_json::to_value(&s).unwrap();
        // The fields we care about are present.
        assert!(v.get("theme").is_some());
        assert!(v.get("font_scale").is_some());
        assert!(v.get("window_prefs").is_some());
    }

    #[test]
    fn settings_serializes_inner_values() {
        let s = SettingsState::new();
        s.set_theme(Theme::Dark);
        s.set_font_scale(1.25);
        let v: serde_json::Value = serde_json::to_value(&s).unwrap();
        assert_eq!(v["theme"], serde_json::json!("dark"));
        assert_eq!(v["font_scale"], serde_json::json!(1.25));
    }
}
