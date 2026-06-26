# PHASE 2 — IPC Constitutional Layer (Development Contract)

**Version:** 1.0
**Program:** Systemic Refactor Initiative
**Status:** DRAFT — awaiting sign-off
**Parent Documents:**

- `DOMAIN_PRESERVATION_LAW.md` (the four-tier system is non-negotiable)
- `PHASE1_development-contract.md` (runtime kernel — ✅ closed)
- `runtime/archive/ARCHITECTURE_MAP.md` (legacy architecture reference)

---

## 1. Mission

Establish the **infrastructure boundary** between the Rust runtime (Phase 1)
and the migrated Svelte frontend (Phase 7). Phase 2 does NOT migrate any T3
file. Phase 2 does NOT delete any legacy file. Phase 2 ONLY:

1. Defines what Tauri commands the Svelte side may invoke.
2. Defines the type bridge that flows across that boundary.
3. Lays down Svelte-side type stubs so Phase 7 has a contract to honour.
4. Refactors the six T1 hooks behind a UI-framework-agnostic controller
   interface so the same T1 contract powers both today's React and
   tomorrow's Svelte.

**The Rust kernel (Phase 1) and the preserved TypeScript backend (T0/T1/T2)
do not change in Phase 2.** They keep working. Phase 2 adds new capability
around them and prepares the surface for Phase 7 to migrate onto.

---

## 2. Constitutional Objective

Phase 2 establishes the **constitutional seam** — the single boundary in the
system where Rust infrastructure meets WebView UI. Everything above this seam
(UI, components, pages) is replaceable. Everything below it (auth, supabase,
agent hooks, queue contracts, services) is preserved.

```
┌─────────────────────────────────────────────────────────────┐
│  WebView (Svelte UI — migrated in Phase 7)                 │
│                                                              │
│  T3 components/pages ──► Svelte adapter ──┐                 │
│                                           │ invoke()        │
└───────────────────────────────────────────┼─────────────────┘
                                            │ ← PHASE 2 SEAM
┌───────────────────────────────────────────┼─────────────────┐
│  Tauri process (Rust — Phase 1 + 2)       │                 │
│                                           ▼                 │
│  IPC command registry (Deliverable G)                       │
│   ├─ runtime_*    (AppState inspection)                     │
│   ├─ window_*     (window management)                       │
│   ├─ settings_*   (desktop settings)                        │
│   ├─ session_*    (window session view)                     │
│   ├─ log_*        (observability)                           │
│   └─ config_*     (bootstrap config)                        │
│                                                              │
│  Runtime kernel (Phase 1 — closed)                          │
│   ├─ bootstrap (lifecycle)                                  │
│   ├─ state (RuntimeState, AppState)                         │
│   ├─ logging (tracing + FileSink)                           │
│   ├─ config (env loading + validation)                      │
│   └─ error (RuntimeError, RuntimeResult)                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘

       Preserved TypeScript backend (T0/T1/T2) — unchanged
       Inside the WebView. Talks to api.888intelligenceautomation.in
       over HTTPS. NEVER touches Rust.
```

**No T1 hook calls Rust.** No Rust command calls Supabase. The two are
completely independent. They share only the UI surface above them.

---

## 3. Domain Preservation Compliance

The DOMAIN_PRESERVATION_LAW (Law 001) is in force. Phase 2 is bound by
every preservation clause. Specifically:

| Tier | Phase 2 disposition |
|------|---------------------|
| **T0** — `authStore`, `supabase.ts`, `database.types.ts`, `types/*.ts`, `instagramScopes.ts` | **NOT TOUCHED.** No Rust command references any auth-shaped data. No Phase 2 file imports from `src/stores/`, `src/lib/supabase.ts`, or `src/lib/database.types.ts`. |
| **T1** — `useAgentHealth`, `useOversightChat`, `useQueueMonitor`, `useAnalyticsReports`, `useContentAnalytics`, `useActivityFeed`, `useAttributionQueue`, `useScheduledPosts`, `useTerminalKeyboard`, agentService queue/heartbeat methods | **NOT TOUCHED in implementation.** Phase 2 *wraps* these hooks behind a controller interface. The hook files are refactored to delegate to the controller; the contracts (polling intervals, SSE wire shapes, mutation signatures, persistence keys) are preserved verbatim. |
| **T2** — realtime hooks, contexts, bridge hooks, token hooks, instagram data hooks, service modules | **NOT TOUCHED.** |
| **T3** — pages, components, layouts | **NOT TOUCHED in Phase 2.** Phase 7 will migrate these to Svelte. |
| **T4** — design system | **NOT TOUCHED.** Phase 4. |

