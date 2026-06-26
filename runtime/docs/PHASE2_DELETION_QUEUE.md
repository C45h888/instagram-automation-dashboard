# PHASE 2 — Deletion Queue (NOT EXECUTED)

> **This document lists files that Phase 2 identified as deletable in
> future phases. NO FILE IN THIS QUEUE IS DELETED BY PHASE 2.**
>
> Each entry is removed only when the phase that owns it executes the
> deletion AND the user signs off on that phase's output.

---

## Phase 2 sign-off status

| Item | Status |
|------|--------|
| Deliverable G — Rust IPC command registry | ✅ Done. 21 commands across 6 categories, all in `runtime/src-tauri/src/ipc/commands.rs`. Zero domain references. |
| Deliverable H — IPC type bridge | ✅ Done. `runtime/src-tauri/src/ipc/types.rs` defines all DTOs and the `IpcErrorDTO` envelope. `RuntimeError` stays kernel-internal (no `Serialize`/`Deserialize` derive — the contract is projection, not leak). |
| Deliverable I — Svelte IPC type stubs | ✅ Done. `runtime/web/src/lib/ipc/{runtime,window,settings,session,log,config,index}.ts` + `__tests__/types.test-d.ts`. Type-checked clean. No business logic. |
| Deliverable J — T1 controller layer | ⏸ **Partially done — STOP for review** |
| J1 — controller.ts (interface) | ✅ Done. `src/lib/bridge/controller.ts` |
| J2 — agentHealth controller + hook refactor | ✅ Done. **Public API byte-identical to legacy hook** (verified `grep -E "^export" src/hooks/useAgentHealth.ts`). |
| J3 — oversightChat controller + hook refactor | ❌ Not started |
| J4 — queueMonitor controller + hook refactor | ❌ Not started |
| J5 — analytics controller + hook refactor | ❌ Not started |
| J6 — activityFeed controller + hook refactor | ❌ Not started |
| J7 — terminalKeyboard controller + hook refactor | ❌ Not started |

---

## Why J3–J7 are sequential follow-ons (not in this push)

Each T1 hook has subtle invariants that need careful, per-hook attention
to preserve 100%:

| Hook | Subtle invariant (must preserve in controller) |
|------|--------------------------------------------------|
| `useOversightChat` | `cleanedUp` race protection, line-buffer carry across SSE chunks, `setActiveSession` deliberately omitted (would re-trigger parse effect and wipe message), event-type routing with payload-shape fallback, `MAX_STREAM_DURATION_MS = LIVENESS_THRESHOLD_MS * 5`, persist partial on stream error |
| `useQueueMonitor` | Single 15s poll (one clock, one table scan), 200-row fetch derives histogram + DLQ from same result, optimistic cache update on retry |
| `useAnalyticsReports` | 30-row limit default, Realtime debounce 1s on `daily_analytics` |
| `useActivityFeed` | 50-row audit log query + Realtime INSERT, client-side filter on `details.business_account_id` |
| `useTerminalKeyboard` | Ctrl+C / Ctrl+L / ArrowUp/Down / Escape bindings, `localStorage['terminal-command-history']` (max 100), cleanup on unmount |

Doing these in a single batch would risk missing one of these invariants
— exactly the "lazy migration" the user explicitly prohibited.

**Recommended cadence:** one controller + hook refactor per morning
review pass. The pattern is proven by `agentHealth`; the remaining five
follow the same shape.

---

## Files queued for deletion (NOT executed by Phase 2)

### Category 1 — Vite / React build artifacts
**Delete in:** Phase 7 (Application Shell) — after Svelte build pipeline is operational.

| File | Replacement |
|------|-------------|
| `vite.config.ts` | `runtime/src-tauri/tauri.conf.json` `frontendDist` |
| `index.html` | Tauri WebView HTML (Svelte entry) |
| `src/main.tsx` | Svelte entry point |
| `src/App.tsx` | Svelte `App.svelte` |
| `tailwind.config.js` | T4 design tokens (Phase 4) |
| `postcss.config.js` | T4 CSS pipeline |
| `src/index.css` | T4 base styles |
| `public/*` | Tauri icons + assets |
| `eslint.config.js` | ESLint config adapted for Svelte (rules ported, Vite plugins dropped) |
| `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` | Adapted to Svelte project layout |
| `sw.js` | Replaced if Tauri needs a service worker (none planned) |

### Category 2 — React-only npm dependencies
**Drop in:** Phase 7, as last consumer migrates.

