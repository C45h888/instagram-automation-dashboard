# Domain Preservation Law — Official Register
**Governing document for:** `instagram-automation-dashboard` (wt-627425ab)
**Effective:** 2026-06-16
**Law version:** `DOMAIN-PRESERVATION-LAW-001`

---

> *"These systems SHALL NOT be rewritten during the frontend migration program.
> The migration SHALL occur above these layers."*

This document is the authoritative cross-reference between every file in `src/`
and the four preservation tiers. It is the single source of truth for what may
be migrated, adapted, or replaced. Everything not explicitly listed in a tier
falls to the most permissive tier that contains its parent directory.

---

## Governing Law

```
DOMAIN PRESERVATION LAW 001

The following subsystems are considered authoritative platform infrastructure:

  Auth · Supabase · Database Types · Service Layer · Agent Layer
  Realtime Layer · SSE Layer · Workflow Layer

These systems SHALL NOT be rewritten during the frontend migration program.
The migration SHALL occur above these layers.

  ✓ Adapters MAY be created.
  ✓ Wrappers MAY be created.
  ✓ Consumers MAY be replaced.
  ✗ Core implementations SHALL remain intact.
```

---

## Preservation Tiers — Summary

| Tier | Label | Action | Applies To |
|------|-------|--------|------------|
| **T0** | ABSOLUTELY IMMUTABLE | Never touch. Never rewrite. Consume only. | Auth, Supabase client, generated types |
| **T1** | SYSTEM CONTRACTS | Survive exactly as-is. Consumed via adapters. | Heartbeat, SSE, Agent status, Queue, Realtime |
| **T2** | INTEGRATION ADAPTERS | Survive. Wrapped. Consumption model changes. | All data hooks, service modules, contexts |
| **T3** | PRESENTATION | Fully replaceable. Migration target. | Pages, components, layouts |
| **T4** | DESIGN SYSTEM | Greenfield. Does not exist yet. | White/Gold theme, ASCII panels, observability shell |

---

## Tier 0 — ABSOLUTELY IMMUTABLE

> **Nothing touches these. Nothing migrates these. Nothing rewrites these.**
> The new frontend (Tauri/Svelte) consumes them. It does not replace them.

### T0-A — Auth System

| File | Law | Rationale |
|------|-----|-----------|
| `src/stores/authStore.ts` | **T0** | Zustand store. Full auth state machine, OAuth flow, session management, `providerToken` capture, `businessAccountId` linkage. See `runtime/archive/ARCHITECTURE_MAP.md` §1.1.1. **Do not touch. Do not migrate. Consume from Tauri IPC.** |
| `src/pages/Login.tsx` | **T0** | OAuth gatekeeper. Handles consent logging, scope disclosure, `sessionStorage` consent flow, dev mock login. See MAP §1.1.2. **Presentation only — but drives auth decisions. Migrate UI only if auth state can be preserved. Err on the side of keeping this file.** |
| `src/pages/FacebookCallback.tsx` | **T0** | OAuth redirect handler. Token extraction, `/exchange-token` POST, scope validation, `user_consents` INSERT. See MAP §1.1.3. **Protocol correctness is critical. Changes here break auth. Treat as T0.** |
| `src/pages/AdminLogin.tsx` | **T0** | Parallel admin auth flow. See MAP §1.1.4. |
| `src/components/auth/PagePickerModal.tsx` | **T0** | Renders multi-account page picker. State flows from `FacebookCallback`. |

**Preserved invariants:**
- `VITE_AUTH_MODE` branching logic must survive
- `sessionStorage['pendingConsent']` → `user_consents` INSERT chain must survive
- `VITE_ADMIN_EMAIL` / `VITE_ADMIN_PASSWORD` dev escape hatch must survive
- `provider_token` capture and `fb_provider_token` localStorage backup must survive
- `checkSession()` on `INITIAL_SESSION` must survive

### T0-B — Supabase Client

| File | Law | Rationale |
|------|-----|-----------|
| `src/lib/supabase.ts` | **T0** | `createClient<Database>()`. PKCE flow config, custom retry fetch, all helpers (`logAuditEvent`, `subscribeToTable`, `getFacebookIdFromUserId`, etc.). See MAP §1.1.7. **Do not touch.** |

