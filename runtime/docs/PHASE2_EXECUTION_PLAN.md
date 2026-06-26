# PHASE 2 — Execution Plan

**Contract:** `runtime/contracts/PHASE2_development-contract.md`
**Status:** DRAFT — awaiting sign-off
**Mode:** Sequential with hard review gates between deliverables.
**No deletion in this phase.** Deletion is gated by a separate sign-off
document produced at the end of Phase 2.

---

## 0. Review Gates (the sequence you asked for)

Between each numbered step below, work pauses. The user reviews, signs off
(or sends back), and the next step begins.

```
Gate 1 ──► Step 1 (this plan)
Gate 2 ──► Step 2 (Deliverable G — Rust IPC commands)
Gate 3 ──► Step 3 (Deliverable H — Rust DTO types)
Gate 4 ──► Step 4 (Deliverable I — Svelte type stubs)
Gate 5 ──► Step 5 (Deliverable J — T1 controllers + hook refactors)
Gate 6 ──► Step 6 (Deletion Queue document — produced, NEVER executed)
```

Nothing past Gate 6 happens in Phase 2. Deletion belongs to Phase 7.

---

## 1. Pre-Flight Checks

Before any Phase 2 file is written, verify:

- Phase 1 is signed off (it is).
- `cargo check`, `cargo test --lib`, `cargo clippy --all-targets -- -D warnings`
  all pass from `runtime/src-tauri/`.
- `grep -r --include='*.rs' -E 'authStore|supabase|agentService|useAgentHealth|useOversightChat|instagram|workflow|queue' runtime/src-tauri/src/`
  returns zero matches.
