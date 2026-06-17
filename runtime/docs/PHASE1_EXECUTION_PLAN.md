# PHASE 1 — Execution Plan

**Contract:** `runtime/contracts/PHASE1_development-contract.md`
**Status:** READY FOR EXECUTION
**Mode:** One-pass execution (all 6 deliverables in sequence), gated by `cargo build` success at the end.

---

## 0. Pre-Flight Checks

Before any code is written, verify the runtime tree exists and is empty of code:

```
runtime/
├── src-tauri/
│   ├── capabilities/    (empty, .gitkeep allowed)
│   ├── contracts/       (PHASE1_development-contract.md already written)
│   ├── icons/           (empty, .gitkeep allowed)
│   ├── src/             (empty, ready for code)
│   └── tests/           (empty, .gitkeep allowed)
├── docs/                (this file lives here)
├── tests/               (root-level integration tests, future)
├── contracts/           (constitutional documents, root of runtime)
└── archive/             (ARCHITECTURE_MAP.md archived here)
```

**Toolchain version:** `1.88.0` (pinned via `rust-toolchain.toml`).
**System command to verify before starting:**

```bash
rustc --version   # must report 1.88.0
cargo --version   # must report cargo 1.88.0
```

If the system rustc is not 1.88.0, the `rust-toolchain.toml` file will trigger `rustup` to install it on first `cargo` invocation. No manual install needed.

---

## 1. Protected System Boundary (Read This First)

**Before every file write in this plan, the executor MUST verify:**

1. The file path is inside `runtime/src-tauri/src/` (or a sibling that does not overlap with `src/`).
2. The file does NOT import from `../../src/`, `../src/`, or any TS source path.
3. The file does NOT contain the strings `authStore`, `supabase`, `agentService`, `useAgentHealth`, `useOversightChat`, or any other protected identifier.

**Enforcement gate (run at the end of Phase 1):**

```bash
# From runtime/src-tauri/
grep -r --include='*.rs' -E 'authStore|supabase|agentService|useAgentHealth|useOversightChat|instagram|workflow|queue' src/
# Expected: zero matches
```

If any match appears, the file is in violation of `DOMAIN_PRESERVATION_LAW_001` and MUST be removed/rewritten before Phase 1 is signed off.

---

## 2. Execution Sequence

The deliverables are executed in order A → B → C → D → E → F. Each step has a single, verifiable acceptance gate. If a gate fails, the next step is blocked.

---

### Step A — Tauri Workspace Skeleton

**Goal:** Create the Tauri build artifacts that make the project a valid Tauri app.

**Files to write:**

| File | Purpose |
|------|---------|
| `runtime/src-tauri/Cargo.toml` | Cargo manifest, pin Tauri v2, declare binary + library |
| `runtime/src-tauri/rust-toolchain.toml` | Pin `1.88.0` |
| `runtime/src-tauri/build.rs` | Tauri build script |
| `runtime/src-tauri/tauri.conf.json` | Tauri v2 config (product name, identifier, window defaults, capabilities) |
| `runtime/src-tauri/capabilities/default.json` | Empty/minimal capability set (no IPC exposed yet) |
| `runtime/src-tauri/icons/.gitkeep` | Placeholder so the directory exists |
| `runtime/src-tauri/src/lib.rs` | Re-export `bootstrap::runtime::Runtime` so `main.rs` can call into it |
| `runtime/src-tauri/src/main.rs` | Call `runtime::Runtime::boot()` (delegates to bootstrap) |

**Key Cargo.toml decisions:**

- `tauri = "2"` (Tauri v2 stable line)
- `tauri-build = "2"` (build dependency)
- `serde = { version = "1", features = ["derive"] }`
- `serde_json = "1"`
- `thiserror = "1"` (for the error framework)
- `tracing = "0.1"` (for the logging framework)
- `tracing-subscriber = { version = "0.3", features = ["env-filter", "json"] }`
- `[lib]` crate-type `["lib", "cdylib", "staticlib"]` (Tauri v2 standard)

**Key tauri.conf.json decisions:**

- `productName`: `"automation-kernel"` (neutral, not branded to preserve platform independence)
- `identifier`: `"com.systemic.runtime"`
- `windows`: single default window, no URL loaded yet (window is empty until Phase 7)
- `app.windows[0].label`: `"main"`

**Acceptance gate:**

```bash
cd runtime/src-tauri
cargo check
```

Expected: compilation succeeds. Note: the `Runtime::boot()` body is a stub in this step — just enough to typecheck. Full lifecycle comes in Step B.