**Preserved invariants:**
- PKCE flow (`flowType: 'pkce'`)
- `fetchWithRetry` for `ERR_NETWORK_CHANGED`
- `localStorage` key `instagram-automation-auth`
- `logAuditEvent` → `audit_log` INSERT (all callers depend on this)
- `subscribeToTable` → typed Realtime subscription pattern
- `logApiRequest` → `api_usage` UPSERT (cost tracking)

### T0-C — Database Types (Generated)

| File | Law | Rationale |
|------|-----|-----------|
| `src/lib/database.types.ts` | **T0** | 87 KB generated file. All `Database['public']['Tables'][...]` types derive from this. **Never edit manually. Regenerate from Supabase if schema changes.** |
| `src/types/index.ts` | **T0** | Barrel re-export. Must re-export all existing paths to avoid breaking imports across T1/T2 files. |
| `src/types/agent-tables.ts` | **T0** | `AgentHeartbeat`, `AgentWritableTables`, all status unions, all JSONB Zod schemas. See MAP §1.4.3. **Authoritative agent domain types.** |
| `src/types/oversight.ts` | **T0** | SSE protocol types, `OversightSSEPayload`, type guards (`isAgentToken`, `isAgentDone`, `isAgentError`). See MAP §1.3.1. |
| `src/types/dashboard.ts` | **T0** | `DashboardData`, `Metric`, `Activity`, `RecentMedia`, `ChartPoint`. |
| `src/types/insights.ts` | **T0** | `InstagramInsight`, `AccountInsight` |
| `src/types/permissions.ts` | **T0** | `PagePermission`, `FeatureGate`. **NOTE:** Exports `InstagramMedia` — conflicts with `instagram-media.ts`. Do not re-export from `index.ts`. |
| `src/types/instagram-media.ts` | **T0** | Alternate `InstagramMedia` shape. **Not re-exported** (conflicts). |
| `src/types/ugc.ts` | **T0** | `UGCContent`, `UGCPermission`, `UGCQualityFactors` |
| `src/types/workflows.ts` | **T0** | `AutomationWorkflow`, `WorkflowExecution` |
| `src/config/instagramScopes.ts` | **T0** | `INSTAGRAM_OAUTH_SCOPES` constant. Used by `Login.tsx`. |

**Preserved invariants:**
- `AgentWritableTableName` = `keyof AGENT_WRITABLE_TABLES` — used as generic constraint in `AgentService.get<T>()`
- All Zod schemas (`safeParse` patterns) for runtime JSONB validation
- All status union types (`AgentHeartbeatStatus`, `ScheduledPostStatus`, etc.)

---

## Tier 1 — SYSTEM CONTRACTS

> **These survive exactly as-is. They are not frontend concerns. They are business
> contracts. The new frontend (Tauri) consumes them via Tauri IPC adapters.**

### T1-A — Heartbeat System

| File | Law | Rationale |
|------|-----|-----------|
| `src/hooks/useAgentHealth.ts` | **T1** | Three TanStack Queries (status, heartbeats, alerts) + Realtime channel. See MAP §1.2.2. **Sole consumer: `AgentTerminalDashboard`.** Contract: polls every 30 s, `agentStatus = 'alive' | 'down'` computed server-side. |
| `src/services/agentService.ts` (heartbeat methods) | **T1** | `getHeartbeats(limit)`, `getAgentStatus()`, `getSystemAlerts()`, `resolveAlert()`. See MAP §1.2.3. |

**Preserved contract:**
```
  Backend owns LIVENESS_THRESHOLD_MS.
  useAgentHealth polls GET /api/instagram/agent/status every 30s.
  Raw heartbeats table (agent_heartbeats) has NO business_account_id column.
  Realtime subscription on system_alerts INSERT + UPDATE.
  resolveAlert → UPDATE system_alerts SET resolved=true.
```

**What the Tauri adapter must implement:**
- Match the polling interval (30 s)
- Preserve the Realtime subscription pattern on `system_alerts`
- Preserve `agentStatus` as the single source of truth

### T1-B — SSE System (Oversight Chat Streaming)

| File | Law | Rationale |
|------|-----|-----------|
| `src/hooks/useOversightChat.ts` | **T1** | Manual `fetch` + `ReadableStream`. Double-newline splitting. Field-presence type guards. `AbortSignal.any([abort, timeout])`. See MAP §1.3.2. **Sole consumer: `AgentTerminalDashboard`.** |
| `src/hooks/useTerminalKeyboard.ts` | **T1** | Keyboard shortcuts (Ctrl+C, Ctrl+L, ArrowUp/Down, Escape). Persists command history to `localStorage['terminal-command-history']`. See MAP §1.5. |

