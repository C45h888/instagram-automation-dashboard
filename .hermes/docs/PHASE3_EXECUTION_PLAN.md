# PHASE 3 — TS Runtime Reorganization (Execution Plan)

**Companion to:** `.hermes/docs/PHASE3_development-contract.md`
**Status:** DRAFT — awaiting sign-off
**Convention for every task:** `Move → Update importers in same commit → Delete legacy file. Verify build + tests + dependency direction. Commit. Sign off. Next sub-phase.`

---

## Overview — Sub-Phase Roll-Up

| Sub-phase | Scope | Files moved | New files | Risk | Est. commit count |
|---|---|---|---|---|---|
| **3a** | Contracts layer | 9 type files + 1 config | ~12 contract files | LOW (zero behavior change) | 1 PR |
| **3b** | Supabase substrate split | 3 files (supabase.ts split + database.types.ts + databaseservices.ts decompose) | ~7 substrate files | MEDIUM (god-file decomposition) | 1 PR (or 2 if decomposition needs staging) |
| **3c** | Auth + Identity | 1 file (authStore.ts split) + 1 service (consentService.ts) | ~9 files (4 substrate + 5 domain) | HIGH (auth is load-bearing) | 1 PR |
| **3d** | HTTP + Realtime + Telemetry + Meta substrates | 2 service files (webhooks.ts + metaWebhooks.ts) | ~6 substrate files | MEDIUM | 1 PR |
| **3e** | Domain services | 4 service files (agent, dm, plus the databaseservices.ts leftovers) | ~15 domain files | MEDIUM | 1 PR |
| **3f** | Projections | 0 (extracts pure functions from bridge files) | ~8 projection files | LOW | 1 PR |
| **3g** | Controllers | 7 bridge files split + 1 hook (realtimedata.ts) | ~21 controller files | MEDIUM (touches 7 React hook imports) | 1 PR |
| **3h** | Bridge folder move | 8 bridge files | 8 files at new path | LOW (mechanical) | 1 PR |
| **3i** | Legal content | 1 file | 1 file | LOW | 1 PR |

**Total: 9 sub-phases, 9 PRs, gated.** The sub-phases are sequenced so each builds only on what's already moved. Skipping ahead causes dependency-direction violations at the verification gate.

**Cross-cutting infrastructure (authored in 3a, used by every sub-phase):**
- `runtime/scripts/verify-phase3.sh` — the dependency-direction gate. Runs at the end of every sub-phase.
- `runtime/scripts/scan-move.sh <old-path> <new-path>` — scans every importer of the old path, updates imports to the new path atomically. Used by sub-phases that have many importers.

---

## SUB-PHASE 3a — Contracts Layer

**Goal:** Every type in `src/types/` and the one config file `src/config/instagramScopes.ts` move into the contracts layer. Zero behavior change.

**Why first:** Contracts are the foundation. Every later sub-phase imports from `contracts/` instead of `src/types/`. Doing this first means later sub-phases move files to homes that already have their contract types.

**Files moved:**

| From | To |
|---|---|
| `src/types/agent-tables.ts` | `runtime/web/src/lib/contracts/agent/agent-tables.contract.ts` |
| `src/types/workflows.ts` | `runtime/web/src/lib/contracts/agent/workflows.contract.ts` |
| `src/types/oversight.ts` | `runtime/web/src/lib/contracts/agent/oversight.contract.ts` |
| `src/types/dashboard.ts` | `runtime/web/src/lib/contracts/observability/dashboard.contract.ts` |
| `src/types/insights.ts` | `runtime/web/src/lib/contracts/observability/insights.contract.ts` |
| `src/types/instagram-media.ts` | `runtime/web/src/lib/contracts/instagram/media.contract.ts` |
| `src/types/permissions.ts` | `runtime/web/src/lib/contracts/identity/permissions.contract.ts` |
| `src/types/ugc.ts` | `runtime/web/src/lib/contracts/content/ugc.contract.ts` |
| `src/config/instagramScopes.ts` | `runtime/web/src/lib/contracts/instagram/oauth-scopes.contract.ts` |
| `src/types/index.ts` | DELETED (barrel replaced by per-contract imports) |

**Tasks (TDD per task):**