---

### Step B — Runtime Entry Layer

**Goal:** Implement the bootstrap lifecycle. Runtime boots, logs, and shuts down cleanly.

**Files to write:**

| File | Responsibility |
|------|----------------|
| `src/bootstrap/runtime.rs` | `Runtime::boot()` — entry point, returns `RuntimeHandle` |
| `src/bootstrap/lifecycle.rs` | `Lifecycle` trait + `LifecyclePhase` enum (Init → Configure → Log → Window → Ready → Shutdown) |
| `src/bootstrap/startup.rs` | `Startup::run()` — orchestrates the boot phases in order |
| `src/bootstrap/shutdown.rs` | `Shutdown::run()` — orchestrates teardown in reverse order |

**Contract:**

- `Runtime::boot()` is the **only** function called from `main.rs`
- Each phase emits a structured log via `tracing::info!` with the required fields (timestamp, component, severity, event, correlation_id)
- A unique `correlation_id` is generated at boot (UUID v4) and threaded through every log in the session
- Shutdown is idempotent — calling it twice does not panic

**Acceptance gate:**

```bash
cd runtime/src-tauri
cargo run
```

Expected: app starts, prints structured lifecycle logs for each phase, window opens, process waits for user. On window close, shutdown logs emit, process exits 0.

---

### Step C — State Kernel

**Goal:** Define the four state containers with thread safety and serialization.

**Files to write:**

| File | Owns |
|------|------|
| `src/state/runtime_state.rs` | `RuntimeState { booted_at, correlation_id, phase }` |
| `src/state/window_state.rs` | `WindowState { window_id, title, dimensions, last_active_at }` |
| `src/state/settings_state.rs` | `SettingsState { theme, font_scale, window_prefs }` (desktop settings only, NOT user settings) |
| `src/state/session_state.rs` | `SessionState { session_id, started_at, view_metadata }` (window session, NOT auth session) |

**Contract:**

- Each state type derives `Debug, Clone, Serialize, Deserialize`
- Each is owned by `tauri::State<T>` (managed by Tauri)
- `runtime_state.rs` defines `pub struct AppState { runtime, window, settings, session }` (composite, also `Send + Sync`)
- `session_state.rs` **MUST NOT** have any field named `user_id`, `account_id`, `access_token`, or anything auth-shaped
- `settings_state.rs` **MUST NOT** import or reference the preserved TS settings modules

**Acceptance gate:**

```bash
cd runtime/src-tauri
cargo test
```

Expected: at minimum, a `state::runtime_state` test verifying `RuntimeState::default()` round-trips through `serde_json`. A `session_state` test verifying no auth fields exist (compile-time check via struct literal).

---

### Step D — Configuration Framework

**Goal:** Load, validate, and apply bootstrap configuration. Fail fast on bad config.

**Files to write:**

| File | Responsibility |
|------|----------------|
| `src/config/config.rs` | `Config` struct (deserialized from file/env), `RuntimeConfig`, `WindowConfig`, `LoggingConfig` |
| `src/config/environment.rs` | `Environment` enum (Dev, Staging, Prod), loaded from `RUNTIME_ENV` env var or default Dev |
| `src/config/validation.rs` | `validate(Config) -> Result<(), RuntimeError>` — invariant checks |
| `src/config/loader.rs` | `Loader::load() -> Result<Config, RuntimeError>` — reads from `runtime/config/{env}.toml` or env vars |

**Contract:**

- If `runtime/config/{env}.toml` is missing AND no env vars are set, default to `Dev` config
- If `validate` fails, return `RuntimeError::ConfigError` and the process exits 1 with a clear log line
- `Config` is read-only after `Loader::load()` returns
- Configuration does NOT contain any domain-shaped values (no Instagram API keys, no Supabase URLs, no agent endpoints)

**Acceptance gate:**

```bash
cd runtime/src-tauri
cargo test --lib config::
```

Expected: at least 3 tests — valid config loads, invalid config returns `ConfigError`, missing file falls back to defaults.

---

### Step E — Logging Framework

**Goal:** Structured logging with the required fields, plumbed into the bootstrap layer.

**Files to write:**

| File | Responsibility |
|------|----------------|
| `src/logging/logger.rs` | `Logger::init(Config) -> Result<(), RuntimeError>` — sets global `tracing` subscriber |
| `src/logging/sinks.rs` | `Sink` trait + `StdoutSink`, `FileSink` (writes to `runtime/logs/{correlation_id}.log`) |
| `src/logging/formatter.rs` | `Formatter` — produces the required fields: `timestamp`, `component`, `severity`, `event`, `correlation_id` |