**Preserved contract:**
```
  POST /api/instagram/oversight/chat
  Headers: text/event-stream, Cache-Control: no-cache no-transform, X-Accel-Buffering: no
  Payload: { business_account_id, user_id, question, chat_history, stream: true }
  Keep-alive: ': ping\n\n' — drop silently
  Token events: { token: string }
  Done signal: { done: true, latency_ms?, request_id? }
  Error: { error: string } OR { type: 'error', content: string }
  Dispatch by FIELD PRESENCE, not a discriminant
  MAX_STREAM_DURATION_MS = LIVENESS_THRESHOLD_MS * 5
  Cleanup: cancel reader, abort controller, prevent double-cleanup
  Persist user message to Supabase BEFORE opening stream
  Persist assistant message on 'done' OR stream error (partial)
  Command history: max 100, localStorage key 'terminal-command-history'
```

**What the Tauri adapter must implement:**
- SSE reader loop with chunk buffering
- `MAX_STREAM_DURATION_MS` timeout (`AbortSignal.timeout`)
- Field-presence type guards matching the four payload shapes
- `persistMessage` → `UPDATE oversight_chat_sessions SET messages = <new array>`
- `cleanedUp` flag pattern to prevent double-cleanup

### T1-C — Queue Contracts

| File | Law | Rationale |
|------|-----|-----------|
| `src/hooks/useQueueMonitor.ts` | **T1** | Single 15 s poll. `AgentService.getQueueOverview()` (200-row fetch) derives histogram + DLQ from same result. `retryQueueItem` mutation. See MAP §1.5. |
| `src/services/agentService.ts` (queue methods) | **T1** | `getQueueOverview()`, `retryQueueItem(queueId)` (POST to backend). |

**Preserved contract:**
```
  getQueueOverview: single 200-row scan of post_queue
  Derives: { byKey: Record<"action_type::status", count>, dlqItems, total, timestamp }
  retryQueueItem: POST /api/instagram/post-queue/retry
  Headers: Authorization: Bearer <session.access_token>
  Payload: { queue_id }
  Response: { queue_id, action_type, previous_retry_count, message }
  Optimistic cache update on retry success
```

### T1-D — Analytics Contracts

| File | Law | Rationale |
|------|-----|-----------|
| `src/hooks/useAnalyticsReports.ts` | **T1** | `AgentService.getAnalyticsReports(businessAccountId, reportType?, limit=30)` |
| `src/hooks/useContentAnalytics.ts` | **T1** | Aggregates from daily_analytics |
| `src/hooks/useRealtimeAnalytics` (realtimedata.ts) | **T1** | `daily_analytics` last 30 days + Realtime debounce 1 s |
| `src/services/agentService.ts` (analytics methods) | **T1** | `getAnalyticsReports()`, `getAttributionModel()` |

### T1-E — Agent Status Contracts

| File | Law | Rationale |
|------|-----|-----------|
| `src/hooks/useActivityFeed.ts` | **T1** | `AgentService.getAuditLog(50)` + Realtime INSERT on `audit_log`. Client-side filter on `details.business_account_id`. See MAP §1.5. |
| `src/hooks/useAttributionQueue.ts` | **T1** | `AgentService.getAttributionQueue()`, `reviewAttribution()` mutation |
| `src/hooks/useScheduledPosts.ts` | **T1** | `AgentService.getScheduledPosts()`, `updateScheduledPostStatus()` |
| `src/services/agentService.ts` (remaining methods) | **T1** | Attribution, scheduled posts, analytics, audit log |

---

## Tier 2 — INTEGRATION ADAPTERS

> **These survive but may be wrapped. The implementation survives.
> The consumption model changes. The Tauri app creates adapter wrappers.**

### T2-A — Realtime Hooks