### Task 3a.1: Move agent-tables
- **Step 1:** Read `src/types/agent-tables.ts` (559 lines). Identify the Zod schemas and the row type aliases.
- **Step 2:** Write `runtime/web/src/lib/contracts/agent/agent-tables.contract.ts` with identical content. Update internal `import type { Database } from '../lib/database.types'` to `import type { Database } from '../../substrates/supabase/database.types'` (DOES NOT EXIST YET — keep the import pointing at the old path for now, fix in 3b).
  - Actually: keep the import path as-is for 3a. 3b will move `database.types.ts` and we update then. This is the ONE exception to "update all importers in the same commit" — and it's allowed because the import target hasn't moved yet.
- **Step 3:** Run `runtime/scripts/scan-move.sh src/types/agent-tables.ts runtime/web/src/lib/contracts/agent/agent-tables.contract.ts` to find every importer.
- **Step 4:** Update every importer (`src/hooks/useAgentHealth.ts`, `src/services/agentService.ts`, `src/lib/bridge/agentHealth.ts`, etc.) to the new path.
- **Step 5:** Delete `src/types/agent-tables.ts`.
- **Step 6:** Verify: `npx tsc --noEmit -p tsconfig.json` zero errors. `git grep src/types/agent-tables` zero matches.
- **Step 7:** Commit: `feat(phase3a): move types/agent-tables.ts → contracts/agent/agent-tables.contract.ts`.

### Task 3a.2 through 3a.9: Repeat for each file in the table above
Same TDD pattern per task. One commit per file. Eight commits total for the type moves, plus one commit for the config move, plus one commit for deleting `src/types/index.ts`.

**Verification gate (end of 3a):**
- `src/types/` contains only `index.ts` (which is then deleted in the final task).
- `git grep "from ['\"].*types/" runtime/web/src/lib/` returns matches only inside `contracts/` (because contracts import from substrates).
- `git grep "from ['\"].*types/" src/` returns matches in `src/hooks/`, `src/services/`, `src/lib/`, `src/components/`, `src/pages/` — every non-frozen consumer has been updated.
- `npm run build` passes.
- All existing tests pass.

**Sign-off gate:** ⏸ Wait for user "go" before 3b begins.

---

## SUB-PHASE 3b — Supabase Substrate Split

**Goal:** The 500-line `src/lib/supabase.ts` god-file is split into focused substrate files. `database.types.ts` moves. `databaseservices.ts` (843 lines of generic Supabase helpers) decomposes.

**Why second:** Every domain service (3e) and every controller (3g) imports from `supabase.ts` and/or `databaseservices.ts`. Splitting these first means the later moves have substrate primitives to import.

**Files split / moved:**

