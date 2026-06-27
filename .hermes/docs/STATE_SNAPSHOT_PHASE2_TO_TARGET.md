# STATE SNAPSHOT — PHASE 2 → TARGET ARCHITECTURE

Report generated: 2026-06-27
Repo: `instagram-automation-dashboard`
Branch: `main` (HEAD: `0267408` — `feat(phase2): complete J3-J7 — all T1 hooks refactored to bridge pattern`)
Scope: TypeScript frontend layer (`src/`) plus its declared constitutional neighbor (`runtime/`).
Purpose: anchor the next step of reorganization (semantic separation) in actual evidence, so the migration onto the target folder topology is grounded in what's really there, not what's planned.

---

## 0. DECISIONS LOCKED (2026-06-27, post-snapshot)

These decisions were made via `clarify` after the snapshot was first drafted. They supersede any implied direction in sections 1–8 below. The constitutional contract for the next phase is `PHASE3_development-contract.md` (to be authored) and `PHASE3_EXECUTION_PLAN.md` (to be authored); both live under `.hermes/docs/`.

D1. **Bridge/controller layer final home.** `src/lib/bridge/*` moves to `runtime/web/src/lib/bridge/`. React hooks import across the `runtime/` path during the transition. Cleaner long-term: bridge sits next to the IPC stubs and is the layer Rust talks through.

D2. **SSE passthrough.** Phase 7 (Svelte) reads SSE directly from `api.888intelligenceautomation.in` over HTTPS, same as today's React. Rust has no visibility into the stream. Resolves Phase 2 contract Q4 as "WebView-direct, no proxy."

D3. **Auth split.** `substrates/auth/` owns the Supabase Auth transport (signIn, signOut, session refresh). `domains/identity/` owns the role/permission/business-account shape that auth transport produces. Domain services consume identity; substrates consume auth.

D4. **Legal content placement.** `src/content/legalcontent.ts` moves to `runtime/web/src/lib/content/legal.ts` now. React keeps importing via the same path until React dies; Svelte picks it up directly when those pages migrate.

D5. **Cross-layer import rules (enforced).** No file under `runtime/web/src/lib/` may import from anywhere outside `runtime/web/src/lib/` and `src/types/`. Within `runtime/web/src/lib/`: substrates may import substrates; domains may import substrates; controllers may import domains + substrates; projections may import anything below them; presentation (later) imports controllers only.

D6. **Phasing.** Strangler per layer, NOT per capability. Phase 3a = `contracts/`. Phase 3b = `substrates/supabase/`. Phase 3c = `substrates/auth/` + `domains/identity/`. Phase 3d = `substrates/{http,realtime,telemetry}/`. Phase 3e = `domains/{agent,queue,analytics,...}/`. Phase 3f = `projections/`. Phase 3g = `controllers/`. Phase 3h = move `src/lib/bridge/*` into `runtime/web/src/lib/bridge/`. Each phase is self-contained, shippable, gated.

D7. **Move semantics.** Move → update all importers in the same commit → delete the legacy file. No shim. No intermediate state. Each phase produces a clean tree at its end.

D8. **T0 supersession.** Phase 2 contract clause 8 ("Deletion Hold") declared `src/types/*`, `src/lib/supabase.ts`, `src/lib/database.types.ts`, `src/stores/authStore.ts`, `src/hooks/use*.ts` as NEVER-deleted. That rule is superseded by D7: any of those files may be moved when its semantic home exists; deletion follows once importers update. The replacement principle: **no tech debt, no functionality loss**. Every type, every state slot, every exported symbol must resolve in the new tree with identical behavior.

### Scope correction vs the original snapshot

The original snapshot listed `hooks/`, `contexts/`, `stores/`, `config/`, `lib/`, `services/`, `types/`, `content/` as "in scope for reorganization." The corrected scope from the user's most recent instruction:

- **Frozen (skeleton for Svelte migration):** `src/components/`, `src/pages/`, `src/styles/`. Not touched.
- **In scope for Phase 3 reorganization:** `src/hooks/`, `src/contexts/`, `src/stores/`, `src/config/`, `src/lib/`, `src/services/`, `src/types/`, `src/content/`. Each moves into `runtime/web/src/lib/{substrates,domains,controllers,projections,contracts}/` per D5 and D6.

---

## 1. CONTEXT — WHAT THE TARGET ASKS FOR

The target topology the user defined:

    presentation
        ↓
    controllers
        ↓
    projections
        ↓
    domains
        ↓
    substrates

