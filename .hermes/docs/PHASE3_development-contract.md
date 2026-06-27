# PHASE 3 — TS Runtime Reorganization (Development Contract)

**Version:** 1.0
**Program:** Systemic Refactor Initiative
**Status:** DRAFT — awaiting sign-off
**Supersedes (in part):** `runtime/contracts/PHASE2_development-contract.md` clauses 3 (Domain Preservation T0 hold), 8 (Deletion Hold), and the three open questions in clause 12 (Q2, Q3, Q4). All other Phase 2 clauses remain in force.
**Parent Documents:**
- `DOMAIN_PRESERVATION_LAW.md` (four-tier system — still non-negotiable)
- `runtime/contracts/PHASE2_development-contract.md` (IPC seam — closed, §1–§11 in force)
- `runtime/contracts/PHASE1_development-contract.md` (Rust kernel — closed)
- `.hermes/docs/STATE_SNAPSHOT_PHASE2_TO_TARGET.md` §0 (Decisions Locked D1–D8)

---

## 1. Mission

Reorganize the TypeScript layer that survives after React disappears into the target topology:

    presentation
        ↓
    controllers
        ↓
    projections
        ↓
    domains
        ↓
    substrates

Each folder answers exactly one question. Substrates never import domains. Domains never import controllers. Controllers never import presentation. Presentation never imports anything except controllers.

Phase 3 makes the in-scope folders answer those questions. Phase 7 (Svelte migration) and the eventual React deletion both depend on this.

**Phase 3 does NOT:**
- Touch `src/components/`, `src/pages/`, `src/styles/`. These are the Svelte migration skeleton.
- Migrate any React file to Svelte.
- Add or change any user-visible behavior. Every move is byte-for-byte equivalent in observable behavior. Tests that pass today pass after the move.

**Phase 3 DOES:**
- Move files in-scope per §3 below.
- Update every importer in the same commit per D7.
- Delete the legacy file at the same commit per D7.
- Add new files where the topology requires a home that didn't exist (e.g. `contracts/agent-health.contract.ts`).
- Add or update tests to cover the new boundary lines.

---

## 2. Constitutional Objective