**Verification gate (run at end of Phase 2):**

```bash
# From runtime/src-tauri/
grep -r --include='*.rs' -E 'authStore|supabase|agentService|useAgentHealth|useOversightChat|instagram|workflow|queue' src/
# Expected: zero matches

# From src/
grep -r --include='*.ts' --include='*.tsx' -E 'invoke\(__TAURI__|window\.__TAURI__' . | grep -v src/lib/bridge/
# Expected: zero matches outside the bridge layer
```

---

## 4. What Phase 2 Owns

### 4.1 Rust Infrastructure Commands (Deliverable G)

The runtime kernel exposes these commands to the WebView:

| Command | Request | Response | Owner of the data |
|---------|---------|----------|-------------------|
| `runtime_get_state` | (none) | `RuntimeStateDTO` | `state::RuntimeState` |
| `runtime_get_phase` | (none) | `PhaseDTO` (`'cold' \| 'configuring' \| …`) | `state::RuntimePhase` |
| `runtime_get_correlation_id` | (none) | `String` (UUID v4) | `state::RuntimeState` |
| `window_minimize` | (none) | `()` | Tauri window |
| `window_maximize` | (none) | `()` | Tauri window |
| `window_unmaximize` | (none) | `()` | Tauri window |
| `window_close` | (none) | `()` | Tauri window |
| `window_set_title` | `title: String` | `()` | Tauri window |
| `window_focus` | (none) | `()` | Tauri window |
| `window_inner_size` | (none) | `{ width: u32, height: u32 }` | Tauri window |
| `settings_get` | (none) | `SettingsStateDTO` | `state::SettingsState` |
| `settings_set_theme` | `theme: ThemeDTO` | `()` | `state::SettingsState` |
| `settings_set_font_scale` | `scale: f32` | `()` (clamped to 0.5..=3.0) | `state::SettingsState` |
| `settings_set_window_prefs` | `prefs: WindowPrefsDTO` | `()` | `state::SettingsState` |
| `session_get_current_view` | (none) | `Option<ViewMetadataDTO>` | `state::SessionState` |
| `session_mount_view` | `view: ViewMetadataDTO` | `()` | `state::SessionState` |
| `session_unmount_view` | (none) | `()` | `state::SessionState` |
| `log_emit_event` | `event: LogEmitDTO` | `()` | `tracing` |
| `log_get_session_log_path` | (none) | `Option<String>` | `logging::Logger` |
| `config_get_env` | (none) | `EnvDTO` (`'dev' \| 'staging' \| 'prod'`) | `config::Environment` |
| `config_get_runtime_config` | (none) | `ConfigDTO` | `config::Config` |

**Total: 21 commands. All read or write state the Rust kernel already owns.**

### 4.2 What Phase 2 explicitly does NOT add

| Forbidden | Why |
|-----------|-----|
| Auth commands (login, logout, session) | T0 — preserved in TS |
| Supabase commands | T0 — preserved in TS |
| Agent heartbeat commands | T1 — preserved in TS |
| SSE/oversight commands | T1 — preserved in TS |
| Queue commands | T1 — preserved in TS |
| Instagram / Meta API commands | T2 — preserved in TS |
| Any command carrying a domain-shaped value | Constitutional violation |

---
## 5. The T1 Controller Layer (Deliverable J)

This is the most architecturally important deliverable. The six T1 hooks
currently in `src/hooks/` are bound to React via `useState`/`useEffect`/
`useQuery`. Phase 2 introduces a **UI-framework-agnostic controller** for
each, preserving the contract 100%.

### 5.1 Controller interface (universal)

```typescript
// src/lib/bridge/controller.ts (NEW — Phase 2)
export interface Controller<State> {
  /** Synchronous read of current state. */
  state(): State;
  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe(listener: (state: State) => void): () => void;
}
```

### 5.2 T1 controllers to build

