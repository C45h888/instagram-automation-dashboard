# PHASE 3h — Move Bridge Controllers Into Kernel Tree (Execution Plan)

**Version:** 1.0
**Program:** Systemic Refactor Initiative
**Status:** DRAFT — awaiting user sign-off ("go")
**Parent Documents:**
- `.hermes/docs/PHASE3_EXECUTION_PLAN.md` (parent Phase 3 plan; 3h section is OUTDATED — this plan supersedes it)
- `runtime/docs/PHASE3f_EXECUTION_PLAN.md` (IPC adapter at src/lib/ipc/ — being relocated)
- `runtime/docs/PHASE3g_EXECUTION_PLAN.md` (Svelte shell — preserved)

---

## 1. Objective

Move all WebView-side TS code that integrates with the Rust kernel
into the kernel's TS tree at `runtime/src-tauri/lib/`. After this
pass, `src/lib/` contains ONLY the Svelte entry shell (`svelte/`) and
the entry `src/main.ts`. Everything else lives next to the Rust
source under `runtime/src-tauri/lib/`.

This collapses the "split runtime" the user identified: TS subordinate
to Rust, single TS tree inside the kernel, no parallel architecture.

**Single objective. Single verification. Single success: build green.**

---

## 2. Scope

### MOVED (preserved content, new location)

| From | To |
|---|---|
| `src/lib/bridge/activityFeed.ts` | `runtime/src-tauri/lib/controllers/agent/activity-feed.ts` |
| `src/lib/bridge/agentHealth.ts` | `runtime/src-tauri/lib/controllers/agent/health.ts` |
| `src/lib/bridge/analyticsReports.ts` | `runtime/src-tauri/lib/controllers/analytics/reports.ts` |
| `src/lib/bridge/contentAnalytics.ts` | `runtime/src-tauri/lib/controllers/analytics/content.ts` |
| `src/lib/bridge/controller.ts` | `runtime/src-tauri/lib/controllers/primitives/controller.ts` |
| `src/lib/bridge/oversightChat.ts` | `runtime/src-tauri/lib/controllers/oversight/chat.ts` |
| `src/lib/bridge/queueMonitor.ts` | `runtime/src-tauri/lib/controllers/queue/monitor.ts` |
| `src/lib/bridge/terminalKeyboard.ts` | `runtime/src-tauri/lib/controllers/terminal/keyboard.ts` |
| `src/lib/ipc/client.ts` | `runtime/src-tauri/lib/ipc/client.ts` |
| `src/lib/ipc/commands.ts` | `runtime/src-tauri/lib/ipc/commands.ts` |
| `src/lib/ipc/errors.ts` | `runtime/src-tauri/lib/ipc/errors.ts` |
| `src/lib/ipc/types.ts` | `runtime/src-tauri/lib/ipc/types.ts` |

### DELETED (overlap with relocated files)

| File | Reason |
|---|---|
| `src/lib/bridge/ipc.ts` | Replaced by `runtime/src-tauri/lib/ipc/commands.ts` (Phase 3f adapter is canonical) |
| `src/lib/bridge/ipc-errors.ts` | Replaced by `runtime/src-tauri/lib/ipc/errors.ts` |
| `src/lib/bridge/domains.ts` | Replaced by direct imports from `runtime/src-tauri/lib/domains/` (now in-tree, no relative path escape needed) |

### UNTOUCHED

- `src/main.ts` (WebView entrypoint — must stay at project root)
- `src/lib/svelte/` (Phase 3g Svelte shell — entry surface)
- `index.html` (Vite entry)
- `vite.config.ts`, `svelte.config.js`, `tsconfig.json`
- `runtime/src-tauri/` (Rust kernel)
- `runtime/src-tauri/lib/{contracts,domains,substrates}/` (15 mid-flight Phase 3e files — unstaged-mixed-diffs rule)
- `runtime/src-tauri/tauri.conf.json` (frontendDist still `../dist`, unchanged)

### NEW (index files for clean public surface)

| Path | Purpose |
|---|---|
| `runtime/src-tauri/lib/ipc/index.ts` | Re-exports `client`, `commands`, `errors`, `types` |
| `runtime/src-tauri/lib/controllers/index.ts` | Re-exports each controller group |

---

## 3. Path Normalization After Move

After relocation, relative import paths from the moved files to
existing kernel modules stay IDENTICAL because the depth is the same
(3 levels up to `runtime/src-tauri/lib/`). Example:

Before:
  `src/lib/bridge/activityFeed.ts`
    → `../../../runtime/src-tauri/lib/domains/agent/activity-feed.service`

After:
  `runtime/src-tauri/lib/controllers/agent/activity-feed.ts`
    → `../../domains/agent/activity-feed.service`  (2 levels up, in-tree)

All `../../../runtime/src-tauri/lib/...` import paths in the moved
controllers shorten to `../../...`. This is mechanical and verifiable.

The Svelte entry shell (`src/lib/svelte/App.svelte`) currently imports:

```typescript
import { runtimeGetCorrelationId, runtimeGetState } from '../ipc/commands';
import { IpcError, isTauriRuntime } from '../ipc/errors';
```

After move, those imports become:

```typescript
import { runtimeGetCorrelationId, runtimeGetState } from '../../../runtime/src-tauri/lib/ipc/commands';
import { IpcError, isTauriRuntime } from '../../../runtime/src-tauri/lib/ipc/errors';
```

