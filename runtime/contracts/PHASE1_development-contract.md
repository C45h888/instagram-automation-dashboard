# PHASE 1 — Runtime Kernel Construction Program

**Version:** 1.0
**Program:** Systemic Refactor Initiative
**Status:** AUTHORIZED
**Parent Documents:**

- `DOMAIN_PRESERVATION_LAW_001`
- `SYSTEMIC_REFACTOR_PROGRAM_V1`

---

## 1. Mission

Construct the foundational Rust/Tauri runtime substrate that will eventually host the preserved TypeScript platform.

This contract does **NOT** authorize:

- frontend migration
- page migration
- route migration
- component migration
- business logic migration
- service migration

This contract **ONLY** authorizes construction of the runtime kernel.

---

## 2. Constitutional Objective

Create a stable desktop runtime capable of supporting future application layers while remaining completely independent of the existing frontend implementation.

The runtime kernel shall become the root execution substrate of the future platform.

No preserved systems may be modified.

---

## 3. Domain Preservation Compliance

The following systems are constitutionally protected and **SHALL NOT** be modified.

**Protected Systems:**

- `authStore`
- `supabase.ts`
- `database.types.ts`
- `agent-tables.ts`
- `oversight.ts`
- `agentService.ts`
- `useAgentHealth`
- `useOversightChat`
- all realtime hooks
- all workflow infrastructure

The runtime kernel shall be built **around** these systems.
The runtime kernel shall **not replace** these systems.

---

## 4. Runtime Authority Declaration

The Rust Runtime shall be classified as an **Infrastructure Runtime**.

**The Runtime owns:**

- Window Management
- Lifecycle Management
- IPC Infrastructure
- Configuration
- Logging
- Telemetry (within the runtime's own domain only)
- Filesystem Access
- Desktop Services
- Command Palette
- ASCII Rendering
- Observability Infrastructure

**The Runtime SHALL NOT own:**

- Authentication Logic
- Instagram Logic
- Workflow Logic
- Scheduling Logic
- Agent Logic
- Queue Logic
- Business Logic
- Database Logic

All domain concerns remain under the preserved TypeScript platform.
**The Runtime serves the platform. The platform does not serve the Runtime.**

---

## 5. Runtime Location

```
runtime/
├── src-tauri/
├── docs/
├── tests/
└── contracts/
```

The runtime kernel co-locates with the preserved TS platform in a monorepo.
The Rust runtime hosts a WebView; the preserved TypeScript runs inside it.

---

## 6. Toolchain Pinning

A pinned Rust toolchain **SHALL** be enforced via `rust-toolchain.toml`.

**Reason:** Deterministic builds, deterministic agent behaviour, deterministic CI.

```toml
# runtime/src-tauri/rust-toolchain.toml
[toolchain]
channel = "1.88.0"
components = ["rustfmt", "clippy"]
profile = "minimal"
```

The `stable` channel **SHALL NOT** be used. `stable != stable` six weeks from now.

---

## 7. Deliverables

### Deliverable A — Tauri Workspace

**Required Output:**

```
runtime/src-tauri/
├── Cargo.toml
├── tauri.conf.json
├── build.rs
├── rust-toolchain.toml
├── capabilities/
│   └── default.json
└── icons/
    └── .gitkeep
```

**Acceptance:**

- workspace builds
- workspace packages
- workspace launches

### Deliverable B — Runtime Entry Layer

**Required Output:**

```
runtime/src-tauri/src/
├── main.rs
└── bootstrap/
    ├── runtime.rs
    ├── lifecycle.rs
    ├── startup.rs
    └── shutdown.rs
```

**Responsibilities:**

- runtime initialization
- lifecycle registration
- startup sequencing
- shutdown sequencing

**Acceptance:**

- runtime boots
- runtime shuts down cleanly
- lifecycle logs emitted

### Deliverable C — State Kernel

**Required Output:**

```
runtime/src-tauri/src/state/
├── runtime_state.rs
├── window_state.rs
├── settings_state.rs
└── session_state.rs
```

**Responsibilities:**

- runtime state ownership
- window ownership
- configuration ownership
- window session ownership (NOT auth session)

**Constraints:**

- no business logic
- no domain logic
- no reference to auth, instagram, workflow, agent, queue

**Acceptance:**

- thread safe (`Send + Sync`)
- serializable
- test coverage present

### Deliverable D — Configuration Framework

**Required Output:**

```
runtime/src-tauri/src/config/
├── config.rs
├── environment.rs
├── validation.rs
└── loader.rs
```

**Responsibilities:**

- environment loading
- validation
- runtime configuration
- bootstrap configuration

**Acceptance:**

- invalid configs fail fast
- startup validation present

### Deliverable E — Logging Framework

**Required Output:**

```
runtime/src-tauri/src/logging/
├── logger.rs
├── sinks.rs
└── formatter.rs
```

**Requirements:** Structured logging only.

**Required fields:**

- `timestamp`
- `component`
- `severity`
- `event`
- `correlation_id`

**Acceptance:**

- startup logs emitted
- shutdown logs emitted
- runtime logs emitted

### Deliverable F — Error Framework

**Required Output:**

```
runtime/src-tauri/src/error/
└── runtime_error.rs
```

**Error Taxonomy — `RuntimeError` enum:**

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
```

**Constraints:**

- Runtime-level errors only
- No business logic
- No domain logic
- Each variant carries a deterministic, machine-readable code via `kind() -> &'static str`
- `Display` impls are deterministic and referenceable
- `pub type RuntimeResult<T> = Result<T, RuntimeError>` re-exported from `lib.rs`

**Acceptance:**

- all 11 variants defined
- `Result` alias exported
- zero domain references in the error module

---

## 8. Program Restrictions

The following systems are constitutionally protected:

- `authStore`
- `supabase.ts`
- `database.types.ts`
- `agent-tables.ts`
- `oversight.ts`
- `agentService.ts`
- `useAgentHealth`
- `useOversightChat`
- Realtime Hooks
- Workflow Infrastructure

These systems **SHALL NOT** be modified.
These systems **SHALL NOT** be rewritten.
These systems **SHALL NOT** be migrated.

**Adapters MAY be created.**
**Wrappers MAY be created.**
**Consumers MAY be replaced.**
**Core implementations SHALL remain intact.**

---

## 9. Completion Condition

The Phase 1 runtime kernel is considered complete when:

- `runtime/src-tauri/Cargo.toml` exists with pinned toolchain reference
- All 6 deliverable file sets exist and compile
- `cargo build` from `runtime/src-tauri/` succeeds with zero warnings (modulo upstream crate noise)
- `cargo test` runs the State Kernel test coverage
- The runtime boots, logs structured lifecycle events, and shuts down cleanly
- A grep over `runtime/src-tauri/src/` for `auth`, `instagram`, `workflow`, `agent`, `queue` returns **zero matches** (excluding allowed module names like `realtime` which is part of Tauri itself)

Only after Phase 1 completion may subsequent phases be authorized.

---

## 10. Cross-References

- **Constitutional Authority:** See `DOMAIN_PRESERVATION_LAW.md` (root) for the four-tier system.
- **Execution Plan:** See `runtime/docs/PHASE1_EXECUTION_PLAN.md` for the task-by-task breakdown.
- **Architectural Context (Archived):** See `runtime/archive/ARCHITECTURE_MAP.md` for the historical TS-only architecture map captured prior to runtime construction.