| File | Law | Contract to preserve |
|------|-----|---------------------|
| `realtimedata.ts → useRealtimeWorkflows()` | **T2** | `automation_workflows` + Realtime `INSERT/UPDATE/DELETE` filtered by `user_id` |
| `realtimedata.ts → useRealtimeAnalytics(businessAccountId)` | **T2** | `daily_analytics` last 30 rows + Realtime INSERT debounced 1 s |
| `useComments(businessAccountId)` | **T2** | `instagram_comments` table + Realtime |
| `useDMInbox(businessAccountId)` | **T2** | `instagram_dm_conversations` + messages + Realtime |
| `useVisitorPosts(businessAccountId)` | **T2** | `ugc_content` table + Realtime |
| `useWorkflowExecutions(workflowId)` | **T2** | `workflow_executions` + Realtime |

### T2-B — Context Providers

| File | Law | Contract to preserve |
|------|-----|---------------------|
| `contexts/ToastContext.tsx` | **T2** | `toasts[]`, `history[]` (cap 20), `addToast`, `removeToast`, `clearToasts`, `clearHistory`. Per-id timer map. |
| `contexts/ModalContext.tsx` | **T2** | `openConfirm`, `openForm`, `close`, `isOpen`, `data`. Consumed by `useModal()`. |

### T2-C — Bridge Hooks

| File | Law | Rationale |
|------|-----|-----------|
| `hooks/useToast.ts` | **T2** | Thin bridge over `ToastContext`. Four helpers: `success`, `error`, `info`, `warning`. All callers must continue to work. |
| `hooks/useModal.ts` | **T2** | Thin bridge over `ModalContext`. `openConfirm`, `openForm`. All callers must continue to work. |
| `hooks/useAsyncState(fn, immediate)` | **T2** | Generic async state machine. `execute`, `reset`, `retry`. |
| `hooks/useLoadingDelay(ms)` | **T2** | For skeleton timing |
| `hooks/usePageTransition.ts` | **T2** | Route animation state |

### T2-D — Token / Auth Hooks

| File | Law | Rationale |
|------|-----|-----------|
| `hooks/useTokenStatus()` | **T2** | GET `${VITE_API_BASE_URL}/api/instagram/token-status`. Returns `{pat, uat}`. |
| `hooks/useTokenValidation()` | **T2** | Wraps `useTokenStatus`. Lazy validation on dashboard load. |
| `hooks/useDashboardData(businessAccountId?)` | **T2** | GET `/api/instagram/dashboard-stats/<id>`. Triggers background `/sync/posts`. See MAP §1.5. |

### T2-E — Instagram Data Hooks

| File | Law | Source |
|------|-----|--------|
| `useInstagramAccount()` | **T2** | `instagram_business_accounts` table |
| `useInstagramInsights(businessAccountId)` | **T2** | `instagram_insights` table + Realtime |
| `useInstagramProfile()` | **T2** | `instagram_business_accounts` row |

### T2-F — Service Modules

| File | Law | Contract |
|------|-----|---------|
| `services/databaseservices.ts` | **T2** | Typed CRUD for user_profiles, instagram_business_accounts, instagram_assets, instagram_comments. UUID validation pattern. |
| `services/dmService.ts` | **T2** | Instagram DM operations. Conversations + messages + window-status. |
| `services/consentService.ts` | **T2** | `user_consents` table operations. `recordConsent`, `revokeConsent`, `listConsents`. |
| `services/webhooks.ts` | **T2** | Cloudflare webhook self-tests. |
| `services/metaWebhooks.ts` | **T2** | `handleWebhookEvent(body: MetaWebhookBody): {status, processed}`. Counts events by type. |

---

## Tier 3 — PRESENTATION

> **This is where migration happens. Everything here can be replaced.**

### T3-A — Pages (Route-Mounted Screens)