| Dependency | Status |
|------------|--------|
| `react` | Drop |
| `react-dom` | Drop |
| `react-router-dom` | Replace with Svelte routing |
| `framer-motion` | Replace with Svelte transitions |
| `lucide-react` | Replace with T4 icon set |
| `recharts` | Replace with T4 ASCII panel / observability shell |
| `react-hot-toast` | Replace with T4 toast surface |
| `@tanstack/react-query` | Replace with Svelte stores + fetch (T1 controllers already UI-framework-agnostic) |
| `zustand` | Replace with Svelte stores (`authStore.ts` itself is T0 and stays) |
| `@radix-ui/*` | Replace with T4 components |
| `tailwind`, `autoprefixer`, `postcss` | Replaced by T4 design system |
| `@types/react`, `@types/react-dom`, `@types/react-router-dom` | Drop |

### Category 3 — React components
**Delete as Svelte equivalent ships.** Each T3 component is deleted only
after the corresponding Svelte component is verified working in Phase 7.

| Path | Notes |
|------|-------|
| `src/components/**/*.tsx` | 90 files, T3 tier |
| `src/pages/*.tsx` | 19 files, T3 tier |
| `src/contexts/ToastContext.tsx` | T2 — replaced by Svelte context |
| `src/contexts/ModalContext.tsx` | T2 — replaced by Svelte context |
| `src/hooks/useToast.ts` | T2 bridge — replaced by Svelte equivalent |
| `src/hooks/useModal.ts` | T2 bridge — replaced by Svelte equivalent |
| `src/hooks/usePageTransition.ts` | T2 bridge — replaced by Svelte equivalent |

### Category 4 — Build / deploy artifacts
| File | Action | Notes |
|------|--------|-------|
| `Dockerfile` | UNCHANGED | Backend containerization still applies |
| `nginx.conf` | UNCHANGED | Backend serving still applies |
| `Dockerfile.frontend` (if any) | DELETE in Phase 7 | Static-frontend serving is replaced by Tauri bundle |

### Category 5 — Files that may be renamed but NOT deleted
| File | Reason |
|------|--------|
| `src/lib/bridge/` (NEW in Phase 2) | Stays. The T1 controller layer is the canonical source for both React (now) and Svelte (Phase 7). |

---

## Files NEVER deleted (Tier 0 / 1 / 2)

| File | Tier | Why preserved |
|------|------|---------------|
| `src/stores/authStore.ts` | T0 | Auth state machine — do not touch |
| `src/lib/supabase.ts` | T0 | Client + helpers — do not touch |
| `src/lib/database.types.ts` | T0 | Generated types — never edit |
| `src/types/index.ts` | T0 | Barrel — must re-export existing paths |
| `src/types/agent-tables.ts` | T0 | Authoritative agent domain types |
| `src/types/oversight.ts` | T0 | SSE protocol types + guards |
| `src/types/dashboard.ts` | T0 | Dashboard shape |
| `src/types/insights.ts` | T0 | Instagram insight types |
| `src/types/permissions.ts` | T0 | Page permissions |
| `src/types/instagram-media.ts` | T0 | Alternate InstagramMedia |
| `src/types/ugc.ts` | T0 | UGC types |
| `src/types/workflows.ts` | T0 | Workflow types |
| `src/config/instagramScopes.ts` | T0 | OAuth scopes |
| `src/content/legalcontent.ts` | T3 (special) | Legal copy — preserved across migration |
| `src/styles/terminal.css` | T4 reference | Tokens port to T4 design system |
| `src/services/*.ts` | T2 | Wrapped, not rewritten |
| `src/hooks/useAgentHealth.ts` | T1 | File persists; body refactored to delegate to controller |
| `src/hooks/useOversightChat.ts` | T1 | Same |
| `src/hooks/useQueueMonitor.ts` | T1 | Same |
| `src/hooks/useAnalyticsReports.ts` | T1 | Same |
| `src/hooks/useActivityFeed.ts` | T1 | Same |
| `src/hooks/useTerminalKeyboard.ts` | T1 | Same |

---

## Phase 2 sign-off prerequisite for any deletion

Before Phase 3 or Phase 7 may execute any deletion from this queue:

1. All J3–J7 controllers + hook refactors must be complete and verified.
2. `cargo build` + `cargo test --lib` + `cargo clippy --all-targets -- -D warnings` all pass.
3. `tsc --noEmit` passes for the bridge layer.
4. The user signs off on Phase 2 completion explicitly.

---

## Last updated
2026-06-17 — Phase 2 status snapshot: G ✅ H ✅ I ✅ J1 ✅ J2 ✅ J3-J7 ❌