A one-question-per-folder rule:

- domains/     — business capabilities. Never know React/Svelte/Tauri exist.
- substrates/  — external dependencies (supabase, realtime, http, sse). Never know domains.
- projections/ — external state → normalized → derived. Portable across UIs.
- controllers/ — orchestration surfaces (polling, subscription lifecycle, mutation orchestration). No business rules.
- contracts/   — inputs, outputs, events, invariants. Frame the safe-migration surface.
- presentation/— disposable UI layer (react, svelte, ascii, terminal).
- runtime/     — the TS layer that survives after React. What Rust talks to over IPC.

The single most important sentence: **substrates never consume domains**. Every folder answers exactly one question.

---

## 2. CURRENT STATE — WHAT THE REPO ACTUALLY CONTAINS

### 2.1 Folder inventory (`src/`)

    App.tsx
    main.tsx
    components/         (45 files, 6 subdomains: agent-terminal, audience, auth, dashboard, layout, modals, permissions, settings, transitions, ui, ErrorBoundary.tsx)
    config/             (instagramScopes.ts)
    content/            (legalcontent.ts)
    contexts/           (ModalContext.tsx, ToastContext.tsx)
    hooks/              (24 hooks — see §2.3)
    lib/
        bridge/         (8 files — see §2.4)
        database.types.ts
        supabase.ts
    pages/              (17 pages — see §2.5)
    services/           (6 services — see §2.6)
    stores/             (authStore.ts)
    styles/             (terminal.css)
    types/              (8 type modules)

### 2.2 Lineage at HEAD

    0267408 feat(phase2): complete J3-J7 — all T1 hooks refactored to bridge pattern
    525dca3 feat(phase2): IPC constitutional layer — G, H, I, J1+J2 closed
    32d317c  the main worktree changes which have been made this is phase 1
    38abdf6 clean up and clean delegation of the repos
    6a921ba chore: split repo - remove backend

Phase 2 just landed: every T1 hook (useAgentHealth, useQueueMonitor, useAnalyticsReports, useContentAnalytics, useOversightChat, useActivityFeed, useTerminalKeyboard) now delegates to a controller in `src/lib/bridge/`. The hook body is a thin `useSyncExternalStore` wrapper. This is real progress and it is the seed of the target topology — but it is not the target.

### 2.3 The 24 hooks

    useAgentHealth.ts          76  (T1, bridge refactored)
    useQueueMonitor.ts         65  (T1, bridge refactored)
    useAnalyticsReports.ts     70  (T1, bridge refactored)
    useContentAnalytics.ts     86  (T1, bridge refactored)
    useOversightChat.ts        72  (T1, bridge refactored)
    useActivityFeed.ts         59  (T1, bridge refactored)
    useTerminalKeyboard.ts     94  (T1, bridge refactored)

    useAttributionQueue.ts    161
    useComments.ts            179
    useDashboardData.ts       119
    useDMInbox.ts             257
    useInstagramAccount.ts    121
    useInstagramInsights.tsx  100
    useInstagramProfile.ts    100
    useModal.ts                48
    useOversightChat.ts        72   ← also a bridge consumer; legacy?
    usePageTransition.ts       31
    useScheduledPosts.ts      150
    useToast.ts                31
    useTokenStatus.ts          74
    useTokenValidation.ts     293
    useVisitorPosts.ts        336
    useWorkflowExecutions.ts  219
    useAsyncState.ts           67
    useLoadingDelay.ts         28

    realtimedata.ts           315   ← anti-pattern: a single fat file importing everything for one consumer (Dashboard.tsx)

7 hooks have been touched by the bridge refactor. 17 still contain their full business logic, polling, supabase access, retry, and subscription wiring inline.

### 2.4 The bridge layer (`src/lib/bridge/`)

    controller.ts          115  ← infrastructure primitive (ControllerSlot, DisposeScope). Framework-agnostic. Correct.
    agentHealth.ts         316
    analyticsReports.ts    230
    activityFeed.ts        152
    contentAnalytics.ts    186
    oversightChat.ts       491
    queueMonitor.ts        241
    terminalKeyboard.ts    213

`controller.ts` is the only file in this layer that is purely a primitive. The seven bridge controllers are each named after a domain capability (agent health, queue, analytics, oversight chat, etc.) but the file contents are NOT a single-responsibility controller. They are:

- reactive state container (createControllerSlot usage)          ← projection surface
- polling loop (setInterval)                                     ← controller surface
- retry primitive with exponential backoff                       ← substrate/router concern
- realtime subscription (supabase.channel().on)                  ← substrate adapter concern
- service calls (AgentService.getAgentStatus, etc.)              ← domain service concern
- mutation orchestration (resolveAlert: service → cache update)  ← domain command concern
- result shaping (combining three queries into one return shape) ← projection concern
- reactive-store scaffolding (slot.setState, listener fan-out)   ← runtime primitive

Every one of those concerns is real. Every one of those concerns is currently living inside the same 316-line file. The bridge refactor moved framework binding OUT of the hooks — that part is correct — but it left the same five-to-eight semantic responsibilities MIXED together inside each bridge controller. The bridge layer is the right shape for what comes next, but it is currently the densest concentration of mixed responsibilities in the codebase.

### 2.5 The 17 pages

All pages import directly from `@/hooks/...` or `../hooks/...`. Page files are responsible for assembling UI from hook outputs. They currently do nothing wrong — they consume the public hook API. The hook surface is what has to be redesigned next.

Pages pulling hooks most aggressively: Dashboard.tsx (6), EngagementMonitor.tsx (4), UGCManagement.tsx (3), Analytics.tsx (2), CommentManagement.tsx (2), ContentManagement.tsx (2), DMInbox.tsx (2). That is where presentation is most coupled to the legacy hook API.

### 2.6 The 6 services

    agentService.ts           489
    consentService.ts         547
    databaseservices.ts       843
    dmService.ts              865
    metaWebhooks.ts           424
    webhooks.ts               237

`agentService.ts` is currently the closest thing the repo has to a domain service. It owns the agent-domain Supabase queries, has typed ServiceResponse wrappers, has its own UUID validator, has its own retry discipline, and is consumed by `src/lib/bridge/agentHealth.ts`. It is the **right primitive in the wrong folder**: it is doing domain service work inside `src/services/`, which in the target topology is not a folder at all.

`databaseservices.ts` (843 lines) is the opposite end of the same problem: it is a generic Supabase query class with no domain identity. It should be inside `substrates/supabase/` (or, if the policies dictate one service per domain, decomposed).

`dmService.ts` (865 lines) mixes domain operations on DMs with what looks like API request logging and moderation logic. Not yet read in detail; flagged for §3.

`webhooks.ts` and `metaWebhooks.ts` (237 + 424 lines) are real adapters — Facebook/Meta → internal event translation. These belong in `substrates/` or in a dedicated domain layer depending on whether they are event-source adapters or domain operations.

`consentService.ts` is a real domain service for consent. It belongs in `domains/<consent>/`.

### 2.7 `src/lib/supabase.ts` (500 lines)

This is the clearest single-file evidence of contamination. In one file:

- client construction (lines 60–149)
- custom fetch with retry + exponential backoff (lines 86–117)
- audit log writer (lines 204–235)
- session helpers (getCurrentUser, getCurrentSession, lines 240–261)
- user profile fetch (lines 263–277)
- realtime subscription primitive (subscribeToTable, lines 284–334)
- workflow-specific subscription wrappers (subscribeToUserWorkflows, subscribeToWorkflowExecutions)
- role hierarchy + role check helpers (lines 362–387)
- API request usage logging (lines 390–424)
- Facebook-ID ↔ Supabase-user_id mapping (lines 434–476)
- three type guards (isUserProfile, isAdminUser, isWorkflow)

That is at least six responsibilities in one file: client bootstrap, transport adapter (retry fetch), audit substrate, auth substrate, realtime substrate, identity mapping. In the target topology this file must be shredded across `substrates/supabase/client.ts`, `substrates/supabase/realtime.ts`, `substrates/supabase/audit.ts`, `substrates/auth/`, and possibly `substrates/meta/identity.ts`.

### 2.8 `src/types/` and `src/stores/`

`src/types/` (8 files: agent-tables, dashboard, index, insights, instagram-media, oversight, permissions, ugc, workflows) is currently an undifferentiated bucket. In the target topology types live next to their domain: `domains/agent/types.ts`, `domains/oversight/types.ts`, etc.

`src/stores/authStore.ts` is the only Zustand store. The target presentation layer should consume auth via a controller, not directly via the store.

### 2.9 `runtime/`