**Contract:**

- Every log record MUST include all 5 required fields
- The `component` field is the module path that emitted the log (e.g., `bootstrap::startup`)
- The `severity` field is one of: `TRACE, DEBUG, INFO, WARN, ERROR`
- The `event` field is a stable, machine-readable identifier (e.g., `runtime.boot.phase.complete`)
- The `correlation_id` field is the per-boot UUID, propagated via `tracing::Span`

**Acceptance gate:**

```bash
cd runtime/src-tauri
cargo run
```

Expected: startup logs emit with all 5 fields present. Verify by tailing the log file or reading stdout JSON output.

---

### Step F — Error Framework

**Goal:** Define `RuntimeError` with all 11 variants, deterministic codes, and a `RuntimeResult<T>` alias.

**Files to write:**

| File | Responsibility |
|------|----------------|
| `src/error/runtime_error.rs` | `RuntimeError` enum, `impl Display`, `impl Error`, `impl RuntimeError { pub fn kind(&self) -> &'static str }` |
| `src/lib.rs` (extend) | Re-export `pub use error::runtime_error::{RuntimeError, RuntimeResult};` |

**Contract:**

```rust
pub enum RuntimeError {
    StartupError,
    ShutdownError,
    ConfigError,
    StateError,
    WindowError,
    IPCError,
    FilesystemError,
    PluginError,
    SerializationError,
    ObservabilityError,
    InternalRuntimeError,
}

impl RuntimeError {
    pub fn kind(&self) -> &'static str {
        match self {
            Self::StartupError => "RUNTIME_STARTUP_ERROR",
            Self::ShutdownError => "RUNTIME_SHUTDOWN_ERROR",
            Self::ConfigError => "RUNTIME_CONFIG_ERROR",
            Self::StateError => "RUNTIME_STATE_ERROR",
            Self::WindowError => "RUNTIME_WINDOW_ERROR",
            Self::IPCError => "RUNTIME_IPC_ERROR",
            Self::FilesystemError => "RUNTIME_FILESYSTEM_ERROR",
            Self::PluginError => "RUNTIME_PLUGIN_ERROR",
            Self::SerializationError => "RUNTIME_SERIALIZATION_ERROR",
            Self::ObservabilityError => "RUNTIME_OBSERVABILITY_ERROR",
            Self::InternalRuntimeError => "RUNTIME_INTERNAL_ERROR",
        }
    }
}
```

- All variants derive `thiserror::Error`
- `Display` impls are deterministic (no timestamps, no random IDs in the message)
- `From<serde_json::Error> for RuntimeError` maps to `SerializationError`
- `From<std::io::Error> for RuntimeError` maps to `FilesystemError`

**Acceptance gate:**

```bash
cd runtime/src-tauri
cargo test --lib error::
```

Expected: tests verify each variant has a unique `kind()` code, and the `From` conversions map correctly.

---

## 3. Final Verification (Phase 1 Sign-Off)

After all 6 steps pass, run the full verification suite:

```bash
cd runtime/src-tauri

# 1. Compilation
cargo build
# Expected: zero errors

# 2. Lints
cargo clippy --all-targets -- -D warnings
# Expected: zero warnings (or documented exceptions)

# 3. Tests
cargo test
# Expected: all pass

# 4. Package
cargo tauri build --debug
# Expected: bundles produced

# 5. Domain boundary check
grep -r --include='*.rs' -E 'authStore|supabase|agentService|useAgentHealth|useOversightChat|instagram|workflow|queue' src/
# Expected: zero matches

# 6. Toolchain pin
cat rust-toolchain.toml
# Expected: channel = "1.88.0"
```

**When all 6 checks pass, Phase 1 is complete. The execution plan is signed off. Subsequent phases may be authorized.**

---

## 4. What's NOT in This Plan

Explicitly out of scope for Phase 1:

- Loading the preserved TypeScript bundle into the WebView (Phase 7)
- IPC command definitions (Phase 2)
- Any Tauri command that touches `authStore` (Tier 0)
- Any Tauri command that touches `agentService` (Tier 1)
- Any page, route, layout, or component (Phase 7)
- Any design token, color, or theme (Phase 4)
- Any ASCII rendering (Phase 6)
- Any business observability integration (Phase 5)

If you find yourself writing any of the above, stop. You are out of Phase 1 scope.