| Controller | Source hook | State shape (preserved verbatim) |
|------------|-------------|----------------------------------|
| `createAgentHealthController` | `useAgentHealth` | `UseAgentHealthResult` (heartbeats, alerts, agentStatus, isLoading, error, resolveAlert, refetch) |
| `createOversightChatController` | `useOversightChat` | `UseOversightChatResult` (sessions, activeSession, messages, isStreaming, streamBuffer, error, startSession, sendMessage, selectSession, closeStream) |
| `createQueueMonitorController` | `useQueueMonitor` | `UseQueueMonitorResult` |
| `createAnalyticsController` | `useAnalyticsReports` + `useContentAnalytics` | Reports + content analytics state |
| `createActivityFeedController` | `useActivityFeed` | Audit log entries + Realtime |
| `createTerminalKeyboardController` | `useTerminalKeyboard` | Command history (localStorage backed, max 100) |

### 5.3 The hook refactor (preserved contracts)

After Phase 2, each T1 hook file becomes a thin React wrapper over its
controller. Example:

```typescript
// src/hooks/useAgentHealth.ts (refactored — contract unchanged)
import { useMemo, useSyncExternalStore } from 'react';
import { createAgentHealthController } from '@/lib/bridge/agentHealth';
import type { UseAgentHealthResult } from '@/types/agent-tables';

export const POLL_INTERVAL_MS = 30_000;
export const LIVENESS_THRESHOLD_MS = 25 * 60 * 1000;

export function useAgentHealth(businessAccountId?: string): UseAgentHealthResult {
  const controller = useMemo(
    () => createAgentHealthController(businessAccountId),
    [businessAccountId],
  );
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.state,
    controller.state,
  );
  return {
    ...state,
    resolveAlert: (id) => controller.resolveAlert(id),
    refetch: () => controller.refetch(),
  };
}
```

The exported symbols (state shape, polling constant, threshold constant)
are **byte-identical** to today. Consumers (`AgentTerminalDashboard`,
`useOversightChat` reading `LIVENESS_THRESHOLD_MS`) are unaffected.

### 5.4 What the controller does NOT do

- Does NOT change the polling interval (30s).
- Does NOT change the SSE wire shape (`text/event-stream`, double-newline split, type guards).
- Does NOT change persistence keys (`localStorage['terminal-command-history']`).
- Does NOT change Zod schemas (`OversightMessagesArraySchema`, `AgentHeartbeat`).
- Does NOT add or remove Supabase queries.
- Does NOT add or remove audit-log calls.

---

## 6. The Svelte IPC Stubs (Deliverable I)

Phase 2 does not build the Svelte app. It lays down type stubs at
`runtime/web/src/lib/ipc/` so Phase 7 has a contract to honour.

```typescript
// runtime/web/src/lib/ipc/runtime.ts (Phase 2 stub)
declare global {
  interface Window {
    __TAURI_INTERNALS__?: { invoke(cmd: string, args?: object): Promise<unknown> };
  }
}

function invoke<T>(cmd: string, args?: object): Promise<T> {
  return window.__TAURI_INTERNALS__?.invoke(cmd, args) as Promise<T>
    ?? Promise.reject(new Error(`Tauri IPC not available (cmd=${cmd})`));
}

export interface RuntimeStateDTO {
  phase: 'cold' | 'configuring' | 'logging' | 'window_init'
       | 'ready' | 'shutting_down' | 'stopped';
  correlation_id: string;
  booted_at_epoch_secs: number;
}

export const runtime = {
  getState: () => invoke<RuntimeStateDTO>('runtime_get_state'),
  getPhase: () => invoke<RuntimeStateDTO['phase']>('runtime_get_phase'),
  getCorrelationId: () => invoke<string>('runtime_get_correlation_id'),
};
```

**All 6 stubs are TYPE-ONLY — no business logic.** They exist to lock the
contract so Phase 7 cannot drift the type shapes without a Phase 2 amendment.

---

## 7. Deliverables Summary

| ID | Deliverable | Files | Tests |
|----|-------------|-------|-------|
| **G** | Rust IPC command registry | `runtime/src-tauri/src/ipc/commands.rs`, `runtime/src-tauri/src/ipc/mod.rs` | 8 unit tests |
| **H** | IPC type bridge (Rust DTOs) | `runtime/src-tauri/src/ipc/types.rs` | 3 round-trip tests |
| **I** | Svelte IPC adapter type stubs | `runtime/web/src/lib/ipc/{runtime,window,settings,session,log,config}.ts` | 0 (type-only) |
| **J** | T1 controller layer | `src/lib/bridge/{controller,agentHealth,oversightChat,queueMonitor,analytics,activityFeed,terminalKeyboard}.ts` + 6 hook refactors | 12 controller tests + 6 hook regression tests |

