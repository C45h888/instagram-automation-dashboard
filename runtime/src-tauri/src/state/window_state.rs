//! Window state owned by the kernel.
//!
//! Tracks the runtime's *current* window — its label, dimensions, focus.
//! This is desktop window state, not application view state.

use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct WindowState {
    pub label: String,
    pub title: String,
    pub width: AtomicU32,
    pub height: AtomicU32,
    pub focused: AtomicBool,
    pub last_active_at: AtomicU64,
}

impl WindowState {
    pub fn new(label: impl Into<String>, title: impl Into<String>, width: u32, height: u32) -> Self {
        Self {
            label: label.into(),
            title: title.into(),
            width: AtomicU32::new(width),
            height: AtomicU32::new(height),
            focused: AtomicBool::new(false),
            last_active_at: AtomicU64::new(now_secs()),
        }
    }

    pub fn label(&self) -> &str {
        &self.label
    }

    pub fn title(&self) -> &str {
        &self.title
    }

    pub fn width(&self) -> u32 {
        self.width.load(Ordering::SeqCst)
    }

    pub fn height(&self) -> u32 {
        self.height.load(Ordering::SeqCst)
    }

    pub fn is_focused(&self) -> bool {
        self.focused.load(Ordering::SeqCst)
    }

    pub fn set_focused(&self, focused: bool) {
        self.focused.store(focused, Ordering::SeqCst);
        self.touch();
    }

    pub fn resize(&self, width: u32, height: u32) {
        self.width.store(width, Ordering::SeqCst);
        self.height.store(height, Ordering::SeqCst);
        self.touch();
    }

    pub fn last_active_at(&self) -> u64 {
        self.last_active_at.load(Ordering::SeqCst)
    }

    fn touch(&self) {
        self.last_active_at.store(now_secs(), Ordering::SeqCst);
    }
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_window_state_has_expected_defaults() {
        let s = WindowState::new("main", "Automation Kernel", 1280, 800);
        assert_eq!(s.label(), "main");
        assert_eq!(s.title(), "Automation Kernel");
        assert_eq!(s.width(), 1280);
        assert_eq!(s.height(), 800);
        assert!(!s.is_focused());
    }

    #[test]
    fn focus_toggle() {
        let s = WindowState::new("main", "t", 800, 600);
        s.set_focused(true);
        assert!(s.is_focused());
        s.set_focused(false);
        assert!(!s.is_focused());
    }

    #[test]
    fn resize_updates_dimensions() {
        let s = WindowState::new("main", "t", 800, 600);
        s.resize(1024, 768);
        assert_eq!(s.width(), 1024);
        assert_eq!(s.height(), 768);
    }
}