Phase 3 establishes the **semantic boundary** inside the WebView's TypeScript layer. The boundary that already exists (Rust ↔ WebView, sealed by Phase 2) is preserved. The new boundary is internal to the WebView's own code:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  WebView (React today, Svelte tomorrow)                                 │
│                                                                          │
│  src/components/, src/pages/, src/styles/      ← FROZEN (Svelte skeleton)│
│                                                                          │
│  presentation/ (future)                                                 │
│        ↓                                                                 │
│  controllers/                                                           │
│        ↓                                                                 │
│  projections/                                                           │
│        ↓                                                                 │
│  domains/                                                               │
│        ↓                                                                 │
│  substrates/                                                            │
│                                                                          │
│  contracts/   ← every layer above reads from here; nothing reads back  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                  ↑ Phase 2 IPC seam (preserved)
┌─────────────────────────────────┴───────────────────────────────────────┐
│  Tauri process (Rust — Phase 1+2)                                       │
│  runtime/web/src/lib/ipc/* — typed stubs (no business logic)           │
└─────────────────────────────────────────────────────────────────────────┘
```

**Three hard rules:**

R1. **Substrates never import domains.** If a substrate file ever needs to know about a domain type, the domain type moves into a contract, or the domain type leaks upward through the substrate via an event payload only. (Phase 3 doesn't pre-empt this; it's the verification gate at the end of every Phase 3 sub-phase.)

R2. **The new layer lives under `runtime/web/src/lib/`.** Per D1 and D5. The `src/lib/`, `src/services/`, `src/types/`, `src/content/`, `src/hooks/`, `src/contexts/`, `src/stores/`, `src/config/` folders are emptied phase by phase. They are not deleted as folders until they're empty.

R3. **Every move is a clean PR.** Move → update importers → delete legacy. No shims. No deprecation re-exports. No `// @deprecated` comments. The tree at the end of every sub-phase compiles and passes its tests with zero references to the old paths.

---

## 3. In-Scope, Out-of-Scope

### 3.1 In scope (will be moved)

| Source (today) | Target home (Phase 3 end state) |
|---|---|
| `src/types/agent-tables.ts` | `runtime/web/src/lib/contracts/agent/agent-tables.contract.ts` |
| `src/types/workflows.ts` | `runtime/web/src/lib/contracts/agent/workflows.contract.ts` |
| `src/types/oversight.ts` | `runtime/web/src/lib/contracts/agent/oversight.contract.ts` |
| `src/types/dashboard.ts` | `runtime/web/src/lib/contracts/observability/dashboard.contract.ts` |
| `src/types/insights.ts` | `runtime/web/src/lib/contracts/observability/insights.contract.ts` |
| `src/types/instagram-media.ts` | `runtime/web/src/lib/contracts/instagram/media.contract.ts` |
| `src/types/permissions.ts` | `runtime/web/src/lib/contracts/identity/permissions.contract.ts` |
| `src/types/ugc.ts` | `runtime/web/src/lib/contracts/content/ugc.contract.ts` |
| `src/types/index.ts` | deleted (barrel replaced by per-contract imports) |
| `src/config/instagramScopes.ts` | `runtime/web/src/lib/contracts/instagram/oauth-scopes.contract.ts` |
| `src/content/legalcontent.ts` | `runtime/web/src/lib/content/legal.ts` (per D4) |
| `src/lib/supabase.ts` | split across `runtime/web/src/lib/substrates/supabase/{client,realtime,audit,fetch-retry,identity}.ts` (Phase 3b) |
| `src/lib/database.types.ts` | `runtime/web/src/lib/substrates/supabase/database.types.ts` (Phase 3b — generated file, moves with its consumer) |
| `src/services/agentService.ts` | `runtime/web/src/lib/domains/agent/service.ts` (Phase 3e) |
| `src/services/consentService.ts` | `runtime/web/src/lib/domains/identity/consent.service.ts` (Phase 3c) |
| `src/services/databaseservices.ts` | `runtime/web/src/lib/substrates/supabase/query.ts` (Phase 3b) — see §5.2 caveat |
| `src/services/dmService.ts` | `runtime/web/src/lib/domains/dm/service.ts` (Phase 3e) |
| `src/services/metaWebhooks.ts` | `runtime/web/src/lib/substrates/meta/webhooks.ts` (Phase 3d) |
| `src/services/webhooks.ts` | `runtime/web/src/lib/substrates/meta/webhooks-internal.ts` (Phase 3d) |
| `src/lib/bridge/controller.ts` | `runtime/web/src/lib/bridge/controller.ts` (Phase 3h) |
| `src/lib/bridge/agentHealth.ts` | `runtime/web/src/lib/bridge/agent-health/controller.ts` (Phase 3g+3h) |
| `src/lib/bridge/analyticsReports.ts` | split: see §6 |
| `src/lib/bridge/activityFeed.ts` | `runtime/web/src/lib/bridge/activity-feed/controller.ts` |
| `src/lib/bridge/contentAnalytics.ts` | `runtime/web/src/lib/bridge/content-analytics/controller.ts` |
| `src/lib/bridge/oversightChat.ts` | `runtime/web/src/lib/bridge/oversight-chat/controller.ts` |
| `src/lib/bridge/queueMonitor.ts` | `runtime/web/src/lib/bridge/queue-monitor/controller.ts` |
| `src/lib/bridge/terminalKeyboard.ts` | `runtime/web/src/lib/bridge/terminal-keyboard/controller.ts` |
| `src/hooks/use*.ts` (T1 contract hooks, 7 of them) | stay in `src/hooks/` until Phase 7; the controllers they delegate to move out from under them, then the hooks import the new path |
| `src/hooks/realtimedata.ts` | `runtime/web/src/lib/bridge/realtime-data/controller.ts` (Phase 3d/3g) |
| `src/hooks/useAgentHealth.ts` | stays in `src/hooks/` (React-bound); imports move to `runtime/web/src/lib/bridge/agent-health/` |
| `src/hooks/useAnalyticsReports.ts` | stays in `src/hooks/`; imports move |
| `src/hooks/useContentAnalytics.ts` | stays in `src/hooks/`; imports move |
| `src/hooks/useOversightChat.ts` | stays in `src/hooks/`; imports move |
| `src/hooks/useActivityFeed.ts` | stays in `src/hooks/`; imports move |
| `src/hooks/useQueueMonitor.ts` | stays in `src/hooks/`; imports move |
| `src/hooks/useTerminalKeyboard.ts` | stays in `src/hooks/`; imports move |
| `src/hooks/useAttributionQueue.ts` | `runtime/web/src/lib/domains/attribution/hooks.ts` (Phase 3e) — note: NOT a React hook at this layer; pure TS reactive primitive |
| `src/hooks/useComments.ts` | `runtime/web/src/lib/domains/comments/hooks.ts` (Phase 3e) |
| `src/hooks/useDashboardData.ts` | `runtime/web/src/lib/bridge/dashboard-data/controller.ts` |
| `src/hooks/useDMInbox.ts` | `runtime/web/src/lib/domains/dm/hooks.ts` |
| `src/hooks/useInstagramAccount.ts` | `runtime/web/src/lib/domains/instagram-account/hooks.ts` |
| `src/hooks/useInstagramInsights.tsx` | `runtime/web/src/lib/domains/instagram-insights/hooks.ts` |
| `src/hooks/useInstagramProfile.ts` | `runtime/web/src/lib/domains/instagram-profile/hooks.ts` |
| `src/hooks/useScheduledPosts.ts` | `runtime/web/src/lib/domains/scheduling/hooks.ts` |
| `src/hooks/useTokenStatus.ts` | `runtime/web/src/lib/domains/identity/token-status.hooks.ts` |
| `src/hooks/useTokenValidation.ts` | `runtime/web/src/lib/domains/identity/token-validation.hooks.ts` |
| `src/hooks/useVisitorPosts.ts` | `runtime/web/src/lib/domains/visitor-posts/hooks.ts` |
| `src/hooks/useWorkflowExecutions.ts` | `runtime/web/src/lib/domains/workflow-executions/hooks.ts` |
| `src/hooks/useAsyncState.ts` | `runtime/web/src/lib/bridge/async-state.ts` (pure runtime primitive) |
| `src/hooks/useLoadingDelay.ts` | `runtime/web/src/lib/bridge/loading-delay.ts` |
| `src/hooks/usePageTransition.ts` | stays in `src/hooks/` (React-Router-bound; presentation concern, frozen until Phase 7) |
| `src/hooks/useModal.ts` | `runtime/web/src/lib/domains/ui-prompts/modal.hooks.ts` |
| `src/hooks/useToast.ts` | `runtime/web/src/lib/domains/ui-prompts/toast.hooks.ts` |
| `src/contexts/ModalContext.tsx` | stays in `src/contexts/` (React-bound); the modal store logic moves to `runtime/web/src/lib/domains/ui-prompts/modal-store.ts` |
| `src/contexts/ToastContext.tsx` | stays in `src/contexts/`; the toast store logic moves to `runtime/web/src/lib/domains/ui-prompts/toast-store.ts` |
| `src/stores/authStore.ts` | split: `substrates/auth/` + `domains/identity/` per D3 (Phase 3c) |

### 3.2 Out of scope (frozen until Phase 7 or beyond)

- `src/components/**` — every `.tsx`. Frozen.
- `src/pages/**` — every `.tsx`. Frozen.
- `src/styles/**` — every `.css`. Frozen.
- `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/vite-env.d.ts` — bootstrap files. Frozen.
- `index.html`, `vite.config.ts`, `tailwind.config.js`, `postcss.config.js` — build config. Frozen.
- `package.json` dependencies — frozen (no dep changes in Phase 3). Drop happens in Phase 7.
- `runtime/src-tauri/**` — Rust kernel. Frozen per Phase 1 closure.
- `runtime/web/src/lib/ipc/**` — IPC stubs from Phase 2. Frozen.
- `runtime/contracts/**` — Phase 1/2 contracts. Frozen unless amended per §10.
- `runtime/docs/**` — Phase plans. Updated by Phase 3 sub-phases as they close.
- `tests/**` — root-level tests. Phase 3 moves tests alongside their source.

### 3.3 Generated / external (move with their owner, don't edit)

- `src/lib/database.types.ts` — generated by `npm run db:types`. Moves to `runtime/web/src/lib/substrates/supabase/database.types.ts` in Phase 3b. The `db:types` script's output path changes to match.
- `src/lib/database.types.ts` consumers that import types from it must change their import paths in the same commit.

---

## 4. The Target Topology — Folder Responsibilities

### 4.1 `runtime/web/src/lib/contracts/`

Per-domain type and invariant declarations. The single source of truth for shape.

Owns:
- Domain row types (input/output of every substrate call).
- Domain event payload shapes.
- Domain invariants ("agent is alive iff last heartbeat < 25 minutes", "alert resolution is idempotent on alert_id").
- Cross-layer input/output DTOs.
- Configuration constants that are contractual (poll intervals, retry caps, persistence keys, OAuth scope list).

Does NOT own:
- Behavior.
- React types.
- Substrate implementation details.

Subfolders (proposed, refine as sub-phases land):
- `contracts/agent/` — agent-tables, workflows, oversight, attribution
- `contracts/observability/` — dashboard, insights, activity-feed, queue, terminal
- `contracts/identity/` — permissions, auth-shape, consent, token-states
- `contracts/instagram/` — media, oauth-scopes, account, profile, visitor-posts
- `contracts/content/` — ugc, scheduled-posts, workflow-executions
- `contracts/ui-prompts/` — modal, toast
- `contracts/compliance/` — legal.ts, meta-platform-terms
- `contracts/seo.contract.ts` (only if D4 reversal occurs; otherwise skip)

### 4.2 `runtime/web/src/lib/substrates/`

External dependency adapters. The only layer that imports from `node_modules` third-party SDKs.

Owns:
- Supabase client + realtime + audit + retry-fetch + identity-mapping.
- Generic Supabase query helper (the `databaseservices.ts` decomposition).
- HTTP client primitive (the `axios` instance, if it's used at this layer).
- Meta webhook ingestion (the inbound webhook adapter).
- Telemetry primitive (audit-log emission at the substrate boundary).

Does NOT own:
- Business rules. A substrate call is `from('table').select(...)` and a try/catch — nothing more.
- Domain types. Substrates return values typed by contracts (e.g. `Promise<Contract['Heartbeat'][]>`), not by their own types.

### 4.3 `runtime/web/src/lib/domains/`

Business capabilities. Each domain folder owns its services, commands, queries, and policies.

Owns:
- Domain services (the `agentService.ts`-class work).
- Domain commands (state-changing operations, e.g. `resolveAlert`, `schedulePost`).
- Domain queries (read operations, e.g. `getHeartbeats`).
- Domain events (semantic events the domain emits upward through projections).
- Domain policies (validation, role checks, idempotency rules).
- Domain-owned Zod schemas where they encode domain invariants.

Does NOT own:
- Polling. That's a controller concern.
- Subscription lifecycle. Substrate.
- Reactive state container. Controller primitive.
- Result shaping for UI. Projection.
- React or any UI framework type.

Subfolders (proposed):
- `domains/agent/` — agent service, oversight service, attribution service
- `domains/observability/` — dashboard, insights, activity-feed, queue
- `domains/identity/` — consent, business-account binding, role mapping, token states
- `domains/instagram/` — account, profile, insights, media, visitor-posts, oauth
- `domains/content/` — ugc, scheduled-posts, workflow-executions
- `domains/dm/` — dm service
- `domains/ui-prompts/` — modal-store, toast-store (domain logic; React context bindings stay in `src/contexts/`)

### 4.4 `runtime/web/src/lib/projections/`

External state → normalized state → derived state.

Owns:
- A pure function `derive(externalState, domainEvents) => derivedState` per projection.
- The mapping from a substrate response (raw rows) into the domain contract.
- Cross-domain joins that produce a unified view (e.g. `agent-health` joins heartbeats + alerts + status).

Does NOT own:
- State. Projections are functions.
- Substrate calls. Projection inputs come from controllers or domains, never from substrates directly.
- React or any UI.

Subfolders (proposed):
- `projections/agent-health/derive.ts`
- `projections/agent-health/types.ts`
- (one per controller, eventually)

### 4.5 `runtime/web/src/lib/controllers/`

Orchestration surfaces. Owns lifecycle, polling, mutation dispatch. The bridge layer IS the controllers layer; the `bridge/` folder is renamed to `controllers/` per D1 at the end of Phase 3.

Owns:
- Reactive state container (slot, subscribe, DisposeScope).
- Polling loops.
- Realtime subscription lifecycle.
- Mutation orchestration (call domain service → update slot).
- Retry discipline (delegates to substrate where it lives; never reinvents).
- Result shaping call: `state()` returns the projected result.
- The T1 controllers (7 of them) and any new ones created in Phase 3.

Does NOT own:
- Business rules.
- Result-shaping logic. Calls into projections.
- Contract constants. Imports from contracts/.
- Retry primitives. Imports from substrates/.

Subfolders (proposed):
- `controllers/agent-health/` — `controller.ts`, `state.ts`, `index.ts`
- `controllers/queue-monitor/`
- `controllers/analytics/`
- `controllers/oversight-chat/`
- `controllers/activity-feed/`
- `controllers/terminal-keyboard/`
- `controllers/dashboard-data/`
- `controllers/realtime-data/`
- `controllers/async-state.ts`, `controllers/loading-delay.ts` (primitives)

### 4.6 `runtime/web/src/lib/content/` (not part of the dependency chain)

Pure content: legal copy, structured data, meta tags. Per D4.

Owns:
- The literal text of the privacy policy, terms of service, data deletion policy.
- SEO structured data objects (Legal_content.LEGAL_STRUCTURED_DATA).
- Meta-tag objects (LEGAL_META_TAGS).

Does NOT own:
- Behavior.
- Types from `contracts/` — content imports types from contracts only.

This folder is a leaf. Nothing else depends on its shape. It can be edited without touching any other layer.

### 4.7 `runtime/web/src/lib/bridge/` — the transitional name

Per D1, `src/lib/bridge/*` moves to `runtime/web/src/lib/bridge/*` first, then the controllers inside are split per Phase 3g, then the empty `bridge/` folder is renamed to `controllers/`. Phase 3h.

---

## 5. Per-Folder Migration Rules

### 5.1 Move rule (D7 operationalized)

For every file in §3.1:

1. The file's new home is created.
2. The file's content is moved verbatim, modulo import-path updates.
3. Every importer in the entire repo is updated to the new path.
4. The legacy file is deleted.
5. `git grep` for the old path returns zero matches.
6. `npm run build` passes.
7. The relevant test command passes.
8. Phase 3 sub-phase commit is signed off before the next one begins.

This is enforced by `runtime/scripts/verify-phase3-subphase.sh` (authored in Phase 3a, run at the end of every sub-phase).

### 5.2 `databaseservices.ts` decomposition caveat

`src/services/databaseservices.ts` is 843 lines of generic Supabase query helpers. It cannot move into `substrates/supabase/query.ts` as a single file because it has zero domain identity — it's a query factory. Phase 3b decomposes it as follows:

- `substrates/supabase/query.ts` — the generic helpers (`from`, `eq`, `limit`, `orderBy`, UUID guard, `ServiceResponse<T>` shape).
- Every method that returns rows of a specific domain table moves to the corresponding domain service in Phase 3e (`agentService.getHeartbeats` already exists; the duplicates in `databaseservices.ts` are deleted).

If the decomposition cannot be done cleanly (i.e. a method touches multiple tables without a clear domain owner), the method is documented in the deletion queue for Phase 3 follow-up.

### 5.3 React-hook files that stay in `src/hooks/`

Per §3.1, seven hooks stay in `src/hooks/` because they are React-bound (the file name carries the `use*` convention). They are the React-side consumers of the controllers. They become the "presentation adapter" the target topology requires:

```
presentation (React, Phase 7) → controllers (TS) → projections → domains → substrates
                    ↑
            src/hooks/useAgentHealth.ts (React adapter)
            imports: runtime/web/src/lib/bridge/agent-health/controller.ts
```

These hooks are NOT removed in Phase 3. They remain as long as React lives. Phase 7 deletes them as Svelte replaces them. Until then they are the only React files Phase 3 touches (import-path updates only — bodies do not change).

### 5.4 React-bound context files

`src/contexts/ModalContext.tsx` and `src/contexts/ToastContext.tsx` are React-bound. Phase 3 extracts their business logic (the toast timer map, the modal resolver) into `domains/ui-prompts/toast-store.ts` and `domains/ui-prompts/modal-store.ts`. The context file becomes a 10-line `useContext` wrapper that calls into the domain store. The context file stays in `src/contexts/` until Phase 7.

---

## 6. The Bridge Layer Decomposition (Phase 3g detail)

Today, every bridge file (`agentHealth.ts`, `queueMonitor.ts`, etc.) mixes:
1. Reactive state container (slot, subscribe)
2. Polling loop
3. Retry primitive (5 copies of `fetchWithRetry` reinvented)
4. Realtime subscription
5. Service calls
6. Mutation orchestration
7. Result shaping (the `buildResult` function)
8. The Controller interface for consumers

Phase 3g splits each bridge file as follows:

```
src/lib/bridge/agentHealth.ts   (316 lines, today)
                 ↓
runtime/web/src/lib/
  contracts/agent-health.contract.ts        ← inputs, outputs, poll interval, retry caps, persistence keys, Zod schemas
  substrates/supabase/realtime.ts          ← supabase.channel().on(...) primitive
  substrates/http/retry.ts                 ← fetchWithRetry (single canonical implementation)
  domains/agent/health.ts                  ← service calls (AgentService.getAgentStatus etc. — already exists, lifted)
  projections/agent-health/derive.ts       ← the buildResult function as a pure projection
  controllers/agent-health/controller.ts   ← polling, subscription lifecycle, mutation orchestration
  controllers/agent-health/state.ts        ← reactive state container (slot)
  controllers/agent-health/index.ts        ← public surface for React hook to import
```

The seven T1 bridge files decompose identically. Phase 3g produces seven new folder subtrees and deletes seven old files.

### 6.1 The retry primitive

Today, `fetchWithRetry` is reinvented in at least five bridge files. Phase 3d extracts one canonical implementation into `substrates/http/retry.ts`. Every controller imports it. Every duplicate is deleted.

### 6.2 The realtime primitive

Today, every controller builds its own `supabase.channel(...).on(...)` chain inline. Phase 3d extracts a typed `substrates/supabase/realtime.ts` primitive that takes a `(payload) => void` callback and returns a `Disposable`. Every controller imports it.

### 6.3 Result shaping — projections vs controllers

The current `buildResult` functions in bridge files do two things:
- Map internal state to public result shape (projection).
- Combine multiple controller slots into one view (composition, controller concern).

Phase 3g moves only the first half into `projections/<capability>/derive.ts`. The composition stays in the controller because composition is a lifecycle concern (when slot A and slot B both update, how do we emit?). The projection is a pure function called by the controller whenever any slot changes.

---

## 7. Sub-Phases (Execution Plan)

The execution plan document `PHASE3_EXECUTION_PLAN.md` details every sub-phase. The sub-phase list:

- **3a. Contracts layer.** Create `contracts/` and move every type file. Zero behavior change.
- **3b. Substrates — Supabase split.** Split `supabase.ts` god-file. Move `database.types.ts`. Decompose `databaseservices.ts`.
- **3c. Auth + Identity.** Split `authStore.ts` into `substrates/auth/` + `domains/identity/`. Move `consentService.ts` into `domains/identity/`.
- **3d. Substrates — HTTP, Realtime, Telemetry, Meta.** Extract retry primitive, realtime primitive, audit primitive, webhook adapters.
- **3e. Domains.** Move every service and every non-React-hook into the appropriate domain folder.
- **3f. Projections.** Extract result-shaping pure functions from bridge files.
- **3g. Controllers.** Split each bridge file into contracts/substrate/domain/projection/controller composition. Update React hook import paths.
- **3h. Move bridge.** `src/lib/bridge/` → `runtime/web/src/lib/bridge/`. Rename to `controllers/` after all seven are decomposed.
- **3i. Legal content.** Move `src/content/legalcontent.ts` → `runtime/web/src/lib/content/legal.ts` per D4.

Each sub-phase is a self-contained PR. Each is gated by its own sign-off. Each ships green tests.

---

## 8. Verification Contract (End-of-Phase-3 Gates)

The phase is complete when ALL of the following are true at HEAD:

G1. **Dependency direction is correct.** Running `runtime/scripts/verify-phase3.sh` returns zero violations:
- `grep -r --include='*.ts' --include='*.tsx' "from '.*substrates" runtime/web/src/lib/{controllers,projections,contracts,content}/` returns zero matches in `controllers/` and `projections/` that go outside their permitted subgraph.
- `grep -r --include='*.ts' --include='*.tsx' "from '.*domains" runtime/web/src/lib/substrates/` returns zero matches.
- `grep -r --include='*.ts' --include='*.tsx' "from '.*controllers" runtime/web/src/lib/{domains,substrates,contracts,content}/` returns zero matches.
- `grep -r --include='*.ts' --include='*.tsx' "from '.*presentation" runtime/web/src/lib/{controllers,projections,domains,substrates,contracts,content}/` returns zero matches (presentation/ doesn't exist yet; this is a future-proofing check).

G2. **No dangling imports.** `grep -rE "from ['\"](?:\\.\\.?/)+(?:lib|services|types|hooks|contexts|stores|config|content)/(?!supabase|database)" src/ runtime/web/src/` returns zero matches outside of `src/components/`, `src/pages/`, `src/styles/`, `src/main.tsx`, `src/App.tsx` (which are frozen and out of scope).

G3. **T1 contracts preserved byte-identically.** Every T1 controller exports the same state shape as today. Every polling interval constant matches. Every persistence key matches. Every SSE wire shape matches. Every Zod schema matches. This is verified by re-running the Phase 2 controller test suite from `runtime/src-tauri/tests/` and the React-side hook regression tests.

G4. **React side untouched (where frozen).** `git diff` of `src/components/`, `src/pages/`, `src/styles/`, `src/main.tsx`, `src/App.tsx`, `index.html`, `vite.config.ts` is empty. No file in these paths was modified.

G5. **Build green.** `npm run build` succeeds. `npx tsc --noEmit -p tsconfig.json` succeeds with zero errors. (Per the Phase 2 lesson: dedicated `tsconfig.<phase>-check.json` does NOT replace root-config verification.)

G6. **Rust kernel untouched.** `git diff` of `runtime/src-tauri/**` is empty. Phase 1 closure preserved.

G7. **IPC stubs untouched.** `git diff` of `runtime/web/src/lib/ipc/**` is empty. Phase 2 closure preserved.

G8. **All moved files have a new home that compiles.** Each file moved in Phase 3 has a corresponding new path under `runtime/web/src/lib/`. `wc -l` totals are within 5% of the original (no accidental deletions).

G9. **D8 satisfied.** No tech debt, no functionality loss. Every exported symbol from a moved file resolves in the new tree. Every behavior (polling, retry, realtime, mutation) that was test-covered before is test-covered after.

G10. **Test count holds.** The Phase 2 contract promised 29 new tests. Phase 3 must not reduce that count. Every controller test, every hook regression test, every contract test from Phase 2 still passes. New tests added by Phase 3 sub-phases are documented in the execution plan.

---

## 9. Non-Goals

Phase 3 does NOT:
- Migrate any React component to Svelte.
- Change any user-visible behavior.
- Add any new third-party dependency.
- Modify any Rust file.
- Modify any IPC stub.
- Touch any file in `src/components/`, `src/pages/`, `src/styles/`.
- Drop any dependency from `package.json`.
- Add a new framework or runtime.

---

## 10. Amendment Procedure

This contract may be amended at any time before Phase 3 closes. Amendments must:
1. Be committed as a change to this document with a clear version bump and date.
2. Update `PHASE3_EXECUTION_PLAN.md` if the amendment affects a sub-phase.
3. Be signed off by the user before the next sub-phase begins.

After Phase 3 closes, amendments require a new contract (e.g. `PHASE4_development-contract.md`).

---

## 11. Cross-References

- **Constitutional authority:** `DOMAIN_PRESERVATION_LAW.md`
- **Phase 1 contract (closed, in force):** `runtime/contracts/PHASE1_development-contract.md`
- **Phase 2 contract (closed, in force with these overrides):** `runtime/contracts/PHASE2_development-contract.md`
- **State snapshot (with Decisions Locked D1–D8):** `.hermes/docs/STATE_SNAPSHOT_PHASE2_TO_TARGET.md`
- **Phase 3 execution plan:** `.hermes/docs/PHASE3_EXECUTION_PLAN.md` (companion document)

---

## 12. Open Questions for Sign-Off

These are the questions I have NOT asked because they follow directly from D1–D8 and the constitutional rules. The user should confirm or override before sign-off.

1. **Folder naming inside `domains/` and `controllers/`.** The proposed subfolder list in §4 uses kebab-case (`agent-health`, `queue-monitor`). Confirm or rename to snake_case (`agent_health`, `queue_monitor`).

2. **Hook-vs-domain placement for legacy React hooks.** §3.1 lists most React hooks as moving into `domains/<x>/hooks.ts`. Some are arguably "view-model hooks" that belong in `controllers/`. The split proposed: if the file is a thin wrapper over a controller, it stays in `src/hooks/` (presentation adapter); if it contains business logic, it goes into the domain as a non-React TS file. Confirm this split.

3. **`useAsyncState.ts` and `useLoadingDelay.ts` placement.** §3.1 puts both into `controllers/` as primitives. Confirm — alternatively they could be in a new `runtime/web/src/lib/runtime/primitives/` subfolder.

4. **Legal-content structured data and meta tags.** D4 settled where the legal copy lives, but `LEGAL_STRUCTURED_DATA` and `LEGAL_META_TAGS` are contract-shaped (SEO contracts). Phase 3i proposes keeping them with `legal.ts` (they're presentation glue, not contracts). Override if they should split out into `contracts/seo.contract.ts`.

5. **Tests folder placement.** Today, tests live at `tests/` (repo root). Phase 3 proposes moving them next to their source under `runtime/web/src/lib/<layer>/<capability>/<file>.test.ts`. Co-located tests are easier to find when the source moves. Confirm.

---

## 13. Sign-Off Gate

Phase 3 does not begin until the user says "go" or equivalent. Until then:
- This document is DRAFT.
- The execution plan is DRAFT.
- No file is moved.
- No commit is made.

When the user signs off, Phase 3a (contracts layer) begins. Each subsequent sub-phase requires its own sign-off before the next begins.