| From | To |
|---|---|
| `src/lib/supabase.ts` lines 60–149 (client + custom fetch) | `runtime/web/src/lib/substrates/supabase/client.ts` |
| `src/lib/supabase.ts` lines 86–117 (fetchWithRetry) | `runtime/web/src/lib/substrates/http/retry.ts` (canonical retry — eliminates the 5+ duplicates in bridge files later) |
| `src/lib/supabase.ts` lines 204–235 (audit log writer) | `runtime/web/src/lib/substrates/supabase/audit.ts` |
| `src/lib/supabase.ts` lines 240–261, 263–277, 362–387, 434–476, 482–492 (session + profile + role + facebook-id mapping + type guards) | `runtime/web/src/lib/substrates/auth/index.ts` (the part that doesn't belong in identity — see 3c) |
| `src/lib/supabase.ts` lines 284–334, 336–356 (realtime subscription primitives) | `runtime/web/src/lib/substrates/supabase/realtime.ts` |
| `src/lib/supabase.ts` lines 155–198 (testSupabaseConnection) | `runtime/web/src/lib/substrates/supabase/connection-test.ts` |
| `src/lib/supabase.ts` lines 390–424 (api usage logging) | `runtime/web/src/lib/substrates/supabase/api-usage.ts` |
| `src/lib/database.types.ts` | `runtime/web/src/lib/substrates/supabase/database.types.ts` |
| `src/services/databaseservices.ts` (843 lines) | decomposed — see Task 3b.5 |

**Tasks (TDD per task):**

### Task 3b.1: Move retry primitive to `substrates/http/retry.ts`
- **Step 1:** Read `src/lib/supabase.ts:86-117` (the local `fetchWithRetry`).
- **Step 2:** Write `runtime/web/src/lib/substrates/http/retry.ts` with the same implementation, typed as `fetchWithRetry(url, options, retryConfig?) => Promise<Response>`. Export `RetryConfig`, `MAX_RETRIES`, `INITIAL_DELAY_MS` as named exports.
- **Step 3:** Update `substrates/supabase/client.ts` to import from this file instead of defining `fetchWithRetry` locally.
- **Step 4:** Update the bridge files that have their own `fetchWithRetry` (`agentHealth.ts:81-116`, `analyticsReports.ts:66-`, `queueMonitor.ts:75-`): for 3b, just leave them alone — 3g will collapse them. For 3b itself: no bridge changes.
- **Step 5:** Verify: `npx tsc --noEmit` zero errors. The local `fetchWithRetry` in supabase.ts is gone; the new one in `substrates/http/retry.ts` is the only definition.

### Task 3b.2: Split `supabase.ts` client construction → `substrates/supabase/client.ts`
- Lines 60–149 of `supabase.ts` become `substrates/supabase/client.ts`.
- Exports: `supabase` (the singleton), `ConnectionTestResult` (moved to `connection-test.ts`).
- Update `authStore.ts`, `agentService.ts`, `consentService.ts`, `databaseservices.ts`, `bridge/*`, every hook that imports `from '../lib/supabase'` to import from `substrates/supabase/client`.

### Task 3b.3: Move audit + api-usage + connection-test + realtime
Four new substrate files, one per concern. Each takes its section of `supabase.ts` verbatim. Each is imported by every consumer of that section.

### Task 3b.4: Move `database.types.ts`
- Read `src/lib/database.types.ts` (it's generated by `npm run db:types`).
- Move to `runtime/web/src/lib/substrates/supabase/database.types.ts` verbatim (it's a generated file, do not edit).
- Update `package.json` script `db:types` to write to the new path.
- Update every consumer.

### Task 3b.5: Decompose `databaseservices.ts`
This is the hardest task in 3b. `databaseservices.ts` has ~30 static methods, each querying one Supabase table. The decomposition:

For each method:
- Identify which table it queries and which contract type it returns.
- If the method is a domain service in disguise (e.g. `getAgentHeartbeats` already has a counterpart in `agentService.ts`), delete it from `databaseservices.ts` and confirm `agentService.ts` is the canonical home.
- If the method is a generic helper (UUID guard, raw `from(table).select()` builder), move it to `substrates/supabase/query.ts`.
- If the method's domain home is ambiguous, document it in `runtime/docs/PHASE3_FOLLOWUP_QUEUE.md` (a new doc, follows the deletion-queue pattern but for ambiguous decomposition, not deletion).

Deliverables:
- `runtime/web/src/lib/substrates/supabase/query.ts` — generic helpers only.
- `runtime/docs/PHASE3_FOLLOWUP_QUEUE.md` — every method whose home is ambiguous.
- `src/services/databaseservices.ts` deleted.

**Verification gate (end of 3b):**
- `src/lib/supabase.ts` does not exist. `src/lib/database.types.ts` does not exist. `src/services/databaseservices.ts` does not exist.
- `git grep "from ['\"].*lib/supabase" src/ runtime/web/src/` returns zero matches.
- `git grep "from ['\"].*services/databaseservices" src/ runtime/web/src/` returns zero matches.
- `runtime/scripts/verify-phase3.sh` returns zero violations.
- `npm run build` passes.
- All existing tests pass.

**Sign-off gate:** ⏸

---

## SUB-PHASE 3c — Auth + Identity

**Goal:** `authStore.ts` (848 lines) splits per D3. `consentService.ts` moves into `domains/identity/`.

**Why third:** Auth is load-bearing. The order is: get the Supabase substrate clean (3b), then split auth so it can use the clean substrate, then everything downstream (controllers, UI) can call into the new auth/identity split.

**Files split / moved:**

| From | To |
|---|---|
| `src/stores/authStore.ts` substrate-half (signInWithEmail transport, session, refresh, audit log emission) | `runtime/web/src/lib/substrates/auth/transports/supabase.ts` |
| `src/stores/authStore.ts` business-half (role hierarchy, business account binding, permission derivation) | `runtime/web/src/lib/domains/identity/service.ts` |
| `src/stores/authStore.ts` reactive state slot (Zustand store internals) | `runtime/web/src/lib/substrates/auth/store.ts` (zustand-free primitive; the React adapter in `src/stores/authStore.ts` becomes a thin wrapper) |
| `src/services/consentService.ts` | `runtime/web/src/lib/domains/identity/consent.service.ts` |

**The split boundary (per D3):**

`substrates/auth/` owns:
- `signInWithEmail` transport (the actual `supabase.auth.signInWithPassword` call)
- `signOut` transport
- `getCurrentSession` / `getCurrentUser` / session refresh
- The Zustand store wrapper (state shape lives here; UI bindings stay in `src/stores/authStore.ts`)

`domains/identity/` owns:
- The role hierarchy (`'user' < 'admin' < 'super_admin'`).
- `mapToUser` (the supabase → app user projection).
- `getPermissions` (the permission-array derivation policy).
- `signInAsAdmin` (which composes substrate auth + identity role check).
- `setBusinessAccount` (business account binding logic).
- `checkAdminAccess` policy.
- `consentService` operations.

**Tasks:**

### Task 3c.1: Extract `substrates/auth/transports/supabase.ts`
- Move the sign-in/sign-out/session-refresh logic.
- Tests: existing tests that mock `supabase.auth.*` must still pass; new tests verify the substrate doesn't depend on identity.

### Task 3c.2: Extract `domains/identity/service.ts`
- Move `mapToUser`, `getPermissions`, `formatUsername`, `getUsernameFromEmail`, `signInAsAdmin` logic, `setBusinessAccount`, `checkAdminAccess`.
- Tests: identity domain tests don't mock Supabase — they take a User object and produce the right identity view.

### Task 3c.3: Split `authStore.ts` into a thin React adapter
- `src/stores/authStore.ts` becomes a `useAuthStore` hook that's ~50 lines: imports the substrate store + identity service, exposes them through `useAuthStore()`.
- The React file imports from the new homes.
- Delete the legacy 848-line file content.

### Task 3c.4: Move `consentService.ts` → `domains/identity/consent.service.ts`
- Mechanical move. Update `substrates/supabase/client` import path.
- Update the one or two consumers (`src/pages/PrivacyDashboard.tsx`, `src/pages/DataDeletion.tsx` — but those are in the FROZEN scope, so the consumer updates must come through the new contract path).

**Verification gate (end of 3c):**
- `src/stores/authStore.ts` is a thin React adapter (~50 lines).
- `runtime/web/src/lib/substrates/auth/` contains substrate code only.
- `runtime/web/src/lib/domains/identity/` contains identity-domain code only.
- `runtime/scripts/verify-phase3.sh` returns zero violations — specifically: `grep -r "from '.*domains/identity" runtime/web/src/lib/substrates/` returns zero matches.
- `npm run build` passes.
- Auth flow tested manually: sign-in works, role check works, business account binding works, sign-out works.

**Sign-off gate:** ⏸

---

## SUB-PHASE 3d — HTTP, Realtime, Telemetry, Meta Substrates

**Goal:** Generic primitives extracted into dedicated substrate modules. Webhook adapters moved.

**Files split / moved:**

| From | To |
|---|---|
| The inline `supabase.channel().on(...)` chains in `bridge/*` | `runtime/web/src/lib/substrates/supabase/realtime.ts` (already created in 3b; 3d refines the API based on what the controllers actually need) |
| `src/services/metaWebhooks.ts` (424 lines) | `runtime/web/src/lib/substrates/meta/webhooks.ts` |
| `src/services/webhooks.ts` (237 lines) | `runtime/web/src/lib/substrates/meta/webhooks-internal.ts` |
| (no source) | `runtime/web/src/lib/substrates/telemetry/index.ts` — new, exports a typed telemetry emitter |

**Tasks:**

### Task 3d.1: Refine the realtime substrate API
- Read every `supabase.channel(...).on(...)` chain in `src/lib/bridge/*.ts` and `src/hooks/realtimedata.ts`.
- Define `substrates/supabase/realtime.ts`'s API to support all of them: `subscribeToTable(table, callback, filter?)` already exists in the original supabase.ts — 3b moved it. 3d verifies it covers every use case or extends it.

### Task 3d.2: Move `metaWebhooks.ts` and `webhooks.ts`
- Mechanical moves. Update imports.

### Task 3d.3: Author `substrates/telemetry/index.ts`
- Read the audit-log calls scattered across the codebase (`logAuditEvent` in `authStore.ts:394`, `logApiRequest` in `supabase.ts:390-424`).
- Consolidate into one telemetry substrate. The existing `audit.ts` and `api-usage.ts` from 3b become the two adapters.

**Verification gate (end of 3d):**
- All webhook code lives under `substrates/meta/`.
- The realtime substrate's API is documented in a header comment.
- Telemetry substrate exports a typed emitter.
- `runtime/scripts/verify-phase3.sh` zero violations.

**Sign-off gate:** ⏸

---

## SUB-PHASE 3e — Domain Services

**Goal:** Every `src/services/*.ts` (except those already moved in 3b/3c/3d) lands in its domain home.

**Files moved:**

| From | To |
|---|---|
| `src/services/agentService.ts` | `runtime/web/src/lib/domains/agent/service.ts` |
| `src/services/dmService.ts` | `runtime/web/src/lib/domains/dm/service.ts` |
| (the React hooks that are actually business logic, not React adapters — see §5.3 of the contract) | various `domains/<x>/` homes |
| `src/hooks/useAttributionQueue.ts` | `runtime/web/src/lib/domains/agent/attribution.ts` (business logic) + a thin React adapter stays in `src/hooks/useAttributionQueue.ts` |
| `src/hooks/useComments.ts` | `runtime/web/src/lib/domains/comments/hooks.ts` |
| `src/hooks/useDMInbox.ts` | `runtime/web/src/lib/domains/dm/hooks.ts` |
| `src/hooks/useInstagramAccount.ts` | `runtime/web/src/lib/domains/instagram/account.hooks.ts` |
| `src/hooks/useInstagramInsights.tsx` | `runtime/web/src/lib/domains/instagram/insights.hooks.ts` |
| `src/hooks/useInstagramProfile.ts` | `runtime/web/src/lib/domains/instagram/profile.hooks.ts` |
| `src/hooks/useScheduledPosts.ts` | `runtime/web/src/lib/domains/content/scheduled-posts.hooks.ts` |
| `src/hooks/useTokenStatus.ts` | `runtime/web/src/lib/domains/identity/token-status.hooks.ts` |
| `src/hooks/useTokenValidation.ts` | `runtime/web/src/lib/domains/identity/token-validation.hooks.ts` |
| `src/hooks/useVisitorPosts.ts` | `runtime/web/src/lib/domains/instagram/visitor-posts.hooks.ts` |
| `src/hooks/useWorkflowExecutions.ts` | `runtime/web/src/lib/domains/content/workflow-executions.hooks.ts` |
| `src/hooks/useModal.ts` | `runtime/web/src/lib/domains/ui-prompts/modal.hooks.ts` (state stays in `domains/ui-prompts/modal-store.ts`) |
| `src/hooks/useToast.ts` | `runtime/web/src/lib/domains/ui-prompts/toast.hooks.ts` (state stays in `domains/ui-prompts/toast-store.ts`) |
| `src/contexts/ModalContext.tsx` (logic portion) | `runtime/web/src/lib/domains/ui-prompts/modal-store.ts` |
| `src/contexts/ToastContext.tsx` (logic portion) | `runtime/web/src/lib/domains/ui-prompts/toast-store.ts` |

**The split rule (per §5.3 of the contract):** If a `src/hooks/use<X>.ts` file is a thin wrapper over a controller (calls `use<X>` returning the controller's `state()` plus actions), it stays in `src/hooks/` and updates its import paths. If the file contains business logic (calls `supabase.from(...)`, computes derived values, owns a useEffect that does domain work), the business logic moves to `domains/<x>/hooks.ts` and the file becomes a thin React adapter.

**Tasks:**

### Task 3e.1: Move `agentService.ts` → `domains/agent/service.ts`
- 489-line static class. Pure mechanical move. Update imports. Delete the original.

### Task 3e.2: Move `dmService.ts` → `domains/dm/service.ts`
- 865 lines. Decompose the file into sub-modules if it covers multiple sub-domains (DMs + moderation + API request logging). If too tangled, split into `domains/dm/{service,messages,moderation}.ts`.

### Task 3e.3 through 3e.N: For each React hook
- Read the file. Classify as "thin adapter" or "contains business logic."
- If thin adapter: update import paths only.
- If business logic: extract the logic to `domains/<x>/hooks.ts`. Replace the original file with a thin wrapper that imports the domain logic.

**Verification gate (end of 3e):**
- `src/services/` directory empty (or contains only files explicitly deferred to `PHASE3_FOLLOWUP_QUEUE.md`).
- `src/hooks/` contains only thin React adapters (each file ≤ ~50 lines of glue code).
- `src/contexts/` contains thin React adapters.
- `runtime/scripts/verify-phase3.sh` zero violations.
- Every domain has at least one test covering its service methods.

**Sign-off gate:** ⏸

---

## SUB-PHASE 3f — Projections

**Goal:** Every `buildResult` function (and equivalents) inside the bridge files becomes a pure projection under `projections/<capability>/derive.ts`.

**Files created (no source moves, just extraction):**

| Projection | Input | Output |
|---|---|---|
| `projections/agent-health/derive.ts` | internal controller state | `UseAgentHealthResult` shape |
| `projections/queue-monitor/derive.ts` | internal controller state | `UseQueueMonitorResult` shape |
| `projections/analytics/derive.ts` | internal controller state | `UseAnalyticsReportsResult` shape |
| `projections/oversight-chat/derive.ts` | internal controller state | `UseOversightChatResult` shape |
| `projections/activity-feed/derive.ts` | internal controller state | `UseActivityFeedResult` shape |
| `projections/content-analytics/derive.ts` | internal controller state | `UseContentAnalyticsResult` shape |
| `projections/terminal-keyboard/derive.ts` | internal controller state | `UseTerminalKeyboardResult` shape |
| `projections/dashboard-data/derive.ts` | internal controller state | dashboard data shape |

**Tasks:**

### Task 3f.1 through 3f.8: For each bridge file
- Read the `buildResult` (or equivalent) function.
- Extract it verbatim into the corresponding `projections/<capability>/derive.ts`.
- Add a property-based test: for any input state, derive output matches what the bridge file produces today.
- Update the bridge file to import the projection. (The bridge file is updated in 3g; for 3f, just create the projection files.)
- The bridge file still has its `buildResult` definition for 3f — it gets deleted in 3g.

**Verification gate (end of 3f):**
- Every projection file has a test that asserts the derived output equals the legacy `buildResult` output for the same input.
- The bridge files still work as before (no behavior change yet).
- `runtime/scripts/verify-phase3.sh` zero violations.

**Sign-off gate:** ⏸

---

## SUB-PHASE 3g — Controllers

**Goal:** Each of the seven bridge files decomposes per §6 of the contract. Each controller is a thin orchestrator. The redundant `fetchWithRetry` copies are deleted.

**Files split / moved:**

For each of agent-health, queue-monitor, analytics, oversight-chat, activity-feed, content-analytics, terminal-keyboard:

```
src/lib/bridge/<x>.ts   (today: 152–491 lines, mixed concerns)
                 ↓
runtime/web/src/lib/controllers/<x>/
  controller.ts          ← polling, subscription lifecycle, mutation orchestration only
  state.ts               ← reactive state container (slot)
  index.ts               ← public surface
```

The contract types, substrate calls, domain service calls, and projections are all imported from their respective homes (already moved in 3a/3b/3e/3f).

**Tasks:**

### Task 3g.1: Decompose `agentHealth.ts`
- The 316-line bridge file becomes a controller folder of ~120 lines.
- `fetchWithRetry` (lines 81–116) deleted; the controller imports from `substrates/http/retry.ts`.
- `supabase.channel(...)` chain (lines 218–256) refactored to use the realtime substrate's typed primitive.
- `buildResult` (lines 301–315) deleted; the controller imports `derive` from `projections/agent-health/derive.ts`.
- Constants (POLL_INTERVAL_MS, STALE_TIME_MS, GC_TIME_MS, MAX_RETRIES, RETRY_BASE_MS, RETRY_CAP_MS) move to `contracts/agent-health.contract.ts`.
- React hook `src/hooks/useAgentHealth.ts` import path updated.
- The bridge file is deleted; the controller folder is the new home.

### Task 3g.2 through 3g.7: Same pattern for the other six bridge files.

### Task 3g.8: Move `src/hooks/realtimedata.ts`
- The 315-line realtime data hook is its own controller (it doesn't fit any of the seven T1 capabilities).
- Decompose to `controllers/realtime-data/controller.ts`.
- Update the one consumer (`src/pages/Dashboard.tsx` is in the frozen scope — wait, it's a frozen file. Update via the controller's public surface.)

### Task 3g.9: Move `src/hooks/useDashboardData.ts`
- Same pattern. Becomes `controllers/dashboard-data/controller.ts`.

**Verification gate (end of 3g):**
- `src/lib/bridge/` still contains the seven files BUT they're now thin (~100 lines each, single responsibility).
- Each controller folder under `controllers/<x>/` is the canonical home.
- `git grep "fetchWithRetry" runtime/web/src/lib/controllers/` returns zero matches (the retry primitive is used, not redefined).
- `git grep "supabase.channel" runtime/web/src/lib/controllers/` returns zero matches (the realtime substrate is used, not called directly).
- `runtime/scripts/verify-phase3.sh` zero violations.
- Every T1 contract test passes (polling interval, retry caps, persistence keys byte-identical).
- Every bridge file's behavior test passes (same inputs → same outputs).

**Sign-off gate:** ⏸

---

## SUB-PHASE 3h — Bridge Folder Move

**Goal:** `src/lib/bridge/*` → `runtime/web/src/lib/bridge/*`. Then rename `bridge/` → `controllers/`.

**Why last among the structural moves:** Per D1. Doing it last means every controller already has its import path pointing at `runtime/web/src/lib/bridge/<x>/...`. Once moved, we rename.

**Files moved:**

| From | To |
|---|---|
| `src/lib/bridge/controller.ts` | `runtime/web/src/lib/bridge/controller.ts` (then renamed to `runtime/web/src/lib/controllers/primitives/slot.ts` and `dispose-scope.ts`) |
| `src/lib/bridge/agentHealth.ts` | `runtime/web/src/lib/bridge/agent-health/controller.ts` (already there from 3g — delete the `src/lib/bridge/agentHealth.ts` original) |
| (same for the other six bridge files) | |
| `runtime/web/src/lib/bridge/` | `runtime/web/src/lib/controllers/` (folder rename after all files moved) |

**Tasks:**

### Task 3h.1: Move `controller.ts` primitive
- Read `src/lib/bridge/controller.ts` (115 lines, the only clean file in the bridge layer).
- Move to `runtime/web/src/lib/bridge/primitives/controller.ts`. (Already correct? Verify.)
- Update every consumer (every bridge controller file imports `ControllerSlot, DisposeScope, createControllerSlot`).

### Task 3h.2: Move the seven T1 bridge controllers
- Each `src/lib/bridge/<x>.ts` was replaced in 3g by `runtime/web/src/lib/bridge/<x>/controller.ts`. The original `src/lib/bridge/<x>.ts` is now stale — delete it.
- Verify each deletion.

### Task 3h.3: Rename `bridge/` → `controllers/`
- `git mv runtime/web/src/lib/bridge runtime/web/src/lib/controllers`.
- Update every import that pointed at `bridge/` to point at `controllers/`.
- One PR, atomic.

**Verification gate (end of 3h):**
- `src/lib/bridge/` directory does not exist.
- `runtime/web/src/lib/bridge/` directory does not exist.
- `runtime/web/src/lib/controllers/` is the canonical home.
- All Phase 2 controller tests still pass.
- `runtime/scripts/verify-phase3.sh` zero violations.
- `npm run build` passes.

**Sign-off gate:** ⏸ Phase 3 effectively closes after 3h. 3i can run in any order.

---

## SUB-PHASE 3i — Legal Content

**Goal:** `src/content/legalcontent.ts` → `runtime/web/src/lib/content/legal.ts` per D4.

**Files moved:**

| From | To |
|---|---|
| `src/content/legalcontent.ts` | `runtime/web/src/lib/content/legal.ts` |

**Tasks:**

### Task 3i.1: Move legal content
- Mechanical move (446 lines of string literals).
- Update the consumers: `src/pages/privacypolicy.tsx`, `src/pages/TermsOfService.tsx`, `src/pages/DataDeletion.tsx` (all in frozen scope — they import the same content from the new path).
- Delete the original.

**Verification gate (end of 3i):**
- `src/content/` directory does not exist.
- `runtime/web/src/lib/content/legal.ts` exists and exports the same `LEGAL_CONTENT`, `LEGAL_STRUCTURED_DATA`, `LEGAL_META_TAGS`.
- Legal pages still render identically.
- `runtime/scripts/verify-phase3.sh` zero violations.

---

## Cross-Cutting: `runtime/scripts/verify-phase3.sh`

Authored in sub-phase 3a, run at the end of every sub-phase.

```bash
#!/usr/bin/env bash
# runtime/scripts/verify-phase3.sh
# Dependency-direction gate for Phase 3.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

violations=0

# G1a: substrates never import domains.
echo "Checking: substrates → domains (must be empty)"
matches=$(grep -rE --include='*.ts' --include='*.tsx' \
  "from ['\"].*domains/" runtime/web/src/lib/substrates/ 2>/dev/null || true)
if [ -n "$matches" ]; then
  echo "VIOLATION: substrates import domains:"
  echo "$matches"
  violations=$((violations + 1))
fi

# G1b: domains may import substrates, but not controllers or projections.
echo "Checking: domains → controllers|projections (must be empty)"
matches=$(grep -rE --include='*.ts' --include='*.tsx' \
  "from ['\"].*(controllers|projections)/" runtime/web/src/lib/domains/ 2>/dev/null || true)
if [ -n "$matches" ]; then
  echo "VIOLATION: domains import controllers or projections:"
  echo "$matches"
  violations=$((violations + 1))
fi

# G1c: contracts may import nothing from any layer.
echo "Checking: contracts → anything except (supabase types via substrates) (must be empty)"
matches=$(grep -rE --include='*.ts' --include='*.tsx' \
  "from ['\"].*(domains|controllers|projections|substrates)/" runtime/web/src/lib/contracts/ 2>/dev/null | \
  grep -v "substrates/supabase/database.types" || true)
if [ -n "$matches" ]; then
  echo "VIOLATION: contracts import non-substrate-database.types files:"
  echo "$matches"
  violations=$((violations + 1))
fi

# G1d: projections may import contracts and substrates (NOT domains).
# Projections take raw substrate data and apply contract types. They don't call domain services.
echo "Checking: projections → domains (must be empty)"
matches=$(grep -rE --include='*.ts' --include='*.tsx' \
  "from ['\"].*domains/" runtime/web/src/lib/projections/ 2>/dev/null || true)
if [ -n "$matches" ]; then
  echo "VIOLATION: projections import domains:"
  echo "$matches"
  violations=$((violations + 1))
fi

# G2: No legacy paths remain.
echo "Checking: legacy paths are empty (must be empty for each)"
for legacy in src/types src/services src/lib/supabase.ts src/lib/database.types.ts \
              src/lib/bridge src/config src/content src/stores; do
  if [ -e "$legacy" ]; then
    if [ -d "$legacy" ]; then
      # Allow directory if it contains only frozen files (hooks/contexts keep adapters).
      if [ "$legacy" = "src/hooks" ] || [ "$legacy" = "src/contexts" ]; then
        continue
      fi
      # For other dirs, must be empty.
      if [ -n "$(ls -A "$legacy" 2>/dev/null)" ]; then
        echo "VIOLATION: $legacy still has files:"
        ls -A "$legacy"
        violations=$((violations + 1))
      fi
    else
      echo "VIOLATION: $legacy still exists"
      violations=$((violations + 1))
    fi
  fi
done

# G4: Frozen directories untouched.
echo "Checking: frozen paths have no uncommitted changes (must be empty)"
for frozen in src/components src/pages src/styles src/main.tsx src/App.tsx; do
  if [ -n "$(git diff --name-only -- "$frozen" 2>/dev/null)" ]; then
    echo "VIOLATION: $frozen has uncommitted changes"
    git diff --name-only -- "$frozen"
    violations=$((violations + 1))
  fi
done

# G6: Rust kernel untouched.
if [ -n "$(git diff --name-only -- runtime/src-tauri/ 2>/dev/null)" ]; then
  echo "VIOLATION: runtime/src-tauri/ has uncommitted changes"
  git diff --name-only -- runtime/src-tauri/
  violations=$((violations + 1))
fi

# G7: IPC stubs untouched.
if [ -n "$(git diff --name-only -- runtime/web/src/lib/ipc/ 2>/dev/null)" ]; then
  echo "VIOLATION: runtime/web/src/lib/ipc/ has uncommitted changes"
  git diff --name-only -- runtime/web/src/lib/ipc/
  violations=$((violations + 1))
fi

if [ $violations -eq 0 ]; then
  echo "✅ All dependency-direction gates pass."
  exit 0
else
  echo "❌ $violations violation(s) detected."
  exit 1
fi
```

---

## Final Phase-3 Closure

When sub-phases 3a–3i are all signed off:

1. Run `runtime/scripts/verify-phase3.sh` — zero violations.
2. Run `npm run build` — zero errors.
3. Run the Phase 2 controller test suite — all 12 controller tests pass.
4. Run the React hook regression tests — all 6 pass.
5. Update `runtime/docs/PHASE3_EXECUTION_PLAN.md` with the closure date.
6. Sign-off. Phase 4 (whatever comes next — most likely Phase 7 Svelte migration prep) can begin.

---

## Cross-References

- **Constitutional authority:** `.hermes/docs/PHASE3_development-contract.md`
- **State snapshot (with Decisions Locked D1–D8):** `.hermes/docs/STATE_SNAPSHOT_PHASE2_TO_TARGET.md`
- **Phase 2 contract (in force with §3/§8/§12 overrides):** `runtime/contracts/PHASE2_development-contract.md`
- **Phase 1 contract (in force):** `runtime/contracts/PHASE1_development-contract.md`

---

## Sign-Off Gate

This plan does not begin until the user signs off on the contract AND the plan. Until then:
- This document is DRAFT.
- `runtime/scripts/verify-phase3.sh` is NOT committed.
- No sub-phase begins.

When the user signs off, sub-phase 3a (contracts layer) begins. Each subsequent sub-phase requires its own sign-off before the next begins.