- The preserved TypeScript layer (`src/`) still compiles under
  `tsc --noEmit` (we'll verify this at Gate 5 before refactoring hooks).

---

## 2. Execution Sequence

### Step 2 — Deliverable G: Rust IPC Command Registry

**Files to write:**

| File | Purpose |
|------|---------|
| `runtime/src-tauri/src/ipc/mod.rs` | Module declaration, error mapping, public re-exports |
| `runtime/src-tauri/src/ipc/commands.rs` | All 21 commands as `#[tauri::command]` functions |

**Tauri integration in `bootstrap/runtime.rs`:**

```rust
// Runtime::boot() — added .invoke_handler
.invoke_handler(tauri::generate_handler![
    ipc::commands::runtime_get_state,
    ipc::commands::runtime_get_phase,
    ipc::commands::runtime_get_correlation_id,
    ipc::commands::window_minimize,
    ipc::commands::window_maximize,
    ipc::commands::window_unmaximize,
    ipc::commands::window_close,
    ipc::commands::window_set_title,
    ipc::commands::window_focus,
    ipc::commands::window_inner_size,
    ipc::commands::settings_get,
    ipc::commands::settings_set_theme,
    ipc::commands::settings_set_font_scale,
    ipc::commands::settings_set_window_prefs,
    ipc::commands::session_get_current_view,
    ipc::commands::session_mount_view,
    ipc::commands::session_unmount_view,
    ipc::commands::log_emit_event,
    ipc::commands::log_get_session_log_path,
    ipc::commands::config_get_env,
    ipc::commands::config_get_runtime_config,
])
```

**Acceptance gate:**

```bash
cd runtime/src-tauri
cargo check
cargo test --lib ipc::
cargo clippy --all-targets -- -D warnings
```

Expected: 8 unit tests pass, zero warnings, zero domain references.

---

### Step 3 — Deliverable H: IPC Type Bridge (Rust DTOs)

**Files to write:**

| File | Purpose |
|------|---------|
| `runtime/src-tauri/src/ipc/types.rs` | All DTOs that flow across IPC. Serde derives only — no business types. |

**DTOs defined:**

```rust
RuntimeStateDTO   { phase, correlation_id, booted_at_epoch_secs }
PhaseDTO          (snake_case enum mirroring RuntimePhase)
SettingsStateDTO  { theme, font_scale, window_prefs }
ThemeDTO          (snake_case: system/light/dark)
WindowPrefsDTO    { start_maximized, remember_position }
ViewMetadataDTO   { view_id, mounted_at_epoch_secs }
EnvDTO            (snake_case: dev/staging/prod)
LogEmitDTO        { component, event, fields: HashMap<String,String> }
WindowSizeDTO     { width: u32, height: u32 }
```

**Conversion impls:**

Each DTO has `From<...>` and `TryFrom<...>` for its kernel-type equivalent.
The conversions are pure (no I/O, no error recovery beyond shape mismatch).

**Acceptance gate:**

```bash
cd runtime/src-tauri
cargo test --lib ipc::types
cargo clippy --all-targets -- -D warnings
```

Expected: 3 round-trip tests pass (DTO → kernel → DTO).

---

### Step 4 — Deliverable I: Svelte IPC Adapter Stubs

**Files to write (type-only, no runtime logic):**

| File | Exports |
|------|---------|
| `runtime/web/src/lib/ipc/runtime.ts` | `runtime.getState`, `.getPhase`, `.getCorrelationId` |
| `runtime/web/src/lib/ipc/window.ts` | `window.minimize`, `.maximize`, `.unmaximize`, `.close`, `.setTitle`, `.focus`, `.getInnerSize` |
| `runtime/web/src/lib/ipc/settings.ts` | `settings.get`, `.setTheme`, `.setFontScale`, `.setWindowPrefs` |
| `runtime/web/src/lib/ipc/session.ts` | `session.getCurrentView`, `.mountView`, `.unmountView` |
| `runtime/web/src/lib/ipc/log.ts` | `log.emitEvent`, `.getSessionLogPath` |
| `runtime/web/src/lib/ipc/config.ts` | `config.getEnv`, `.getRuntimeConfig` |
| `runtime/web/src/lib/ipc/index.ts` | Barrel re-export |
| `runtime/web/src/lib/ipc/__tests__/types.test-d.ts` | Type-level smoke test (compile-only) |

**All functions throw `Error('Tauri IPC not available (cmd=...)')` when
`window.__TAURI_INTERNALS__` is undefined.** This is the runtime fallback
for tests / non-Tauri environments. Phase 7 replaces the fallback with the
real `__TAURI_INTERNALS__.invoke` call.

**Note:** This directory lives in `runtime/web/` (Phase 7's home). Phase 2
creates the directory but does NOT set up Svelte/Vite tooling. The stubs
are plain `.ts` files. The Phase 7 prep adds the Svelte build pipeline.

**Acceptance gate:**

```bash
cd runtime/web
npx tsc --noEmit --strict src/lib/ipc/**/*.ts
```

Expected: zero errors. No runtime tests — stubs are inert.

---

### Step 5 — Deliverable J: T1 Controller Layer

**Files to write:**

| File | Purpose |
|------|---------|
| `src/lib/bridge/controller.ts` | `Controller<State>` interface + `createController<T>(initial)` helper |
| `src/lib/bridge/agentHealth.ts` | `createAgentHealthController(bizId)` — preserves 30s poll + Realtime on `system_alerts` |
| `src/lib/bridge/oversightChat.ts` | `createOversightChatController(bizId)` — preserves SSE wire + cleanup pattern + history persist |
| `src/lib/bridge/queueMonitor.ts` | `createQueueMonitorController()` — preserves 15s poll + 200-row fetch + DLQ derivation |
| `src/lib/bridge/analytics.ts` | `createAnalyticsController(bizId)` — preserves getAnalyticsReports + Realtime debounce |
| `src/lib/bridge/activityFeed.ts` | `createActivityFeedController()` — preserves audit_log query + Realtime INSERT |
| `src/lib/bridge/terminalKeyboard.ts` | `createTerminalKeyboardController()` — preserves Ctrl+C/L/ArrowUp/Down/Escape, localStorage history |

**Files to refactor (no behavior change):**

| File | Refactor |
|------|----------|
| `src/hooks/useAgentHealth.ts` | Re-implement as `useSyncExternalStore` over `createAgentHealthController`. Export `UseAgentHealthResult` and `LIVENESS_THRESHOLD_MS` unchanged. |
| `src/hooks/useOversightChat.ts` | Re-implement as `useSyncExternalStore` over `createOversightChatController`. Export `UseOversightChatResult` and `MAX_STREAM_DURATION_MS` unchanged. |
| `src/hooks/useQueueMonitor.ts` | Re-implement over `createQueueMonitorController`. |
| `src/hooks/useAnalyticsReports.ts` | Re-implement over `createAnalyticsController`. |
| `src/hooks/useActivityFeed.ts` | Re-implement over `createActivityFeedController`. |
| `src/hooks/useTerminalKeyboard.ts` | Re-implement over `createTerminalKeyboardController`. |

**Acceptance gate:**

```bash
cd src
npx tsc --noEmit --strict
npx vitest run src/lib/bridge/
```

Expected: 12 controller tests pass, 6 hook regression tests pass
(`useAgentHealth` consumers compile and produce same observable behavior).

**Behavior preservation check:**

```bash
# Byte-identical constants
grep -E '^export const POLL_INTERVAL_MS' src/hooks/useAgentHealth.ts
# Expected: 30_000
grep -E '^export const LIVENESS_THRESHOLD_MS' src/hooks/useAgentHealth.ts
# Expected: 25 * 60 * 1000
grep -E '^export const MAX_STREAM_DURATION_MS' src/hooks/useOversightChat.ts
# Expected: LIVENESS_THRESHOLD_MS * 5

# Same persistence keys
grep -r "localStorage\['terminal-command-history'\]" src/
grep -r "localStorage\['auth-storage'\]" src/
grep -r "sessionStorage\['pendingConsent'\]" src/

# Same SSE wire types
grep "text/event-stream" src/hooks/useOversightChat.ts
grep "X-Accel-Buffering" src/hooks/useOversightChat.ts
```

Expected: every grep returns its current hit pattern, unchanged.

---

### Step 6 — Deletion Queue Document (NOT executed)

**File to write:**

| File | Purpose |
|------|---------|
| `runtime/docs/PHASE2_DELETION_QUEUE.md` | List every file marked for deletion in Phase 7+, with rationale and the phase that owns the deletion. |

**Format:**

```markdown
# PHASE 2 — Deletion Queue (NOT EXECUTED)

This document lists files that Phase 2 identified as deletable in future
phases. **No file in this queue is deleted by Phase 2.** Each entry is
removed only when the phase that owns it executes that deletion and the
user signs off on the phase.

## Phase 7 candidates (UI migration target)

### Vite / React build artifacts
- `vite.config.ts` — replaced by `tauri.conf.json` `frontendDist`
- `index.html` — replaced by Tauri WebView HTML
- `src/main.tsx` — replaced by Svelte entry point
- `src/App.tsx` — replaced by Svelte App.svelte
- `tailwind.config.js` — replaced by T4 design tokens
- `postcss.config.js`, `src/index.css` — replaced by T4 CSS
- `public/*` — migrated to Tauri icons/assets

### React-only npm dependencies (drop in Phase 7 as last consumer migrates)
- `react`, `react-dom`
- `react-router-dom`
- `framer-motion`
- `lucide-react`
- `recharts`
- `react-hot-toast`
- `@tanstack/react-query` (replaced by Svelte stores + fetch)
- `zustand` (replaced by Svelte stores; `authStore.ts` itself is T0 and stays)
- `@radix-ui/*`
- `tailwind`, `autoprefixer`, `postcss`

### React components (delete as Svelte equivalent ships)
- `src/components/**/*.tsx` (90 files, T3)
- `src/pages/*.tsx` (19 files, T3)
- `src/contexts/ToastContext.tsx`, `src/contexts/ModalContext.tsx` (T2 contexts,
  replaced by Svelte equivalents)
- `src/hooks/useToast.ts`, `src/hooks/useModal.ts`, `src/hooks/usePageTransition.ts`
  (T2 bridges, replaced by Svelte equivalents)

### Build / deploy artifacts
- `Dockerfile` — only if backend is co-located in Tauri; otherwise UNCHANGED
- `nginx.conf` — only if static frontend is replaced; otherwise UNCHANGED
- `sw.js` — replaced by Tauri service worker (if needed)

## NEVER deleted (Tier 0/1/2)

| File | Why |
|------|-----|
| `src/stores/authStore.ts` | T0 |
| `src/lib/supabase.ts` | T0 |
| `src/lib/database.types.ts` | T0 |
| `src/types/index.ts` | T0 |
| `src/types/agent-tables.ts` | T0 |
| `src/types/oversight.ts` | T0 |
| `src/types/dashboard.ts` | T0 |
| `src/types/insights.ts` | T0 |
| `src/types/permissions.ts` | T0 |
| `src/types/instagram-media.ts` | T0 |
| `src/types/ugc.ts` | T0 |
| `src/types/workflows.ts` | T0 |
| `src/config/instagramScopes.ts` | T0 |
| `src/content/legalcontent.ts` | T3 but legal copy must survive |
| `src/styles/terminal.css` | T4 reference |
| `src/services/*.ts` | T2 |
| All `src/hooks/use*.ts` (the file objects stay — only the bodies are refactored) | T1 |
```

**Acceptance gate:** user signs off on the deletion queue. Phase 2 ends.

**Nothing in this queue is deleted by Phase 2.**

---

## 3. Final Verification (Phase 2 Sign-Off)

After Step 6 is signed off, run the full verification suite:

```bash
# 1. Rust kernel + IPC commands + types
cd runtime/src-tauri
cargo build
# Expected: zero errors

cargo clippy --all-targets -- -D warnings
# Expected: zero warnings

cargo test
# Expected: 38 (Phase 1) + 11 (Phase 2: 8 commands + 3 types) = 49 tests pass

# 2. Domain boundary (kernel)
grep -r --include='*.rs' -E 'authStore|supabase|agentService|useAgentHealth|useOversightChat|instagram|workflow|queue' src/
# Expected: zero matches

# 3. Domain boundary (IPC bridge — no leaking into kernel)
grep -r --include='*.ts' --include='*.tsx' "window\.__TAURI" src/ | grep -v "src/lib/bridge/"
# Expected: zero matches outside the bridge layer

# 4. TypeScript frontend
cd ..
npx tsc --noEmit
# Expected: zero errors

# 5. T1 contract preservation
grep "POLL_INTERVAL_MS = 30_000" src/hooks/useAgentHealth.ts
grep "LIVENESS_THRESHOLD_MS = 25 \* 60 \* 1000" src/hooks/useAgentHealth.ts
grep "MAX_STREAM_DURATION_MS = LIVENESS_THRESHOLD_MS \* 5" src/hooks/useOversightChat.ts
# Expected: all three return their current values

# 6. Toolchain pin
cat runtime/src-tauri/rust-toolchain.toml
# Expected: channel = "1.88.0"

# 7. Deletion queue document exists
ls runtime/docs/PHASE2_DELETION_QUEUE.md
```

**When all 7 checks pass, Phase 2 is complete. The deletion queue is signed
off but not executed. Phase 3 (Desktop Infra) may be authorized.**

---

## 4. What's NOT in This Plan

Explicitly out of scope for Phase 2:

- Migrating any T3 file from React to Svelte (Phase 7)
- Setting up the Svelte/Vite build pipeline (Phase 7)
- Building the observability shell, design tokens, ASCII panels (Phase 4/5/6)
- Removing any file from the deletion queue without amendment
- Touching any T0/T1/T2 file's contract (only refactor bodies)
- Authoring Phase 3, 4, 5, 6, or 7 contracts

If you find yourself writing any of the above, stop. You are out of Phase 2.
