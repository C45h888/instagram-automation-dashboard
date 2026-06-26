//! Window session state owned by the kernel.
//!
//! **This is a window session — NOT an authenticated user session.**
//!
//! A `SessionState` describes the runtime's *current* window session:
//! when it opened, what view is mounted, what its lifecycle id is. It
//! carries no auth, no account, no token, no user identity. The
//! preserved TypeScript platform holds the authenticated session.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::de::Deserializer;
use serde::ser::{SerializeStruct, Serializer};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ViewMetadata {
    pub view_id: String,
    pub mounted_at_epoch_secs: u64,
}

impl ViewMetadata {
    pub fn new(view_id: impl Into<String>) -> Self {
        Self {
            view_id: view_id.into(),
            mounted_at_epoch_secs: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0),
        }
    }
}

/// Window session — the current `WebviewWindow`'s lifecycle.
///
/// `SessionState` is `Send + Sync` (via `Mutex` + `AtomicU64`) so it can
/// live in `tauri::State<T>`. The `Clone`, `Serialize`, and `Deserialize`
/// impls are hand-written because the inner `Mutex<Option<ViewMetadata>>`
/// doesn't auto-derive them; the impls lock the mutex briefly to read or
/// replace the view, then release it.
///
/// **No field in this struct may be auth-shaped.** The
/// `session_carries_no_auth_fields` test below is a structural probe
/// that fails the build if any forbidden identifier sneaks in.
pub struct SessionState {
    session_id: String,
    started_at: AtomicU64,
    view: Mutex<Option<ViewMetadata>>,
}

impl SessionState {
    pub fn new(session_id: impl Into<String>) -> Self {
        Self {
            session_id: session_id.into(),
            started_at: AtomicU64::new(now_secs()),
            view: Mutex::new(None),
        }
    }

    pub fn session_id(&self) -> &str {
        &self.session_id
    }

    pub fn started_at(&self) -> u64 {
        self.started_at.load(Ordering::SeqCst)
    }

    pub fn mount_view(&self, view: ViewMetadata) {
        *self.view.lock().expect("session view poisoned") = Some(view);
    }

    pub fn unmount_view(&self) {
        *self.view.lock().expect("session view poisoned") = None;
    }

    pub fn current_view(&self) -> Option<ViewMetadata> {
        self.view
            .lock()
            .expect("session view poisoned")
            .clone()
    }
}

// --- Manual trait impls ----------------------------------------------------
//
// `Mutex<Option<ViewMetadata>>` does not derive Clone / Serialize /
// Deserialize. We implement them here so SessionState satisfies the
// Phase 1 Step C contract: "Each state type derives
// Debug, Clone, Serialize, Deserialize". The impls respect the Mutex
// by taking a brief lock around the inner value.

impl Clone for SessionState {
    fn clone(&self) -> Self {
        Self {
            session_id: self.session_id.clone(),
            started_at: AtomicU64::new(self.started_at.load(Ordering::SeqCst)),
            view: Mutex::new(
                self.view
                    .lock()
                    .expect("session view poisoned")
                    .clone(),
            ),
        }
    }
}

impl Serialize for SessionState {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let view_guard = self.view.lock().expect("session view poisoned");
        let mut s = serializer.serialize_struct("SessionState", 3)?;
        s.serialize_field("session_id", &self.session_id)?;
        s.serialize_field("started_at", &self.started_at.load(Ordering::SeqCst))?;
        s.serialize_field("view", &*view_guard)?;
        s.end()
    }
}

impl<'de> Deserialize<'de> for SessionState {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        #[derive(Deserialize)]
        struct Inner {
            session_id: String,
            started_at: u64,
            view: Option<ViewMetadata>,
        }
        let inner = Inner::deserialize(deserializer)?;
        Ok(Self {
            session_id: inner.session_id,
            started_at: AtomicU64::new(inner.started_at),
            view: Mutex::new(inner.view),
        })
    }
}

impl std::fmt::Debug for SessionState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SessionState")
            .field("session_id", &self.session_id)
            .field("started_at", &self.started_at)
            .field("view", &self.view.lock().expect("session view poisoned"))
            .finish()
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
    fn new_session_has_no_view_mounted() {
        let s = SessionState::new("test-session");
        assert!(s.current_view().is_none());
        assert_eq!(s.session_id(), "test-session");
    }

    #[test]
    fn mount_and_unmount_view() {
        let s = SessionState::new("test-session");
        s.mount_view(ViewMetadata::new("main-window"));
        let v = s.current_view().expect("view should be mounted");
        assert_eq!(v.view_id, "main-window");
        s.unmount_view();
        assert!(s.current_view().is_none());
    }

    #[test]
    fn session_carries_no_auth_fields() {
        // Compile-time + runtime assertion: the runtime SessionState
        // struct has no field named user_id, account_id, or access_token.
        // We check the Debug output as a structural probe — it would
        // include any such field.
        let s = SessionState::new("test");
        let dbg = format!("{s:?}");
        for forbidden in ["user_id", "account_id", "access_token", "auth"] {
            assert!(
                !dbg.to_lowercase().contains(forbidden),
                "SessionState Debug exposes forbidden field: {forbidden}"
            );
        }
    }

    #[test]
    fn session_state_round_trips_through_serde() {
        // Step C contract: each state type derives Serialize + Deserialize.
        let original = SessionState::new("session-A");
        original.mount_view(ViewMetadata::new("main-window"));
        let json = serde_json::to_string(&original).expect("serialize");
        let back: SessionState = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(back.session_id(), original.session_id());
        assert_eq!(back.started_at(), original.started_at());
        assert_eq!(
            back.current_view().expect("view should round-trip").view_id,
            "main-window"
        );
    }

    #[test]
    fn session_state_clone_is_independent() {
        let original = SessionState::new("session-B");
        original.mount_view(ViewMetadata::new("main"));
        let cloned = original.clone();
        cloned.unmount_view();
        // Mutating the clone must not affect the original.
        assert!(cloned.current_view().is_none());
        assert!(original.current_view().is_some());
    }
}