**Estimated total:** ~1,550 lines new, ~400 lines refactored (no behavior
change), 29 new tests.

---

## 8. Deletion Hold

**No files are deleted in Phase 2.** All deletion is deferred to the phase
that owns the migration of that concern:

| File category | Deleted in | Rationale |
|---------------|------------|-----------|
| `src/pages/*.tsx` | Phase 7 (page-by-page as Svelte replaces) | Migrate first, delete second |
| `src/components/**/*.tsx` | Phase 7 (component-by-component) | Migrate first, delete second |
| `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx` | Phase 7 final cut-over | Replaced by Tauri + Svelte entry point |
| `package.json` deps (`react`, `react-dom`, `framer-motion`, etc.) | Phase 7 (drop as last consumer migrates) | Stop using → drop dep |
| `src/stores/authStore.ts` | **NEVER** | T0 |
| `src/lib/supabase.ts` | **NEVER** | T0 |
| `src/lib/database.types.ts` | **NEVER** | T0 |
| `src/types/*.ts` | **NEVER** | T0 |
| `src/hooks/use*.ts` (T1 hooks) | **NEVER** | T1 contracts survive — only the binding changes |

**Phase 2 sign-off includes a deletion queue review.** Before any file is
deleted, the file must be in the deletion queue, the user must sign off,
and the queue is updated only by signed-off amendments.

---

## 9. Execution Sequence (with review gates)

```
Step 1  Write PHASE2_development-contract.md       ← this document
Step 2  Write PHASE2_EXECUTION_PLAN.md
        ⏸ REVIEW: User signs off on the plan
Step 3  Build Deliverable G (Rust IPC commands)
        ⏸ REVIEW: cargo check + cargo test pass
Step 4  Build Deliverable H (Rust DTO types)
        ⏸ REVIEW: cargo check + cargo test pass
Step 5  Build Deliverable I (Svelte stubs)
        ⏸ REVIEW: TypeScript compilation succeeds
Step 6  Build Deliverable J (T1 controllers + hook refactors)
        ⏸ REVIEW: existing hook consumers still pass typecheck,
                  contract invariants hold (POLL_INTERVAL_MS,
                  LIVENESS_THRESHOLD_MS, SSE wire types unchanged)
Step 7  ⏸ REVIEW: Deletion queue presented for sign-off.
                  Phase 2 ends here. No deletion happens
                  without explicit user authorization.
```

---

## 10. Completion Condition (Phase 2 Sign-Off)

Phase 2 is considered complete when:

- All four deliverables (G, H, I, J) exist and compile.
- `cargo check`, `cargo test`, `cargo clippy --all-targets -- -D warnings`
  pass with zero warnings.
- Domain boundary grep returns zero matches.
- T1 controller tests prove the polling interval, SSE wire shape, and
  persistence keys are byte-identical to the legacy hooks.
- Existing T1 hook consumers compile and pass typecheck against the
  refactored hooks.
- The deletion queue is documented in
  `runtime/docs/PHASE2_DELETION_QUEUE.md` and signed off by the user.

**No deletion happens before sign-off.** The deletion queue is reviewed
*before* it is executed, not after.

---

## 11. Cross-References

- **Constitutional authority:** `DOMAIN_PRESERVATION_LAW.md`
- **Phase 1 contract (closed):** `PHASE1_development-contract.md`
- **Phase 1 execution plan (closed):** `PHASE1_EXECUTION_PLAN.md`
- **Legacy architecture:** `runtime/archive/ARCHITECTURE_MAP.md`
- **Phase 3 (Desktop Infra):** not yet authored
- **Phase 7 (Application Shell):** not yet authored

---

## 12. Open Questions for Sign-Off

1. **Confirm Svelte is the Phase 7 framework** (you said yes — locked).
2. **Confirm controller layer lives in `src/lib/bridge/`** so both React
   and Svelte can use it during the transition period. Alternative is
   `runtime/web/src/lib/bridge/` — cleaner long-term but means a bigger
   upfront move.
3. **Confirm `useOversightChat` controller must support cancellation
   across remount** (Tauri hot-reload during dev would cause this).
   Default plan: yes. Confirm or override.
4. **Confirm no SSE passthrough through Rust** (Svelte reads SSE directly
   from `api.888intelligenceautomation.in` via `fetch`, same as React
   today). This is the simplest path. Alternative: Rust proxies SSE so
   the WebView doesn't hold the stream itself. Trade-off: simplicity
   vs. observability into the stream.
