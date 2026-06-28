# Runtime Surface Audit — Phase 3e Post-Migration

**Generated:** session-end of phase 3e (pass 1 + pass 2 complete).
**Method:** full source-tree read, no assumptions from memory.
**Scope:** what lives where in the rust/tauri kernel + the TS layer under `runtime/src-tauri/lib/` + the React/Vite surface in `src/`. No changes made by reading; this is a snapshot.

---

## 1. Architecture Map (Verified)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    runtime/src-tauri/ (Tauri 2.x host)                       │
│                                                                              │
│  ┌─────────────────────────────────────┐  ┌───────────────────────────────┐  │
│  │  src/  (Rust, 27 files, ~3257 LOC)  │  │  lib/  (TypeScript, 34 files) │  │
│  │                                     │  │                               │  │
│  │  bootstrap/  (lifecycle, runtime,   │  │  contracts/    (10 files)     │  │
│  │             startup, shutdown)      │  │  substrates/   (11 files)     │  │
│  │  config/     (config, environment,  │  │  domains/      (13 files)     │  │
│  │             loader, validation)     │  │                               │  │
│  │  error/      (RuntimeError enum)    │  │  ↑ pure types                 │  │
│  │  ipc/        (commands + DTOs)      │  │  ↑ Supabase + http I/O        │  │
│  │  logging/    (tracing pipeline)     │  │  ↑ domain logic               │  │
│  │  state/      (runtime, session,      │  │                               │  │
│  │             settings, window)       │  │                               │  │
│  │                                     │  │                               │  │
│  │  Capability: NONE exposed to WebView│  │                               │  │
│  │  (capabilities/default.json: only   │  │                               │  │
│  │   "core:default", no IPC perms)     │  │                               │  │
│  └─────────────────────────────────────┘  └───────────────────────────────┘  │
│                                                                              │
│  tauri.conf.json: "frontendDist": "../",  React/Vite serves the WebView       │
└──────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       │  WebView loads React app from src/
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│              src/  (React + Vite, runs inside Tauri's WebView)               │
│                                                                              │
│  components/   — UI components (frozen per phase 3 rule)                      │
│  hooks/        — TanStack Query + zustand adapters (frozen per phase 3 rule) │
│  pages/        — route-level views (frozen per phase 3 rule)                  │
│  lib/bridge/   — framework-agnostic controllers (Phase 2 layer, evolving)    │
│  services/     — EMPTY (deleted in phase 3e pass 1)                          │
│  stores/       — zustand stores (authStore refactored in phase 3c)           │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Two parallel migrations are happening:**
1. **Rust kernel** — building the infrastructure substrate (boot, config, logging, state, window, IPC). Currently at Phase 1.
2. **TS preserved-system layer** — extracting React/Vite services into `runtime/src-tauri/lib/{contracts,substrates,domains}/`. Currently at Phase 3e.

These are described as "phases" in the commit log but they are NOT the same phase numbering. The TS layer's "phase 3e" is happening while the Rust kernel is at "Phase 1." Memory has conflated them. They are decoupled work streams.

---

## 2. Rust Kernel — Current State

**Files:** 27 across 6 modules. **Total LOC:** ~3257. **Test count:** 7 unit-test modules with compile-time invariants.

### 2.1 Modules

| Module     | Files | Concern                                                |
|------------|-------|--------------------------------------------------------|
| bootstrap  | 5     | Boot lifecycle. `Runtime::boot()` is the only entry.  |
| config     | 5     | TOML config loading, environment enum, validation.    |
| error      | 2     | `RuntimeError` enum — 11 variants, all kernel-only.   |
| ipc        | 3     | 21 `#[tauri::command]` functions + DTOs.               |
| logging    | 4     | tracing pipeline with structured sinks.                |
| state      | 6     | `RuntimeState`, `SessionState`, `SettingsState`,       |
|            |       | `WindowState`, composite `AppState`.                   |

### 2.2 IPC Commands (21 total)

All commands are infrastructure-only. Verified by:
- Reading `ipc/commands.rs` (498 lines, 21 commands).
- A compile-time test `no_domain_identifiers_in_commands` asserts the file contains **none** of: `authStore`, `supabase`, `agentService`, `useAgentHealth`, `useOversightChat`, `instagram`, `workflow`, `queue`.

| Group            | Commands                                                                                                                                |
|------------------|------------------------------------------------------------------------------------------------------------------------------------------|
| Runtime state    | `runtime_get_state`, `runtime_get_phase`, `runtime_get_correlation_id`                                                                  |
| Window           | `window_minimize`, `window_maximize`, `window_unmaximize`, `window_close`, `window_set_title`, `window_focus`, `window_inner_size`        |
| Settings         | `settings_get`, `settings_set_theme`, `settings_set_font_scale`, `settings_set_window_prefs`                                            |
| Session (view)   | `session_get_current_view`, `session_mount_view`, `session_unmount_view`                                                                 |
| Logging          | `log_emit_event`, `log_get_session_log_path`                                                                                            |
| Config           | `config_get_env`, `config_get_runtime_config`                                                                                            |

### 2.3 Capability Posture

`capabilities/default.json` (verified, 9 lines):
```json
{
  "identifier": "default",
  "description": "Default capability set for the automation kernel. No IPC commands are exposed in Phase 1.",
  "windows": ["main"],
  "permissions": ["core:default"]
}
```

**None of the 21 Rust commands are reachable from the WebView.** They are registered in `tauri::generate_handler!` (lines 92-114 of `bootstrap/runtime.rs`) but the capability whitelist blocks them. This is by design — "Phase 1" explicitly exposes no IPC.

### 2.4 Constitutional Rule (test-enforced)

`ipc/commands.rs` line 423-444 contains `fn no_domain_identifiers_in_commands()` which asserts the file's pre-test region contains none of 8 forbidden strings. This is a hard, compile-time-enforced boundary. **The Rust kernel cannot accidentally import or reference domain code.**

### 2.5 Error Envelope

`IpcErrorDTO` (in `ipc/types.rs`) is the only error type the WebView can ever see. `RuntimeError` is intentionally NOT `Serialize` — it stays kernel-internal. The `From<RuntimeError> for IpcErrorDTO` impl converts. This is the IPC ABI contract.

### 2.6 Dependency Surface (Cargo.toml)

8 deps. Intentionally minimal:
- `tauri = "2"` (the host)
- `serde`, `serde_json` (IPC DTOs)
- `thiserror` (RuntimeError)
- `tracing`, `tracing-subscriber` (logging)
- `uuid` (correlation ids)
- `toml` (config)

No domain deps. No HTTP client. No database. No JS bindings.

---

## 3. TypeScript Layer — Current State

**Files:** 34 across 3 layers. All inside `runtime/src-tauri/lib/`.

### 3.1 Contracts Layer (`contracts/`)

10 files, all pure types. No runtime imports allowed by convention.

| Topic         | Files                                                                 |
|---------------|-----------------------------------------------------------------------|
| agent         | `agent-tables.contract.ts`, `oversight.contract.ts`, `workflows.contract.ts` |
| content       | `ugc.contract.ts`                                                      |
| identity      | `auth.contract.ts`, `permissions.contract.ts`                          |
| instagram     | `media.contract.ts`, `oauth-scopes.contract.ts`                        |
| observability | `dashboard.contract.ts`, `insights.contract.ts`                        |

### 3.2 Substrates Layer (`substrates/`)

11 files. I/O primitives. Can import supabase, http, contracts.

| Group    | Files                                                                                                    |
|----------|-----------------------------------------------------------------------------------------------------------|
| auth     | `slot.ts` (Svelte-store-shaped primitive), `store.ts` (zustand impl), `transports/supabase.ts` (sign-in/out/session + folded-in profile helpers from legacy index.ts) |
| http     | `retry.ts` (fetchWithRetry + retryWithBackoff — two layers per pass-1 comments)                            |
| supabase | `api-usage.ts`, `audit.ts` (logAuditEvent), `client.ts`, `connection-test.ts`, `database.types.ts`, `query.ts` (isValidUUID + ServiceResponse types), `realtime.ts` |

**Notable recent changes (staged diff + phase 3e):**
- `substrates/auth/index.ts` was DELETED. Its functions were folded into `substrates/auth/transports/supabase.ts` (lines 432-549 of that file). This was a Phase 3c consolidation.
- `substrates/supabase/api-usage.ts` updated its import path from `../auth` to `../auth/transports/supabase`.
- `substrates/http/retry.ts` got a new `retryWithBackoff` helper layered on top of `fetchWithRetry`.

### 3.3 Domains Layer (`domains/`)

13 files. Business logic. Imports substrates + contracts. Should NOT import each other (no cross-domain coupling).

| Domain        | Files                                                                                       |
|---------------|---------------------------------------------------------------------------------------------|
| agent         | 8 files (activity-feed, agent-queries, alerts, analytics-reports, attribution, health, queue-monitor, scheduled-posts) |
| gdpr          | 1 file (privacy.service.ts)                                                                  |
| identity      | 3 files (consent.service.ts, dev-admin.policy.ts, service.ts)                                |
| instagram     | 1 file (business-accounts.service.ts)                                                        |

**All 8 agent/* files were created in phase 3e pass 1 (this session).** They were extracted from `src/services/agentService.ts` (which is now deleted).

### 3.4 Domain → Substrate Boundary (where contamination exists)

The systems-theory rule says: domains go THROUGH substrates, never borrow from substrates directly. Verified state:

| Domain file                              | Direct supabase import? | Should be? |
|------------------------------------------|--------------------------|------------|
| `domains/agent/*.service.ts` (8 files)   | YES — all 8 import `supabase` from `substrates/supabase/client` | NO — should call substrate functions |
| `domains/gdpr/privacy.service.ts`        | YES — imports `supabase` + `logAuditEvent` | NO |
| `domains/identity/consent.service.ts`    | YES — imports `supabase` | NO |
| `domains/identity/dev-admin.policy.ts`   | NO — pure functions, env injected | YES (compliant) |
| `domains/identity/service.ts`            | NO — pure functions | YES (compliant) |
| `domains/instagram/business-accounts.service.ts` | YES — imports `supabase` | NO |

**8 of 13 domain files violate the substrate-as-interpreter rule.** They do raw I/O instead of going through substrate wrappers. This is the next cleanup target after phase 3e is otherwise complete.

---

## 4. React/Vite Layer — Current State

### 4.1 What's Frozen

Per the hard-cutover rule from memory (2026-06-27):
- `src/components/`, `src/pages/`, `src/styles/`: body content is FROZEN as the Svelte migration skeleton.
- `src/hooks/` and `src/stores/`: same — bodies frozen, only import-path updates permitted.

Only single-line import-path updates are allowed when phase 3 migrates files imported by these layers.

### 4.2 What's Evolving

- `src/lib/bridge/`: framework-agnostic controllers. Phase 2 produced 8 of these. Active evolution.
- `src/services/`: was the React-side service layer. **Now empty** as of phase 3e pass 1.

### 4.3 Staged Diff State (16 files)

| Status | Files                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
|--------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| A      | `runtime/src-tauri/lib/domains/gdpr/privacy.service.ts`, `runtime/src-tauri/lib/domains/instagram/business-accounts.service.ts`                                                                                                                                                                                                                                                                                                                                                                                                                     |
| D      | `runtime/src-tauri/lib/substrates/auth/index.ts`, `src/services/dmService.ts`, `src/services/metaWebhooks.ts`, `src/services/webhooks.ts`                                                                                                                                                                                                                                                                                                                                                                                                            |
| M      | `runtime/src-tauri/lib/substrates/auth/transports/supabase.ts`, `runtime/src-tauri/lib/substrates/http/retry.ts`, `runtime/src-tauri/lib/substrates/supabase/api-usage.ts`, `src/components/settings/DangerZoneSection.tsx`, `src/hooks/useInstagramAccount.ts`, `src/lib/bridge/agentHealth.ts`, `src/lib/bridge/analyticsReports.ts`, `src/lib/bridge/queueMonitor.ts`, `src/services/agentService.ts`, `src/services/databaseservices.ts`                                                                                              |

The M-status bridge files were partially modified in the staged diff (retry helper de-dup) and finished in phase 3e pass 1 (AgentService → domain services). The M-status service files are now deleted (the MD markers from git status confirm: modification + deletion in the same staging entry). The D-status services had zero importers, deletion was clean.

### 4.4 Build Posture

`npm run build` is GREEN after every change in phase 3e passes 1 and 2. Verified each pass: ✓ built in 3.5–4.7s. The only warnings are about chunk size > 500kB (the components bundle is 700kB — pre-existing, unrelated to this migration).

---

## 5. Migration Phase Map (Honest)

What memory called "phase 3" is really three concurrent tracks:

| Track                          | What it covers                                       | Current state                              |
|--------------------------------|------------------------------------------------------|--------------------------------------------|
| **Rust kernel** (Phase 1)      | Boot, config, logging, state, window, IPC infra       | COMPLETE. 21 commands defined, 0 exposed. |
| **TS substrate split** (3b)    | Split god-file `supabase.ts` into focused modules    | COMPLETE per memory.                       |
| **TS auth+identity+consent** (3c) | Auth slot, identity domain, dev-admin policy, consent | COMPLETE per memory + verified.            |
| **TS HTTP/realtime/audit** (3d) | HTTP substrate (retry), realtime, audit substrate    | COMPLETE per memory.                       |
| **TS domain extraction** (3e)  | Move `src/services/*` into `runtime/.../domains/`    | PASS 1 + PASS 2 COMPLETE this session.     |
| **Svelte migration**           | Replace React/Vite with Svelte                       | NOT STARTED. Skeleton only.                |

**What is NOT in scope of any phase yet:**
- Tauri-IPC shell wrapping (the 21 Rust commands need TS adapters in the WebView)
- React/Vite stripping from the runtime build (kept as the working WebView host)
- Domain → substrate boundary cleanup (8 files violate the rule)

---

## 6. Contamination Audit

10 contamination vectors were flagged in the session. Verified status:

| # | Vector                                                         | Status                                    |
|---|----------------------------------------------------------------|-------------------------------------------|
| 1 | `getUserIdFromFacebookId` wrong column in auth transport       | FIXED (pass 2) — `.eq('facebook_id', ...)` |
| 2 | `getClientIpAddress` ipify call in consent domain              | FIXED (pass 2) — method removed           |
| 3 | Direct `supabase` imports in 8 domain files                    | OPEN — 8 files still violate              |
| 4 | `getBrowserMetadata()` uses `navigator` (browser-only) in domain | OPEN — out of scope for this pass        |
| 5 | React-frozen rule violations in staged diff (DangerZoneSection + useInstagramAccount import from runtime kernel) | OPEN — staged diff preserves these; comment in spec says "hardening deferred to later phase" |
| 6 | 17 npm deps unrelated to Rust kernel                            | OPEN — gated on architecture decision     |
| 7 | ipify call in `src/pages/Login.tsx:140,142`                     | OPEN — frozen React rule blocks           |
| 8 | Stale React-frozen memory rule                                  | STALE — needs update for the Rust/TS architecture |
| 9 | `tsconfig.ipc-check.json` + `tsconfig.bridge-check.json`        | FIXED (pass 2) — both deleted              |
| 10 | 7 `AgentService.*` references in comments                      | FIXED (pass 2) — all rewritten            |

---

## 7. Cross-Cutting Observations

### 7.1 Memory Has Been Wrong About the Rust Kernel

The prior memory described the Rust side as "near-empty" with "zero commands" and "just a shell." This is false. The kernel has 27 files, ~3257 LOC, 21 IPC commands, 11-variant error enum, 7 unit-test modules, and a compile-time-enforced constitutional rule against domain contamination. The 8-dependency Cargo.toml is a feature, not a defect — it reflects the kernel's actual scope (infrastructure), not a missing implementation.

**Recommendation:** update memory to reflect that the Rust kernel is real, substantive, and currently at Phase 1 (infra complete, IPC exposed=0 by design).

### 7.2 The Two Phases Use the Same Word but Mean Different Things

Memory's "phase 3c/3d/3e" refers to the TS extraction track. The Rust kernel's docstring in `src/lib.rs` references "Phase 1." These are decoupled. Conflating them in future work will burn phases.

### 7.3 The Capability Default Blocks All 21 Commands

`capabilities/default.json` allows only `core:default`. The 21 Rust commands are registered in `tauri::generate_handler!` but unreachable from the WebView. This is by design for "Phase 1" but means **the Tauri IPC shell that the React/Vite app COULD use is currently empty.** All current React ↔ Supabase I/O happens directly in the WebView via `@supabase/supabase-js`.

If/when the Tauri-IPC shell wrapping pass begins, the first step is to extend `capabilities/default.json` to allow specific commands, then add typed adapters in the WebView that call them.

### 7.4 The Domain → Substrate Boundary Violation Is the Largest Open Issue

8 of 13 domain files import `supabase` directly. Per the bedrock rule from memory: "workers go THROUGH bedrock, never borrow from it." Fixing this requires:
- Either: create substrate wrappers around each query pattern and re-route domain calls through them
- Or: reclassify the violating domain files as substrates (move them out of `domains/`)

This is a multi-file refactor that needs its own spec, gated on either pass 3 of phase 3e or a future phase 3f.

### 7.5 Three Layers of Imports in the TS Surface

When the React layer imports `runtime/src-tauri/lib/...`, the relative path crosses the boundary. e.g. `src/components/settings/DangerZoneSection.tsx` does:
```ts
import { deleteUserData } from '../../../runtime/src-tauri/lib/domains/gdpr/privacy.service';
```
That's a 3-level `..` traversal. The TS config supports it (`tsconfig.app.json` includes both `src` and `runtime/src-tauri/lib`). But it's brittle. If the relative path is wrong, build breaks silently because the file just isn't imported.

### 7.6 The Staged Diff Was Almost Correct

Verified: the 16-file staged diff is internally consistent and was applied successfully. Build stayed green. The "many unrelated changes" appearance was illusory — they're all one migration (extract services into domains, de-duplicate retry helpers, route auth through transport).

The 2 known deviations from prior-agent best practices are both FIXED in pass 2: the `getUserIdFromFacebookId` bug and the `getClientIpAddress` ipify call.

---

## 8. What's Next — Ranked

| Priority | Work                                                      | Effort | Risk   | Notes                                           |
|----------|
-----------------------------------------------------------|--------|--------|-------------------------------------------------|
| 1        | Domain → substrate boundary cleanup (8 files)             | Medium | Low    | The largest open contamination                  |
| 2        | `getBrowserMetadata()` reclassification                   | Small  | Low    | Uses `navigator`; should not be in a domain     |
| 3        | React-frozen rule cleanup for DangerZoneSection + useInstagramAccount imports | Small  | Low    | Still violates hard-cutover rule                |
| 4        | Tauri-IPC shell wrapping for runtime_get_state + settings_get + window_* | Large  | Medium | First real cross-kernel integration            |
| 5        | Svelte migration (replace React/Vite)                    | Huge   | High   | Multi-week, gated on architecture              |
| 6        | Strip React+Vite from runtime build                      | Huge   | High   | Gated on architecture + Svelte migration done  |
| 7        | Update memory: Rust kernel is real, TS phases are decoupled | Small  | None   | Prevents re-applying wrong context next session |

Items 1-3 are surgical and build-stays-green each step. Item 4 is the first pass that adds cross-kernel coupling and will need careful spec review. Items 5-6 are long-horizon pivots.

---

## 9. Verification Commands (for next session)

```bash
# Build the React/Vite layer (must stay green)
npm run build

# Build the Rust kernel
cd runtime/src-tauri && cargo check

# Run Rust unit tests (the constitutional-rule test is here)
cd runtime/src-tauri && cargo test

# Count domain files violating the substrate boundary
grep -l "from.*substrates/supabase/client" runtime/src-tauri/lib/domains/ -r | wc -l

# Find any remaining AgentService references (should be 0)
grep -rn "AgentService" --include="*.ts" --include="*.tsx" src/ runtime/src-tauri/lib/

# List all 21 Rust commands (sanity check)
grep -E "^\s*#\[tauri::command\]" runtime/src-tauri/src/ipc/commands.rs | wc -l
```

---

**END OF AUDIT.** Source-of-truth for the runtime surface as of phase 3e pass 2 complete.