//! State kernel for the runtime.
//!
//! The state kernel owns four containers:
//!
//! - [`runtime_state::RuntimeState`] — process-level runtime state
//! - [`window_state::WindowState`] — current window metadata
//! - [`settings_state::SettingsState`] — desktop settings (theme, etc.)
//! - [`session_state::SessionState`] — window session (NOT auth session)
//!
//! No state type carries domain concerns. Auth, accounts, tokens,
//! and any business-domain data — all of those live in the preserved
//! TypeScript platform. The runtime kernel holds metadata only.

pub mod runtime_state;
pub mod session_state;
pub mod settings_state;
pub mod window_state;

pub use runtime_state::{AppState, RuntimePhase, RuntimeState};
pub use session_state::{SessionState, ViewMetadata};
pub use settings_state::{SettingsState, Theme, WindowPrefs};
pub use window_state::WindowState;