| File | Migration Target? | Notes |
|------|-----------------|-------|
| `pages/Login.tsx` | **KEEP logic, REBUILD UI** | Auth flow logic must survive (§1.1.2). UI rebuildable. |
| `pages/AdminLogin.tsx` | **REPLACE** | Migrate to Svelte |
| `pages/FacebookCallback.tsx` | **KEEP logic, REBUILD UI** | OAuth protocol must survive (§1.1.3). UI rebuildable. |
| `pages/Dashboard.tsx` | **REPLACE** | Full migration to Svelte. Hooks replaced by Tauri IPC adapters. |
| `pages/Analytics.tsx` | **REPLACE** | |
| `pages/ContentManagement.tsx` | **REPLACE** | |
| `pages/EngagementMonitor.tsx` | **REPLACE** | |
| `pages/CommentManagement.tsx` | **REPLACE** | |
| `pages/ContentAnalytics.tsx` | **REPLACE** | |
| `pages/DMInbox.tsx` | **REPLACE** | |
| `pages/UGCManagement.tsx` | **REPLACE** | |
| `pages/Audience.tsx` | **REPLACE** | |
| `pages/PrivacyDashboard.tsx` | **REPLACE** | |
| `pages/Settings.tsx` | **REPLACE** | |
| `pages/AgentTerminal.tsx` | **REPLACE** | Terminal logic (useOversightChat, useQueueMonitor, useAgentHealth, useActivityFeed) stays in T1. UI replaces. |
| `pages/TestConnection.tsx` | **REPLACE** | Calls `testSupabaseConnection` — T2 adapter. |
| `pages/privacypolicy.tsx` | **REPLACE** | Static content from `content/legalcontent.ts` |
| `pages/TermsOfService.tsx` | **REPLACE** | |
| `pages/DataDeletion.tsx` | **REPLACE** | |
| *Inline in App.tsx:* `Engagement`, `CreatePost`, `Campaigns` | **REPLACE** | |

### T3-B — Layout

| File | Migration Target? | Notes |
|------|-----------------|-------|
| `components/layout/Layout.tsx` | **REBUILD** | App shell. Nav, header, search, Create CTA, terminal shortcut, notification dropdown, user menu, `<Outlet/>`. ⚠️ Logout button calls `navigate('/login')` directly — does NOT call `signOut()` — **known gap**. See MAP §7.3. |
| `components/layout/LegalFooter.tsx` | **REPLACE** | |
| `components/layout/MoreDropdown.tsx` | **REPLACE** | |
| `components/layout/NotificationDropdown.tsx` | **REPLACE** | Reads `ToastContext.history`. |
| `components/layout/RequireAuth.tsx` | **KEEP logic** | Auth guard. Logic must survive. Can be Svelte-ified. |

### T3-C — Dashboard Components

| File | Migration Target? | Data? |
|------|-----------------|-------|
| `components/dashboard/DashboardHeader.tsx` | **REPLACE** | NO — reads `useAuthStore.user.username` only |
| `components/dashboard/DashboardHeaderSkeleton.tsx` | **REPLACE** | NO |
| `components/dashboard/AnimatedMetricsGrid.tsx` | **REPLACE** | NO — animation wrapper |
| `components/dashboard/MetricsGridSkeleton.tsx` | **REPLACE** | NO |
| `components/dashboard/AnimatedActivityFeed.tsx` | **REPLACE** | NO |
| `components/dashboard/PerformanceChart.tsx` | **REPLACE** | NO |
| `components/dashboard/QuickActions.tsx` | **REPLACE** | Calls `useNavigate`, `useToast`, `useModal` |
| `components/dashboard/RecentMedia.tsx` | **REPLACE** | |
| `components/dashboard/TokenExpiredBanner.tsx` | **REPLACE** | |
| `components/dashboard/TokenWarningBanner.tsx` | **REPLACE** | |
| `components/dashboard/DashboardOverview.tsx` | **REPLACE** | **0-byte stub. Does not exist.** |
| `components/dashboard/MetricsOverviewPanel.tsx` | **REPLACE** | **Agent terminal panel — receives props, no data** |

### T3-D — Agent Terminal UI

| File | Migration Target? | Data? |
|------|-----------------|-------|
| `components/agent-terminal/AgentTerminalDashboard.tsx` | **REBUILD UI, KEEP HOOKS** | **MIXED** — Composes 4 T1 hooks. Uptime derives from heartbeats. These stay. UI rebuilds. |
| `components/agent-terminal/TerminalStatusBar.tsx` | **REPLACE** | NO — props only |
| `components/agent-terminal/TerminalInput.tsx` | **REPLACE** | NO — props only |
| `components/agent-terminal/TerminalScrollArea.tsx` | **REPLACE** | NO |
| `components/agent-terminal/SessionDropdown.tsx` | **REPLACE** | NO |
| `components/agent-terminal/ActivityFeedPanel.tsx` | **REPLACE** | NO — receives events array |
| `components/agent-terminal/QueueMonitorPanel.tsx` | **REPLACE** | NO — receives summary + dlqItems |
| `components/agent-terminal/MetricsOverviewPanel.tsx` | **REPLACE** | NO |
| `components/agent-terminal/AnimatedSpiralBackground.tsx` | **REPLACE** | NO — CSS animation |

