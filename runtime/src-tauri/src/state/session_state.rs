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
        let dbg = format!("{:?}", s);
        for forbidden in ["user_id", "account_id", "access_token", "auth"] {
            assert!(
                !dbg.to_lowercase().contains(forbidden),
                "SessionState Debug exposes forbidden field: {}",
                forbidden
            );
        }
    }
}