(Uglier from the WebView's perspective, but it's the cost of the
relocation. The Svelte shell is the only file in `src/lib/` that
imports from the controller plane.)

---

## 4. Execution Sequence

### Pass 1 — IPC adapter relocation (4 files)

1. `git mv src/lib/ipc/client.ts  runtime/src-tauri/lib/ipc/client.ts`
2. `git mv src/lib/ipc/commands.ts runtime/src-tauri/lib/ipc/commands.ts`
3. `git mv src/lib/ipc/errors.ts  runtime/src-tauri/lib/ipc/errors.ts`
4. `git mv src/lib/ipc/types.ts   runtime/src-tauri/lib/ipc/types.ts`
5. Write `runtime/src-tauri/lib/ipc/index.ts` (barrel re-export).
6. Update `src/lib/svelte/App.svelte` import paths (3 lines).
7. Update `src/main.ts` if it imports from `../lib/ipc/...` (it doesn't — entry only mounts App.svelte).
8. Verify: `npm run build` GREEN.

### Pass 2 — Controllers relocation (8 files)

For each file:
1. `git mv src/lib/bridge/<x>.ts runtime/src-tauri/lib/controllers/<group>/<name>.ts`
2. Normalize internal `../../../runtime/src-tauri/lib/...` imports to `../../...`
3. Verify: `npx tsc --noEmit` zero errors before moving to the next file.

Order (smallest first to minimize blast radius on each failed step):
1. controller.ts → `controllers/primitives/controller.ts`
2. terminalKeyboard.ts → `controllers/terminal/keyboard.ts`
3. activityFeed.ts → `controllers/agent/activity-feed.ts`
4. queueMonitor.ts → `controllers/queue/monitor.ts`
5. analyticsReports.ts → `controllers/analytics/reports.ts`
6. contentAnalytics.ts → `controllers/analytics/content.ts`
7. agentHealth.ts → `controllers/agent/health.ts`
8. oversightChat.ts → `controllers/oversight/chat.ts`

Then:
9. Write `runtime/src-tauri/lib/controllers/index.ts` (barrel).
10. Verify: `npm run build` GREEN.

### Pass 3 — Overlap deletion (3 files)

1. Delete `src/lib/bridge/ipc.ts` (replaced by 3f adapter at new path).
2. Delete `src/lib/bridge/ipc-errors.ts` (replaced by 3f adapter).
3. Delete `src/lib/bridge/domains.ts` (now redundant — controllers import domains directly from in-tree path).
4. Verify: `git grep "bridge/ipc" src/ runtime/` → ZERO matches.
5. Verify: `git grep "bridge/domains" src/ runtime/` → ZERO matches.

### Pass 4 — Final verification

1. `npm run build` → GREEN.
2. `cargo test --manifest-path runtime/src-tauri/Cargo.toml --lib` → 53/53.
3. `find src/lib -type f` → only `svelte/App.svelte`, `svelte/app.css` (and any index files we add).
4. `find runtime/src-tauri/lib -type d` → `contracts/`, `controllers/`, `domains/`, `ipc/`, `substrates/`.
5. `git status --short` → only the move targets + new barrel files modified.

---

## 5. Invariants Preserved

- **Layer direction**: controllers → contracts/domains/substrates. No upward arrows.
- **Constitutional seam**: controllers use `runtime/src-tauri/lib/ipc/` (TS) which calls Tauri commands (Rust). Same seam as before, new location.
- **No data loss**: every file's content is preserved byte-for-byte (with import-path normalization).
- **15 mid-flight Phase 3e files in runtime/src-tauri/lib/{contracts,domains,substrates}/ UNTOUCHED**.
- **Build green at every pass boundary**.

---

## 6. Rollback

Each pass is `git mv` (rename tracked). If a pass fails:
- `git mv` is reversible via `git mv` back or `git checkout -- <path>`.
- New files (barrel `index.ts` files) are deletable.
- `git status --short` after each pass shows exactly what changed.

---

## 7. What This Plan Does NOT Do (explicit out-of-scope)

1. **No controller code changes.** Files move as-is (with import-path normalization).
2. **No domain code changes.** 15 mid-flight files stay untouched.
3. **No new domain UI.** The Svelte shell stays minimal.
4. **No commits.** Per "commits are user's job" rule.
5. **No further IPC commands.** The 21 IPC commands are Phase 2's contract.
6. **No replacement for the zustand substrate.** `runtime/src-tauri/lib/substrates/auth/store.ts` continues to use zustand.

---

## 8. Success Criteria

All of:
- `npm run build` GREEN
- `cargo test --lib` 53/53 GREEN
- `src/lib/` contains only `svelte/` (entry shell)
- `runtime/src-tauri/lib/` contains `contracts/`, `controllers/`, `domains/`, `ipc/`, `substrates/`
- No `bridge/` directory anywhere
- No path of form `runtime/web/` created
- The Svelte shell at `src/lib/svelte/App.svelte` still imports from the relocated IPC adapter and renders runtime state

---

## 9. Sign-off

This spec awaits your "go". Per protocol:
- Spec once → "go" → execute full plan → surface corrections.
- No per-step sign-off during execution.
- I will STOP at the first build/test failure and surface it.