### T3-E — Audience Components

| File | Migration Target? | Data? |
|------|-----------------|-------|
| `components/audience/AudienceDashboard.tsx` | **REBUILD UI, KEEP HOOKS** | **MIXED** — Uses `useInstagramAccount` + `useRealtimeAnalytics` (T2). |
| `components/audience/AudienceMetricCard.tsx` | **REPLACE** | NO — prop-driven |
| `components/audience/FollowerGrowthChart.tsx` | **REPLACE** | NO — prop-driven |
| `components/audience/DemographicsPlaceholder.tsx` | **REPLACE** | NO |

### T3-F — Settings Components

| File | Migration Target? |
|------|-----------------|
| `components/settings/AccountInfoSection.tsx` | **REPLACE** |
| `components/settings/ConnectionStatusSection.tsx` | **REPLACE** |
| `components/settings/DangerZoneSection.tsx` | **REPLACE** |
| `components/settings/ProfilePreviewSection.tsx` | **REPLACE** |
| `components/settings/TokenImportSection.tsx` | **REPLACE** |

### T3-G — Permissions Components (Phase 3)

| Directory | Migration Target? | Notes |
|----------|-----------------|-------|
| `components/permissions/CommentManagement/*` | **REPLACE** | `CommentInbox`, `CommentCard`, `CommentFilters`, `ReplyInterface`, `SentimentBadge` |
| `components/permissions/ContentAnalytics/*` | **REPLACE** | `ContentGrid`, `MediaCard`, `AnalyticsChart` |
| `components/permissions/ContentManagement/*` | **REPLACE** | `CreatePostModal` |
| `components/permissions/DMInbox/*` | **REPLACE** | `DMConversationList`, `MessageThread`, `WindowStatusIndicator` |
| `components/permissions/UGCManagement/*` | **REPLACE** | `VisitorPostInbox`, `VisitorPostCard`, `PermissionRequestModal`, `RepostConfirmationModal` |
| `components/permissions/InstagramProfile/*` | **REPLACE** | `InstagramProfileCard`, `ProfileStats` |
| `components/permissions/shared/*` | **REPLACE** | `FeatureHighlight`, `PermissionBadge`, `PolicyComplianceIndicator` |

### T3-H — Modals, Transitions, UI Primitives

| File | Migration Target? |
|------|-----------------|
| `components/modals/LinkAccountModal.tsx` | **REPLACE** |
| `components/modals/index.ts` | **REPLACE** |
| `components/transitions/PageTransition.tsx` | **REPLACE** |
| `components/transitions/RouteAnimationProvider.tsx` | **REPLACE** |
| `components/ui/AnimatedButton.tsx` | **REPLACE** |
| `components/ui/AnimatedCard.tsx` | **REPLACE** |
| `components/ui/AsyncWrapper.tsx` | **REPLACE** |
| `components/ui/ConfirmModal.tsx` | **REPLACE** |
| `components/ui/CountUpAnimation.tsx` | **REPLACE** |
| `components/ui/FormModal.tsx` | **REPLACE** |
| `components/ui/FormSkeleton.tsx` | **REPLACE** |
| `components/ui/LoadingButton.tsx` | **REPLACE** |
| `components/ui/LoadingSpinner.tsx` | **REPLACE** |
| `components/ui/Modal.tsx` | **REPLACE** |
| `components/ui/ProgressAnimation.tsx` | **REPLACE** |
| `components/ui/ScrollAnimations.tsx` | **REPLACE** |
| `components/ui/Skeleton.tsx` | **REPLACE** |
| `components/ui/SkeletonCard.tsx` | **REPLACE** |
| `components/ui/SkeletonFeed.tsx` | **REPLACE** |
| `components/ui/SkeletonMediaGrid.tsx` | **REPLACE** |
| `components/ui/TableSkeleton.tsx` | **REPLACE** |
| `components/ui/Toast.tsx` | **REPLACE** |
| `components/ui/ToastContainer.tsx` | **REPLACE** |
| `components/ui/metric-card.tsx` | **REPLACE** |
| `components/ui/StatusCard.tsx` | **REPLACE** | **0-byte stub. Does not exist.** |
| `components/ErrorBoundary.tsx` | **REBUILD** | Error boundary logic survives. Can be Svelte-ified. |