Already exists at repo root with its own constitutional documents:
- `runtime/README.md` declares "the runtime serves the platform. The platform does not serve the runtime."
- `runtime/contracts/PHASE1_development-contract.md` and `PHASE2_development-contract.md` govern the runtime construction.
- `runtime/docs/PHASE1_EXECUTION_PLAN.md` and `PHASE2_EXECUTION_PLAN.md` track execution.
- `runtime/src-tauri/` is the Rust/Tauri kernel.
- `runtime/web/src` is presumably where the Rust runtime talks to the TS layer.

The presence of `runtime/` means: the target topology is not a green-field design. The platform layer (`src/`) already has a declared consumer (the Rust runtime). The next reorganization must therefore be designed against two consumers at once: the React UI today, and the IPC bridge to Rust tomorrow.

---

## 3. RESPONSIBILITY MAP — WHERE EACH CONCERN LIVES TODAY

| Concern (target home) | Today's actual location | Verdict |
|---|---|---|
| **Substrates** (external deps) | `src/lib/supabase.ts` (client + realtime + audit + auth + identity + retry-fetch); `src/services/databaseservices.ts` (generic queries); `src/services/webhooks.ts` + `metaWebhooks.ts` (event source adapters) | Mixed into a single 500-line god-file plus a 843-line generic query class. **Contaminated.** |
| **Domain services** (business capabilities) | `src/services/agentService.ts` (agent), `src/services/consentService.ts` (consent), `src/services/dmService.ts` (DM), parts of `databaseservices.ts` | Real domains exist but live in a flat `services/` folder. **Wrong location, no separation by domain.** |
| **Controllers** (orchestration: polling, subscription lifecycle, mutation) | `src/lib/bridge/*.ts` (7 files), inline inside 17 untouched hooks | The 7 bridge files mix controllers with everything else. The 17 legacy hooks contain their own controllers inline. **Inconsistent + contaminated.** |
| **Projections** (external → normalized → derived) | Nowhere. Result-shaping currently happens inside each bridge controller's `buildResult` and each hook's return object. | **Missing as a layer.** Every controller reinvents it. |
| **Contracts** (inputs, outputs, events, invariants) | `runtime/contracts/PHASE1/2_development-contract.md` (governs runtime only). No per-domain contract files exist for the TS platform. | **Missing at the TS layer.** |
| **Presentation** (UI frameworks) | `src/components/**`, `src/pages/**`, `src/contexts/**`, `src/stores/authStore.ts` | Frameworks (React, Framer Motion, TanStack Query) leak into hooks via `useSyncExternalStore` calls — but presentation is the cleanest of the layers today. **Boundary mostly respected, except for the auth store.** |
| **Runtime** (what survives after React) | `runtime/src-tauri/` (Rust), `runtime/web/src` (presumed bridge consumer); `src/lib/bridge/controller.ts` (the only TS primitive that is purely runtime) | Only `controller.ts` is currently clean. The rest of `src/` is not yet "what survives after React" — it's "what React consumes". |
| **Types** | `src/types/` (flat) | Belongs co-located with each domain, not in a flat bucket. |

---

## 4. THE BRIDGE LAYER — ITS CURRENT RESPONSIBILITY MIX, EXPLICITLY

Taking `agentHealth.ts` (316 lines) as the canonical example of what's wrong at the seam. Each line range is doing one of the following:

| Lines | Responsibility | Target home |
|---|---|---|
| 29–34 | imports from services + supabase + hooks + own controller primitive | wiring (acceptable) |
| 36–55 | constants (poll interval, stale time, retry caps) | contract (should live in `contracts/agent-health.contract.ts`) |
| 60–75 | internal state shape | projection (should live in `projections/agent-health/state.ts`) |
| 78–116 | `fetchWithRetry` primitive | substrate-adjacent helper or contract (currently reinvented in 5 bridge files) |
| 122–316 | controller factory: state, polling, realtime, mutation, result build | controller (correct) but mixed with substrate calls and projection result-shaping |

The 7 bridge controllers do not even share a retry primitive — `agentHealth.ts`, `analyticsReports.ts`, `contentAnalytics.ts`, `queueMonitor.ts` each declare their own `fetchWithRetry` (or roll their own). That is the duplication symptom of mixed responsibilities: when a concern has no home, it gets reinvented inside every file that needs it.

This is the single largest cleanup opportunity in the TS layer today.

---

## 5. CONFORMING VS NON-CONFORMING ZONES

**Already conforming to the target topology:**

- `src/lib/bridge/controller.ts` — pure runtime primitive. No React, no supabase, no domain. Correct.
- `src/components/ui/` — UI primitives only. Mostly correct, but mixes presentation with some animation logic that arguably belongs in presentation/animations/.