### T3-I — Content and Styles

| File | Migration Target? | Notes |
|------|-----------------|-------|
| `content/legalcontent.ts` | **MIGRATE** | Static copy for privacy/toS/data-deletion pages. Must survive migration. |
| `styles/terminal.css` | **MIGRATE** | CSS custom properties for agent terminal theme. Must survive as reference for T4 design system. |
| `index.css` | **REPLACE** | Tailwind + glass-morphism utilities. Design system replaces. |

---

## Tier 4 — DESIGN SYSTEM

> **Greenfield. Does not exist yet. Created as part of the Tauri build.**

### T4-A — Theme Foundation

| Deliverable | Spec |
|-------------|------|
| **White / Gold theme** | Tauri desktop aesthetic. Not in codebase yet. |
| **ASCII Panels** | Terminal-surface panels using ASCII box-drawing characters. See `styles/terminal.css` for variable names to port. |
| **Observability Shell** | Desktop chrome for health, queue, alerts. |
| **Navigation System** | Desktop sidebar nav. `Layout.tsx` pattern to port. |
| **Command Palette** | Tauri command palette plugin integration. |
| **Topology Views** | Visual maps of agent/queue state. |

### T4-B — Design Tokens to Port from Current System

```css
/* From styles/terminal.css — port to T4 token system */
--terminal-bg, --terminal-fg, --terminal-green,
--terminal-cyan, --terminal-yellow, --terminal-red,
--terminal-dim, --terminal-border

/* From index.css — glass-morphism utilities */
.glass-morphism-card  /* backdrop-blur + bg-white/10 + border-white/20 */
```

---

## Non-File Artifacts

| File | Tier | Notes |
|------|------|-------|
| `.env.production` | **T0** | Env var config. Not a source file. Reference only. |
| `.env.agent.example` | **T0** | Env var reference. |
| `ARCHITECTURE_MAP.md` | **REFERENCE (ARCHIVED)** | Full architecture breakdown captured prior to runtime construction. Moved to `runtime/archive/ARCHITECTURE_MAP.md`. Companion to this document. |
| `vite.config.ts` | **REPLACE** | Vite-specific. Tauri replaces bundler. |
| `tailwind.config.js` | **REPLACE** | Tailwind-specific. Design system replaces. |
| `eslint.config.js` | **ADAPT** | ESLint config. Port rules, drop Vite-specific plugins. |
| `tsconfig.*.json` | **ADAPT** | TSConfig. Port paths (`@/types`, `@/hooks`, etc.) to new project. |
| `sw.js` | **REPLACE** | Service worker. Tauri service worker (if needed) replaces. |
| `public/*` | **MIGRATE** | Static assets. Favicons, etc. |
| `Dockerfile`, `nginx.conf` | **ADAPT** | Docker. May still apply for backend. |

---

## Preservation Checklist

Before any migration commit, verify:

- [ ] `src/types/index.ts` barrel re-exports unchanged (breaking T2 imports otherwise)
- [ ] `AGENT_WRITABLE_TABLES` registry unchanged (generic constraint on `AgentService.get<T>()`)
- [ ] All Zod schemas in `agent-tables.ts` unchanged (runtime validation on JSONB columns)
- [ ] `authStore` `partialize` list unchanged (persistence contract)
- [ ] `supabase.ts` helpers (`logAuditEvent`, `subscribeToTable`, `logApiRequest`) unchanged
- [ ] `INSTAGRAM_OAUTH_SCOPES` unchanged (used by Login and FacebookCallback)
- [ ] `LIVENESS_THRESHOLD_MS` exported from `useAgentHealth` (imported by `useOversightChat`)

---

## Sign-off

```
Domain Preservation Law 001 — In Force
instagram-automation-dashboard / wt-627425ab
Effective: 2026-06-16

Tier 0 (Auth · Supabase · Types):   DO NOT TOUCH
Tier 1 (Heartbeats · SSE · Queue): DO NOT TOUCH
Tier 2 (Hooks · Contexts):         WRAP ONLY
Tier 3 (Pages · Components):        REPLACE
Tier 4 (Design System):             GREENFIELD

Law 001 is non-negotiable.
All subsequent contracts are subordinate to this document.
```