**Mostly conforming, needs migration:**

- `src/components/agent-terminal/`, `audience/`, `dashboard/` — UI surfaces. Will move into `presentation/react/` once we accept the topology.

**Non-conforming (the work):**

- `src/lib/supabase.ts` (500 lines, 6+ responsibilities)
- `src/services/databaseservices.ts` (843 lines, generic substrate)
- `src/lib/bridge/*.ts` (7 files, 5–8 responsibilities each)
- `src/hooks/use*.ts` (17 hooks still contain controller logic)
- `src/types/` (flat bucket)
- `src/stores/authStore.ts` (auth state outside the controller pattern)
- `src/contexts/*` (React-context-only state, not a controller yet)

---

## 6. THE WORK THIS REPORT INFORMS

The next reorganization step is not "rename folders". It is the surgical separation of mixed responsibilities inside the bridge layer and the migration of services and supabase.ts into their target homes. The minimum-viable shape of that work:

1. **Extract substrate primitives.** Split `src/lib/supabase.ts` into `substrates/supabase/{client,realtime,audit,fetch-retry,identity}.ts`. Promote `databaseservices.ts` into `substrates/supabase/query.ts` or split it across domains if the duplication forces that.
2. **Promote contracts.** For each of the 7 T1 capabilities (agent-health, queue, analytics, oversight, activity, terminal-keyboard, content-analytics), write a `contracts/<capability>.contract.ts` declaring inputs, outputs, events, invariants. The constants in each bridge file (poll interval, retry caps, persistence keys) move there.
3. **Separate projections from controllers.** For each capability, the result-shaping currently inside `buildResult` becomes its own `projections/<capability>/derive.ts`. The controller imports it; the projection knows nothing about the controller.
4. **Domain services take their seats.** Move `src/services/agentService.ts` → `domains/agent/service.ts`. Same for `consentService`, `dmService` (after decomposing it). Domain services consume substrates only — no React, no controller imports.
5. **Controllers slim down.** Each `src/lib/bridge/<capability>.ts` becomes an orchestrator: it owns polling, subscription lifecycle, mutation, dispose. It does NOT own result-shaping (projection), it does NOT own retry primitives (substrate), it does NOT own contract constants (contract). After this, each controller is a thin file.
6. **Bridge layer becomes the runtime.** Once steps 1–5 land, `src/lib/bridge/` IS the `runtime/` of the target topology. Rename it.
7. **Migrate the 17 legacy hooks.** Each gets the same treatment the 7 T1 hooks got, but now against the new topology: hook → controller → projection → domain service → substrate.
8. **Pages move into presentation.** `src/pages/**` and `src/components/**` move into `presentation/react/`. Hooks stop being directly imported by pages; pages import a thin React adapter (the new T1-style hooks, now properly thin).
9. **Auth store into a controller.** `src/stores/authStore.ts` becomes `domains/auth/` with its own controller and projection.

After this, the dependency direction is exactly:

    presentation → controllers → projections → domains → substrates

with substrates never importing upward, and presentation never being imported by anything below it.

---

## 7. WHAT THIS REPORT DOES NOT YET SAY

- It does not yet name every file to be moved. The next step should be a file-by-file mapping produced from this report.
- It does not yet describe the Rust IPC surface. `runtime/web/src` and `runtime/src-tauri/src` need to be examined before the controller interface is frozen as the IPC contract.
- It does not yet describe how tests follow the move. `tests/` exists at repo root; its relationship to the new topology has not been mapped.
- It does not yet describe how `src/config/instagramScopes.ts` and `src/content/legalcontent.ts` fit. They are config and content respectively — neither matches a domain. Their target homes are likely `contracts/` (instagram scope contract) and `presentation/content/` (legal copy).
- It does not yet answer: does the auth domain belong in `domains/auth/` (business capability) or in `substrates/auth/` (external Supabase Auth API)? The user should decide — it has characteristics of both.

These are the open questions for the next clarification round.

---

## 8. ONE-LINE SUMMARY

The bridge refactor (Phases 1–2) correctly moved framework binding out of hooks. It did not yet separate the responsibilities that the binding layer inherited: substrates, contracts, projections, and domain services are all still mixed into the bridge files. The next step is to formalize those four layers and let controllers become the thin orchestrators they were always meant to be — at which point the TS layer finally has the shape that the Rust runtime is already expecting.
