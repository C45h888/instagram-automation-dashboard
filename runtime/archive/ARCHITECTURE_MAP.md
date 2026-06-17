# Repository Architectural Map
**Repo:** `instagram-automation-dashboard` (worktree `wt-627425ab`)
**Stack:** React 18 + TypeScript + Vite + TanStack Query v5 + Zustand + Supabase + Express (backend, `/api/instagram/*`)
**Generated:** 2026-06-16

> This document maps the **entire frontend** in two top-level divisions, then sub-divides each per the requested taxonomy.

---

## 0. Top-Level Layout

```
src/
├── App.tsx                      # Router root (eager + lazy routes)
├── main.tsx                     # createRoot + StrictMode
├── index.css                    # Tailwind + glass-morphism + terminal CSS vars
├── components/                  # All UI (see §3)
├── pages/                       # Route-mounted screens (see §2)
├── hooks/                       # 25 hooks (data + interaction)
├── stores/authStore.ts          # Zustand auth (login utility)
├── services/                    # 6 service modules (Supabase + fetch)
├── types/                       # TS foundation (8 files, see §1.4)
├── lib/
│   ├── supabase.ts              # Typed Supabase client + helpers
│   └── database.types.ts        # GENERATED Database types
├── contexts/                    # ToastContext, ModalContext
├── config/instagramScopes.ts    # OAuth scope list
├── content/legalcontent.ts      # Static legal copy
└── styles/terminal.css          # Terminal-themed CSS
```

---

# 1. UTILITY LAYER  ← the heartbeats, SSE, Login, and TS foundation

This is the **cross-cutting utility substrate**. Every component/page reads from or writes to one of these.

---

## 1.1 Login System (Auth Utility)

### 1.1.1 `src/stores/authStore.ts` (Zustand + persist + devtools)
Central auth state. 849 lines. Exposes a `useAuthStore` hook plus `useIsAuthenticated`, `useIsAdmin`, `useCurrentUser`.

**State properties** (`AuthStateProperties`):
| Field | Type | Persisted? | Source |
|---|---|---|---|
| `user` | `User \| null` | ✅ | `mapToUser()` from Supabase + profile rows |
| `token` | `string \| null` | ✅ | Session access token (legacy) |
| `session` | `Session \| null` | ❌ transient | `supabase.auth.getSession()` |
| `isAuthenticated` | `boolean` | ✅ | derived |
| `isAdmin` | `boolean` | ✅ | `role === 'admin' \| 'super_admin'` |
| `isLoading` | `boolean` | ❌ | action lifetime |
| `permissions` | `string[]` | ✅ | admin_users.permissions or default set |
| `error` | `string \| null` | ❌ | last error |
| `businessAccountId` | `string \| null` | ✅ (Phase 3.5) | from `/exchange-token` |
| `instagramBusinessId` | `string \| null` | ✅ | numeric IG id |
| `pageId`, `pageName` | `string \| null` | ✅ | FB Page linkage |
| `providerToken` | `string \| null` | ❌ | OAuth provider_token (not persisted by design) |

**Actions**:
- `login(user, token)` — legacy, used by `Login.tsx` mock + `FacebookCallback.tsx`
- `adminLogin(user, token)` — legacy, used by `AdminLogin.tsx`
- `logout()` → `signOut()`
- `refreshToken(token)` — legacy shim
- `updateUser(updates)` — partial user merge
- `checkAdminAccess()` — returns true if admin role
- `signInWithEmail(email, password)` — modern Supabase email/password, fetches `user_profiles` row, calls `logAuditEvent('user_login', 'success'|'failed', {email, error?})`, updates `last_active_at`
- `signInAsAdmin(email, password)` — verifies against `admin_users` table (is_active=true), has dev escape hatch when `VITE_ADMIN_EMAIL`/`VITE_ADMIN_PASSWORD` match (creates a `mockAdmin` with id `admin-dev-001`), increments `login_attempts` on failure
- `signOut()` — logs audit, calls `supabase.auth.signOut()`, clears `auth-storage` + `fb_provider_token` from localStorage, redirects `/login`
- `checkSession()` — called on app init; fetches `user_profiles` + `admin_users`, calls `mapToUser`
- `createTestUser()` — dev-only `signUp` helper
- `clearError()`
- `setBusinessAccount({ businessAccountId, instagramBusinessId, pageId, pageName })` — Phase 3.5

**Helpers (file-private)**:
- `getUsernameFromEmail(email)` — fallback `'user'`
- `formatUsername(fullName)` — lower + underscore
- `getPermissions(perms)` — type guard, default `['dashboard', 'content', 'engagement', 'analytics', 'settings']`
- `mapToUser(supabaseUser, profile, adminProfile?)` — single source of truth for the legacy `User` shape

**Module-level side effect** (line 743): `supabase.auth.onAuthStateChange(...)` listener dispatches on:
- `INITIAL_SESSION` — capture `provider_token`, call `checkSession()`
- `SIGNED_IN` — capture `provider_token`, mirror to `localStorage['fb_provider_token']`, `checkSession()`
- `SIGNED_OUT` — clear all auth state and localStorage key
- `TOKEN_REFRESHED` — refresh `session` + `token` (provider_token NOT refreshed)
- `USER_UPDATED` — re-check session

**Persistence**: `partialize` returns `PersistedAuthState` (explicit subset: user, token, isAuthenticated, isAdmin, permissions, businessAccountId, instagramBusinessId, pageId, pageName). Storage key: `auth-storage`.

### 1.1.2 `src/pages/Login.tsx` (1,057 lines)
Public login screen. Branches on `VITE_AUTH_MODE`: `'facebook' | 'instagram' | 'both'`.

**Key functions**:
- `logConsent()` — fetches IP via `https://api.ipify.org`, builds consent object (`consent_type: 'instagram_oauth'`, `consent_given: true`, `ip_address`, `user_agent`, `privacy_policy_version: '2.0'`, `terms_version: '2.0'`, `consented_at`), stores in `sessionStorage['pendingConsent']`
- `persistStoredConsent(userId: string)` — UUID-validates first, retrieves from session, INSERTs into `user_consents`, clears session key, stores returned consent id
- `completeHandshake(providerToken, userId)` — POSTs to `${VITE_API_BASE_URL}/api/instagram/exchange-token` with `{userAccessToken, userId}` (no businessAccountId sent — backend discovers it), then calls `setBusinessAccount(...)`
- `handleInstagramLogin()` — gates on `consentGiven`, calls `logConsent()`, then dev-only mock login (production awaits Meta API approval)
- `handleFacebookLogin()` — gates on `consentGiven`, calls `logConsent()`, then `supabase.auth.signInWithOAuth({ provider: 'facebook', options: { redirectTo: '/auth/callback', scopes: INSTAGRAM_OAUTH_SCOPES, queryParams: { auth_type: 'rerequest' } } })`

**UI surface**: consent checkbox (un-checked by default — GDPR), permission accordion (4 sections: basic profile, comments, insights, DM), 2-column grid for buttons, hidden admin link.

### 1.1.3 `src/pages/FacebookCallback.tsx` (383 lines)
OAuth redirect handler. Runs `handleOAuthCallback` in `useEffect`.

**Flow**:
1. `supabase.auth.getSession()` — Supabase auto-extracts hash
2. Extract `session.provider_token` (Facebook user access token) + `session.user.id` (UUID)
3. POST `${VITE_API_BASE_URL}/api/instagram/exchange-token` `{userAccessToken, userId}`
4. If `exchangeResult.requiresSelection === true` → set `pendingPages` → render `<PagePickerModal />` → user picks → second POST with `{userId, selectedPage}`
5. **Scope validation** (Phase 2 fix): fetches `https://graph.facebook.com/v22.0/me/permissions?access_token=...`, filters `status === 'granted'`, compares against required core scopes (`instagram_basic`, `pages_show_list`, `business_management`, `pages_manage_metadata`, `instagram_manage_insights`, `pages_read_engagement`), logs but does NOT block on missing
6. `setBusinessAccount(...)` then `login(user, access_token)`
7. Persists `user_consents` from `sessionStorage['pendingConsent']`
8. Navigates `/dashboard`

**Exposes**: `handlePageSelect(selectedPage: PageOption)` for the picker flow.

### 1.1.4 `src/pages/AdminLogin.tsx` (12,769 bytes)
Parallel flow for admin users. Same pattern: consent gate → `signInAsAdmin` → token exchange → redirect.

### 1.1.5 `src/components/auth/PagePickerModal.tsx` (1,744 bytes)
Renders a list of `PageOption`s (FB Pages with linked IG Business accounts) when a user has multiple. Receives `onSelect(PageOption)` callback from `FacebookCallback`.

### 1.1.6 `src/components/layout/RequireAuth.tsx` (29 lines)
Route guard. Reads `isAuthenticated` from `useAuthStore`. If `undefined` → spinner. If `false` → `<Navigate to="/login" state={{from: location}} replace />`. Otherwise renders children. Used as wrapper for `/` in `App.tsx`.

### 1.1.7 `src/lib/supabase.ts` (501 lines) — `createClient<Database>(...)`
Env-driven. Throws hard if `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` missing.
- `auth`: PKCE flow, `autoRefreshToken`, `persistSession`, `detectSessionInUrl`, storage key `instagram-automation-auth`
- `realtime`: `eventsPerSecond: 10`
- `global.fetch = fetchWithRetry` — custom 3-attempt exponential backoff for `ERR_NETWORK_CHANGED` / `Failed to fetch`
- Custom headers: `X-Client-Info`, `X-Client-Version`, `X-Client-Platform`

**Helpers exported**:
- `testSupabaseConnection()` → `ConnectionTestResult` (latency, tunnel detection)
- `logAuditEvent(eventType, action, details?, options?)` — INSERT into `audit_log` with `ip_address: 'web-client'`, `user_agent: navigator.userAgent`
- `getCurrentUser()`, `getCurrentSession()`, `getUserProfile(userId)`
- `subscribeToTable<T>(table, callback, filter?, options?)` — typed `postgres_changes` subscription, returns `{unsubscribe}`; status callback dispatches `onConnect` / `onError` / `onDisconnect`
- `subscribeToUserWorkflows(userId, callback)`, `subscribeToWorkflowExecutions(workflowId, callback)`
- `checkUserRole(userId, requiredRole)`, `isUserAdmin`, `isUserSuperAdmin` — role hierarchy `user < admin < super_admin`
- `logApiRequest(endpoint, method, responseTimeMs, statusCode, success, errorMessage?)` — UPSERT into `api_usage` keyed on `(user_id, business_account_id, endpoint, method, hour_bucket)`
- `getFacebookIdFromUserId`, `getUserIdFromFacebookId` — dual-ID mapping
- Type guards: `isUserProfile`, `isAdminUser`, `isWorkflow`

---

## 1.2 Heartbeat System

### 1.2.1 DB shape (from `src/lib/database.types.ts` → `Database['public']['Tables']['agent_heartbeats']`)
A single liveness record per agent run. Note: **has no `business_account_id` column** — global.

### 1.2.2 `src/hooks/useAgentHealth.ts` (175 lines) — three TanStack Queries + 1 Realtime channel

| Query key | Source | Polling | Purpose |
|---|---|---|---|
| `['agent-health','status']` | `AgentService.getAgentStatus()` → backend `GET /api/instagram/agent/status` | 30 s | Single source of truth: `AgentHeartbeatStatus = 'alive' \| 'down'` (computed server-side) |
| `['agent-health','raw-heartbeats']` | `AgentService.getHeartbeats(5)` → Supabase `agent_heartbeats` | 30 s | Legacy — used by `AgentTerminalDashboard` to derive uptime from `oldest.last_beat_at` |
| `['agent-health','alerts', businessAccountId]` | `AgentService.getSystemAlerts(biz, false)` | 30 s, enabled when biz present | Unresolved `system_alerts` rows |

`POLL_INTERVAL_MS = 30_000`. Retry: 3 attempts, exponential backoff capped at 30 s. `refetchOnWindowFocus: false`.

**Realtime subscription** (`system-alerts-live` channel): listens to `system_alerts` `INSERT` + `UPDATE` filtered by `business_account_id`, mutates query cache directly (no refetch).

**Actions**:
- `resolveAlert(alertId)` — `AgentService.resolveAlert()` then optimistic cache filter
- `refetch()` — re-fires all three queries

**Exports**: `UseAgentHealthResult { heartbeats, alerts, agentStatus, isLoading, error, resolveAlert, refetch }`
**Also exports**: `LIVENESS_THRESHOLD_MS = 25 * 60 * 1000` (deprecated, backend now owns this)

### 1.2.3 `src/services/agentService.ts` (489 lines) — `AgentService` class

Methods relevant to heartbeats:
- `getHeartbeats(limit = 5)` — `supabase.from('agent_heartbeats').select('*').order('last_beat_at', ascending:false).limit(limit)`. Returns `ServiceListResponse<AgentHeartbeat>`.
- `getAgentStatus()` — fetch `${VITE_API_BASE_URL}/api/instagram/agent/status` with `Authorization: Bearer <session.access_token>` header. Returns `{ status: AgentHeartbeatStatus, last_beat_at, agent_id }`.
- `getSystemAlerts(businessAccountId, resolved = false)` — UUID-validated, filters by biz + resolved flag
- `resolveAlert(alertId)` — UUID-validated UPDATE setting `resolved: true, resolved_at: <now>`

**Generic query method** (used for the other agent tables):
- `get<T extends AgentWritableTableName>(table, businessAccountId, {limit, orderBy, filters?})` — typed against `AGENT_WRITABLE_TABLES` registry; UUID guard; returns `ServiceListResponse<unknown>` with `count`.

**Other AgentService methods** (not heartbeat, listed for completeness):
- `getScheduledPosts`, `updateScheduledPostStatus`
- `getAttributionQueue`, `reviewAttribution`
- `getAttributionModel`
- `getAnalyticsReports(reportType?, limit=30)`
- `getQueueOverview()` — single 200-row fetch from `post_queue`, derives `byKey` histogram + `dlqItems` from same result
- `retryQueueItem(queueId)` — POST `/api/instagram/post-queue/retry` with bearer
- `getAuditLog(limit = 50)` — from `audit_log` table

---

## 1.3 SSE System (Oversight Chat Streaming)

### 1.3.1 Wire contract (`src/types/oversight.ts` — 128 lines)
Backend route: **`POST ${VITE_API_BASE_URL}/api/instagram/oversight/chat`**

**Wire types** (the SSE contract is identified by field PRESENCE, not a discriminant):
| Payload shape | Identifying key | Hook handler |
|---|---|---|
| `{ token: string }` | `'token' in p` | `isAgentToken` → append to `streamBuffer` |
| `{ done: true, latency_ms?, request_id? }` | `'done' in p && p.done === true` | `isAgentDone` → persist + cleanup |
| `{ error: string, message? }` | `'error' in p` | `isAgentError` → persist partial + set error |
| `{ type: 'error', content: string }` | `payload.type === 'error'` (backend wrapper) | same error branch |

Keep-alive: `': ping\n\n'` (SSE comment, no `data:` line) — dropped silently.
Headers expected: `text/event-stream; charset=utf-8`, `Cache-Control: no-cache,no-transform`, `X-Accel-Buffering: no`.

**Type guards exported**:
- `isAgentToken(p)`, `isAgentDone(p)`, `isAgentError(p)`, `getSSEErrorMessage(p)`

**Other exports**:
- `OversightSession` = row of `oversight_chat_sessions`
- `OversightMessage` interface + `OversightMessageSchema` (Zod) + `OversightMessagesArraySchema`
- `OversightChatState` interface

### 1.3.2 `src/hooks/useOversightChat.ts` (420 lines) — `useOversightChat(businessAccountId)`
The sole SSE consumer. Uses raw `fetch` + `ReadableStream` (NOT TanStack Query — manual stream management required).

**Constants**:
- `MAX_STREAM_DURATION_MS = LIVENESS_THRESHOLD_MS * 5` (≈ 125 minutes) — safety timeout

**State** (`useState`):
- `sessions: OversightSession[]` (latest 5)
- `activeSession: OversightSession | null`
- `messages: OversightMessage[]`
- `isStreaming: boolean`
- `streamBuffer: string`
- `error: string | null`

**Refs**:
- `abortRef: AbortController | null`
- `readerRef: ReadableStreamDefaultReader<Uint8Array> | null`
- `lineBuffer: string` — handles partial-line carry across chunks
- `cleanedUp: boolean` — prevents double cleanup

**Effects / callbacks**:
- **Session load** — on mount or `businessAccountId`/`userId` change: SELECT from `oversight_chat_sessions` `where business_account_id = X order by created_at desc limit 5`; auto-select most recent; if none exists, INSERT new row with `messages: []`
- **Message parse** — on `[activeSession]` change, `OversightMessagesArraySchema.safeParse(activeSession.messages)` (Zod)
- `cleanup()` — cancel reader, abort controller, clear `lineBuffer`, set `isStreaming=false`; guarded by `cleanedUp` flag
- `parseSSEEvent(raw: string): OversightSSEPayload | null` — splits on `\n`, picks `data:` line, `JSON.parse`, returns null on malformed
- `persistMessage(sessionId, fullContent, incomplete = false)` — appends `{role:'assistant', content, timestamp, ...(incomplete && {incomplete:true})}` to `messages`, fires `UPDATE oversight_chat_sessions SET messages = <new array> WHERE id = <id>`. Intentionally does NOT call `setActiveSession` (would re-trigger the parse effect and wipe)
- `readStream(reader, sessionId)` — `TextDecoder` + double-newline splitting + drop `:`-prefixed comments + `event: ` extraction (defaults to `'message'`) + skip `event: ping` + dispatch by event type with payload-shape fallback; persists + cleans up on `done` / `error` / abort
- `startSession()` — UPDATE all existing sessions `is_active=false`, INSERT new row `is_active=true`, prepend to local list (max 5)
- `selectSession(sessionId)` — find in local list, set active, clear buffer
- `sendMessage(question)` — appends user message, persists it, opens SSE stream:
  - `setIsStreaming(true)`, `cleanedUp.current = false`, `lineBuffer.current = ''`
  - `AbortSignal.timeout(MAX_STREAM_DURATION_MS)` combined with user abort via `AbortSignal.any([...])`
  - POST to `/api/instagram/oversight/chat` with `{ business_account_id, user_id, question, chat_history: updatedMessages, stream: true }`
  - `res.body.getReader()` → `readStream(reader, activeSession.id)`
  - Errors: if not abort, set `error`; cleanup either way
- `closeStream()` → `cleanup()`
- Unmount effect: `() => cleanup()`

**Returns** `UseOversightChatResult { sessions, activeSession, messages, isStreaming, streamBuffer, error, startSession, sendMessage, selectSession, closeStream }`

### 1.3.3 Consumers
- `src/components/agent-terminal/AgentTerminalDashboard.tsx` — center panel "Oversight Chat", uses every field of the result
- `src/hooks/useTerminalKeyboard.ts` — Ctrl+C → `closeStream`, Ctrl+L → clear screen (re-select session), ArrowUp/Down → command history (max 100, persisted to `localStorage['terminal-command-history']`)

---

## 1.4 TypeScript Foundation (Data Shape)

### 1.4.1 `src/lib/database.types.ts` (87 KB — generated)
The single source of `Database` interface. All table Row/Insert/Update/Relationships derived from this. Re-exported via `src/lib/supabase.ts`.

### 1.4.2 `src/types/index.ts` (barrel export)
Re-exports:
- `./agent-tables` (new domain — see 1.4.3)
- `./workflows`
- `./oversight`
- `./ugc`
- `./dashboard`
- `./insights`

NOTE: `./permissions` and `./instagram-media` are **not** re-exported (both export `InstagramMedia` with different shapes). Direct imports required.

### 1.4.3 `src/types/agent-tables.ts` (559 lines) — the TS foundation for the agent domain
Organized in 5 sections:

**A. Row type aliases** (all from `database.types`):
- `AgentHeartbeat`, `AgentComment`, `AgentDMConversation`, `AgentDMMessage`
- `AgentAsset`, `ScheduledPost` (+ `Insert`/`Update`)
- `SalesAttribution`, `AttributionReview` (+ `Update`), `AttributionModel`
- `AnalyticsReport`, `AuditLogEntry`, `OutboundQueueJob`
- `AgentAccountUpdate` (Pick subset for DLQ)
- `SystemAlert`
- (UGC types live in `ugc.ts`)

**B. Status union types**:
- `AgentHeartbeatStatus = 'alive' | 'down'`
- `ScheduledPostStatus` (6 states: `pending → approved → publishing → published`, with `rejected`/`failed` branches)
- `AttributionReviewStatus = 'pending' | 'approved' | 'rejected'`
- `QueueJobStatus`, `QueueJobPriority`, `PostQueueStatus`
- `PostQueueActionType` (5 types: `reply_comment | reply_dm | send_dm | publish_post | repost_ugc`)
- `SystemAlertType` (5 categories)
- `CommentSentiment`, `CommentPriority`
- `ErrorCategory` (5 categories from `categorizeIgError`)
- `ReportType = 'daily' | 'weekly'`
- `AgentType = Database['public']['Enums']['automation_type']`

**C. JSONB interfaces + Zod schemas** — pattern: TS interface for compile-time, Zod for runtime after DB read:
- `AttributionModelWeights` + schema
- `AttributionPerformanceMetrics` + schema
- `AgentModifications` (caption/hook/body/cta/hashtags + `reason` required) + schema
- `PostSelectionFactors` (5 0-100 scores) + schema
- `InstagramReportMetrics`, `MediaReportMetrics`, `RevenueReportMetrics` (all looseObject)
- `ReportInsights`, `HistoricalComparison`
- `UGCQualityFactors`
- `AttributionModelScores`, `AttributionJourneyEvent`/`Timeline`
- `SystemAlertDetails` (passthrough), `AuditLogDetails` (passthrough)

**D. AgentWritableTables registry**:
```ts
AGENT_WRITABLE_TABLES = {
  instagram_comments:          { ops: ['UPDATE','UPSERT'], triggers: ['engagement_monitor','webhook'] },
  instagram_dm_conversations:  { ops: ['UPSERT'],          triggers: ['dm_webhook','live_fetch_fallback'] },
  instagram_dm_messages:       { ops: ['UPSERT'],          triggers: ['live_fetch_fallback'] },
  instagram_assets:            { ops: ['UPDATE'],          triggers: ['content_scheduler'] },
  scheduled_posts:             { ops: ['INSERT','UPDATE'], triggers: ['content_scheduler'] },
  ugc_content:                 { ops: ['UPSERT'],          triggers: ['ugc_discovery'] },
  ugc_permissions:             { ops: ['INSERT','UPDATE'], triggers: ['ugc_discovery'] },
  sales_attributions:          { ops: ['INSERT'],          triggers: ['order_webhook'] },
  attribution_review_queue:    { ops: ['INSERT'],          triggers: ['order_webhook'] },
  attribution_models:          { ops: ['UPSERT'],          triggers: ['weekly_learning'] },
  analytics_reports:           { ops: ['UPSERT'],          triggers: ['analytics_scheduler'] },
  audit_log:                   { ops: ['INSERT'],          triggers: ['universal_audit'] },
  outbound_queue_jobs:         { ops: ['INSERT','UPDATE'], triggers: ['queue_worker'] },
  instagram_business_accounts: { ops: ['UPDATE'],          triggers: ['queue_dlq'] },
  system_alerts:               { ops: ['INSERT'],          triggers: ['error_handling'] },
}
```
`AgentWritableTableName` = `keyof typeof AGENT_WRITABLE_TABLES` — used as generic constraint on `AgentService.get<T>()`.
`AgentWriteOperation = 'INSERT' | 'UPDATE' | 'UPSERT'`
`AgentTrigger` = union of trigger values

**E. Filter states + defaults**:
- `ScheduledPostFilterState` + `DEFAULT_SCHEDULED_POST_FILTERS`
- `AlertFilterState` + `DEFAULT_ALERT_FILTERS`
- `AttributionFilterState` + `DEFAULT_ATTRIBUTION_FILTERS`

**Queue types**:
- `QueueStatusSummary` (`byKey`, `total`, `timestamp`)
- `QueueDLQItem`
- `QueueOverview` (combined: histogram + DLQ from single fetch)
- `QueueRetryResult`

### 1.4.4 Other type modules
| File | Purpose |
|---|---|
| `src/types/oversight.ts` | SSE protocol (see §1.3.1) |
| `src/types/dashboard.ts` | `DashboardData`, `Metric`, `Activity`, `RecentMedia`, `ChartPoint` |
| `src/types/insights.ts` | `InstagramInsight`, `AccountInsight`, aggregates |
| `src/types/permissions.ts` | `PagePermission`, `FeatureGate`, `InstagramMedia` (legacy shape) |
| `src/types/instagram-media.ts` | `InstagramMedia` (new shape — **not re-exported**) |
| `src/types/ugc.ts` | `UGCContent`, `UGCPermission`, `UGCQualityFactors` (re-exported) |
| `src/types/workflows.ts` | `AutomationWorkflow`, `WorkflowExecution`, status unions |

---

## 1.5 Other Utility Hooks (data layer shared by many pages)

| Hook | Polling / Source | Returns |
|---|---|---|
| `realtimedata.ts → useRealtimeWorkflows()` | Supabase `automation_workflows` + Realtime `INSERT/UPDATE/DELETE` filtered by `user_id` | `{workflows, loading, error, refetch}` |
| `useRealtimeAnalytics(businessAccountId)` | `daily_analytics` last 30 days + Realtime (debounced 1s) | `{analytics, summary, loading}` |
| `useActivityFeed(businessAccountId)` | `AgentService.getAuditLog(50)` + Realtime `INSERT` on `audit_log` (client-side filter on `details.business_account_id`) | `{events, isLoading, error, refetch}` |
| `useAgentHealth(businessAccountId)` | See §1.2.2 | heartbeat data |
| `useAnalyticsReports(businessAccountId, reportType?)` | `AgentService.getAnalyticsReports` | reports |
| `useAttributionQueue(businessAccountId, reviewStatus?)` | `AgentService.getAttributionQueue` + `reviewAttribution` mutation | queue data |
| `useComments(businessAccountId)` | `instagram_comments` + Realtime | comments |
| `useContentAnalytics(businessAccountId)` | aggregates from daily_analytics | analytics |
| `useDMInbox(businessAccountId)` | `instagram_dm_conversations` + messages + Realtime | threads |
| `useDashboardData(businessAccountId?)` | `${VITE_API_BASE_URL}/api/instagram/dashboard-stats/<id>` + triggers `/sync/posts` | `{metrics, activities, recentMedia, chartData, isLoading, error, lastUpdated}` |
| `useInstagramAccount()` | Supabase `instagram_business_accounts` | accounts |
| `useInstagramInsights(businessAccountId)` | `instagram_insights` + Realtime | insights |
| `useInstagramProfile()` | `instagram_business_accounts` row | profile |
| `useQueueMonitor()` | `AgentService.getQueueOverview()` polled 15s + `retryQueueItem` mutation | summary + DLQ |
| `useScheduledPosts(businessAccountId, status?)` | `AgentService.getScheduledPosts` | posts |
| `useTokenStatus()` | `${VITE_API_BASE_URL}/api/instagram/token-status?userId&business_account_id` | `{pat, uat, isLoading, error, refetch}` |
| `useTokenValidation()` | same endpoint + refresh mutation | `{isExpired, expirationDetails, refreshToken, isRefreshing}` |
| `useVisitorPosts(businessAccountId)` | `ugc_content` + Realtime | UGC posts |
| `useWorkflowExecutions(workflowId)` | `workflow_executions` + Realtime | executions |
| `useLoadingDelay(ms)` | local hook | for skeleton timing |
| `useModal()` | thin wrapper over `ModalContext` | `{openConfirm, openForm, close, isOpen, data}` |
| `useToast()` | thin wrapper over `ToastContext` (4 helpers) | `{success, error, info, warning}` |
| `useAsyncState(asyncFn, immediate)` | generic local async state | `{data, loading, error, execute, reset, retry}` |
| `usePageTransition()` | route animation hook | transition state |
| `useTerminalKeyboard(opts)` | window keydown listener | `{register, historyUp/Down, addToHistory}` |
| `useOversightChat(businessAccountId)` | See §1.3.2 | SSE chat |
| `useQueueMonitor()` | See above | queue |

---

# 2. PAGES  (route-mounted screens, organized by data source)

Pages that have data dependencies are listed with the hooks / services they consume.

### 2.1 `pages/Login.tsx` — public, no data
- Uses: `useAuthStore.login`, `setBusinessAccount`, `supabase.auth.signInWithOAuth`, `INSTAGRAM_OAUTH_SCOPES`, IP via `api.ipify.org`
- Standalone utility page; no hooks

### 2.2 `pages/AdminLogin.tsx` — public, no data
- Uses: `useAuthStore.signInAsAdmin`, `VITE_ADMIN_EMAIL/PASSWORD` dev shim
- Standalone

### 2.3 `pages/FacebookCallback.tsx` — public callback
- Uses: `useAuthStore.login`, `setBusinessAccount`, `supabase.auth.getSession`, fetches `/api/instagram/exchange-token`, fetches `graph.facebook.com/v22.0/me/permissions`, INSERTs to `user_consents`
- Renders `<PagePickerModal>` when `requiresSelection`

### 2.4 `pages/Dashboard.tsx`
- **Hooks**: `useDashboardData`, `useInstagramProfile`, `useTokenValidation`, `useTokenStatus`, `useInstagramAccount`
- **Components**: `DashboardHeader`, `AnimatedMetricsGrid`, `AnimatedActivityFeed`, `QuickActions`, `RecentMedia`, `PerformanceChart`, `InstagramProfileCard`, `TokenExpiredBanner`, `TokenWarningBanner`, `LinkAccountModal`
- **Wires**: redirects to `${VITE_API_BASE_URL}/api/auth/instagram` on reconnect

### 2.5 `pages/Analytics.tsx`
- Uses: `useInstagramInsights`, `useInstagramAccount`, charting libs
- Components: metrics grid, time-series charts

### 2.6 `pages/ContentManagement.tsx`
- Uses: `useInstagramAccount`, scheduled posts APIs
- Components: `CreatePostModal` (permissions/ContentManagement), media library

### 2.7 `pages/Settings.tsx`
- **Components**: `AccountInfoSection`, `ConnectionStatusSection`, `DangerZoneSection`, `ProfilePreviewSection`, `TokenImportSection`

### 2.8 `pages/EngagementMonitor.tsx` (largest — 50 KB)
- Comment + DM monitoring, sentiment filtering, response interface

### 2.9 `pages/CommentManagement.tsx` — Phase 3 Meta review
- **Components** (`components/permissions/CommentManagement/`): `CommentInbox`, `CommentCard`, `CommentFilters`, `ReplyInterface`, `SentimentBadge`

### 2.10 `pages/ContentAnalytics.tsx` — Phase 3
- **Components** (`components/permissions/ContentAnalytics/`): `ContentGrid`, `MediaCard`, `AnalyticsChart`

### 2.11 `pages/DMInbox.tsx` — Phase 3
- **Components** (`components/permissions/DMInbox/`): `DMConversationList`, `MessageThread`, `WindowStatusIndicator`

### 2.12 `pages/UGCManagement.tsx` — Phase 3
- **Components** (`components/permissions/UGCManagement/`): `VisitorPostInbox`, `VisitorPostCard`, `PermissionRequestModal`, `RepostConfirmationModal`
- Uses: `useVisitorPosts`

### 2.13 `pages/AgentTerminal.tsx` — thin wrapper
- Renders `<AgentTerminalDashboard>` from `components/agent-terminal/`

### 2.14 `pages/Audience.tsx` — thin wrapper
- Renders `<AudienceDashboard>` from `components/audience/`

### 2.15 `pages/PrivacyDashboard.tsx`
- Privacy controls UI

### 2.16 `pages/TestConnection.tsx`
- Calls `testSupabaseConnection()` from `lib/supabase`

### 2.17 Public legal (no auth, no data)
- `privacypolicy.tsx`, `TermsOfService.tsx`, `DataDeletion.tsx` — render content from `src/content/legalcontent.ts`

### 2.18 Inline placeholder pages (in `App.tsx`)
- `Engagement`, `CreatePost`, `Campaigns` — small static mock UIs, no data

### 2.19 Shared permissions components (`components/permissions/shared/`)
- `FeatureHighlight`, `PermissionBadge`, `PolicyComplianceIndicator`
- And `components/permissions/InstagramProfile/`: `InstagramProfileCard`, `ProfileStats`

---

# 3. RAW COMPONENTS  (no data layer — pure presentational / UI primitives)

These are split into three groups by the user's request: layout chrome, dashboard domain pieces, audience pieces, and the UI primitive library.

## 3.1 Layout / Chrome
| File | Role |
|---|---|
| `components/layout/Layout.tsx` (280 lines) | App shell — desktop nav, mobile menu, header, search box, "Create" CTA, terminal shortcut, `<NotificationDropdown/>`, user menu (logout = `navigate('/login')`, NOT actual signOut — known gap), `<Outlet/>`, `<LegalFooter/>` |
| `components/layout/RequireAuth.tsx` | Route guard (see §1.1.6) |
| `components/layout/LegalFooter.tsx` | Static legal links |
| `components/layout/MoreDropdown.tsx` | Overflow nav for nav items past index 5 |
| `components/layout/NotificationDropdown.tsx` | Toast history viewer (reads from `ToastContext.history`, capped at 20) |

## 3.2 Dashboard domain (no data, receive props only)
- `components/dashboard/DashboardHeader.tsx` — hard-coded quickStats; reads `useAuthStore.user.username` only
- `components/dashboard/DashboardHeaderSkeleton.tsx`
- `components/dashboard/AnimatedMetricsGrid.tsx` — animated grid wrapper
- `components/dashboard/MetricsGridSkeleton.tsx`
- `components/dashboard/AnimatedActivityFeed.tsx` — animations only
- `components/dashboard/PerformanceChart.tsx` — chart canvas
- `components/dashboard/QuickActions.tsx` — calls `useNavigate`, `useToast`, `useModal`, has internal `loadingStates` map
- `components/dashboard/RecentMedia.tsx`
- `components/dashboard/TokenExpiredBanner.tsx`
- `components/dashboard/TokenWarningBanner.tsx`

## 3.3 Audience domain
- `components/audience/AudienceDashboard.tsx` — **DATA LAYER** (uses `useInstagramAccount` + `useRealtimeAnalytics`); orchestrator
- `components/audience/AudienceMetricCard.tsx` — prop-driven card (label/value/change/icon/isLoading/color)
- `components/audience/FollowerGrowthChart.tsx` — prop-driven chart
- `components/audience/DemographicsPlaceholder.tsx` — static placeholder

## 3.4 Agent Terminal (mixed — some have data, some pure)
| File | Role | Data? |
|---|---|---|
| `AgentTerminalDashboard.tsx` | Root 3-column grid (feed/chat/queue/metrics) | **YES** — composes 4 hooks |
| `TerminalStatusBar.tsx` | Status pill (alive/down, uptime, tasks, alerts, queued) | NO (props) |
| `TerminalInput.tsx` | Input box with submit/cancel/clear | NO (props) |
| `TerminalScrollArea.tsx` | Auto-scroll container | NO (props) |
| `SessionDropdown.tsx` | Session picker | NO (props) |
| `ActivityFeedPanel.tsx` | Renders events list | NO (props) |
| `QueueMonitorPanel.tsx` | Histogram + DLQ | NO (props) |
| `MetricsOverviewPanel.tsx` | Renders metrics | NO (props) |
| `AnimatedSpiralBackground.tsx` | Pure CSS animation | NO |

## 3.5 Settings pieces (props-driven)
- `components/settings/AccountInfoSection.tsx`
- `components/settings/ConnectionStatusSection.tsx`
- `components/settings/DangerZoneSection.tsx`
- `components/settings/ProfilePreviewSection.tsx`
- `components/settings/TokenImportSection.tsx`

## 3.6 Modals / Overlays
- `components/modals/LinkAccountModal.tsx` — modal for "no Instagram accounts" error
- `components/modals/index.ts` — barrel `{LinkAccountModal}`
- `components/auth/PagePickerModal.tsx` — multi-page picker (see §1.1.5)

## 3.7 Transitions
- `components/transitions/PageTransition.tsx` — animation wrapper
- `components/transitions/RouteAnimationProvider.tsx` — provides animation context

## 3.8 UI Primitives  (`components/ui/`)
All pure presentational, no data fetching:
| File | Role |
|---|---|
| `AnimatedButton.tsx` | styled button with motion |
| `AnimatedCard.tsx` | glass-morphism card |
| `AsyncWrapper.tsx` | wraps async UI with loading/error fallbacks |
| `ConfirmModal.tsx` | confirmation dialog |
| `CountUpAnimation.tsx` | number counter |
| `FormModal.tsx` | form dialog |
| `FormSkeleton.tsx` | form loading state |
| `LoadingButton.tsx` | button with spinner |
| `LoadingSpinner.tsx` | spinner |
| `Modal.tsx` | generic modal shell |
| `ProgressAnimation.tsx` | progress bar |
| `ScrollAnimations.tsx` | scroll-triggered animations |
| `Skeleton.tsx` | base skeleton |
| `SkeletonCard.tsx` | card skeleton |
| `SkeletonFeed.tsx` | feed skeleton |
| `SkeletonMediaGrid.tsx` | media grid skeleton |
| `StatusCard.tsx` | empty stub (0 bytes) |
| `TableSkeleton.tsx` | table skeleton |
| `Toast.tsx` | single toast |
| `ToastContainer.tsx` | toast stack |
| `metric-card.tsx` | dashboard metric card (title/value/change_pct/trend/sparkline) |

## 3.9 `components/ErrorBoundary.tsx`
React error boundary wrapping the most error-prone pages (audience, ugc, agent-terminal, and the agent-terminal panels individually).

---

# 4. SUPPORTING SUBSYSTEMS

## 4.1 `src/contexts/`
- `ToastContext.tsx` — provides `toasts`, `history` (capped 20), `addToast`, `removeToast`, `clearToasts`, `clearHistory`. Auto-dismiss via per-id timer map.
- `ModalContext.tsx` — provides `openConfirm`, `openForm`, `close`, `isOpen`, `data`. Used by `useModal()`.

## 4.2 `src/services/`
- `agentService.ts` (489 lines) — see §1.2.3 + §1.5
- `databaseservices.ts` (24 KB) — typed CRUD for core tables (user_profiles, instagram_business_accounts, instagram_assets, instagram_comments, etc.); UUID validation pattern
- `dmService.ts` (24 KB) — Instagram DM ops (conversations, messages, window-status checks)
- `webhooks.ts` (6.7 KB) — Cloudflare webhook self-tests
- `metaWebhooks.ts` (11.6 KB) — `handleWebhookEvent(body: MetaWebhookBody): { status, processed }` — counts processed events by type
- `consentService.ts` (15 KB) — `user_consents` table ops (record, revoke, list)

## 4.3 `src/config/instagramScopes.ts`
Exports `INSTAGRAM_OAUTH_SCOPES` — the comma-separated scope list passed to `signInWithOAuth`. 9 core + 2 advanced.

## 4.4 `src/styles/terminal.css`
CSS custom properties for the agent-terminal theme: `--terminal-bg`, `--terminal-fg`, `--terminal-green`, `--terminal-cyan`, `--terminal-yellow`, `--terminal-red`, `--terminal-dim`, `--terminal-border`, plus `.terminal-prompt`, `.terminal-cursor` classes.

## 4.5 `src/index.css` (10 KB)
Tailwind base + custom animations (`fade-in`, glass-morphism utilities).

## 4.6 Environment variables (from `.env.production` / `.env.agent.example`)
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_TUNNEL_URL` / `VITE_SUPABASE_DIRECT_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_BASE_URL` (default: `https://api.888intelligenceautomation.in`)
- `VITE_AUTH_MODE` (`'facebook' | 'instagram' | 'both'`)
- `VITE_ADMIN_EMAIL`, `VITE_ADMIN_PASSWORD` (dev shim)
- `VITE_SHOW_ADMIN_LINK`
- `VITE_ENVIRONMENT`

---

# 5. ROUTING MAP (`src/App.tsx`)

```
PUBLIC:
  /privacy-policy          → PrivacyPolicy
  /terms-of-service        → TermsOfService
  /data-deletion           → DataDeletion
  /login                   → Login (eager)
  /auth/callback           → FacebookCallback
  /admin/login             → AdminLogin (lazy)
  /test-connection         → TestConnection

PROTECTED (RequireAuth + Layout):
  /                        → Dashboard
  /dashboard               → redirect to /
  /dashboard/privacy-controls → PrivacyDashboard
  /analytics               → Analytics
  /content                 → ContentManagement
  /content/create          → CreatePost (inline)
  /content/analytics       → ContentAnalytics
  /engagement              → Engagement (inline)
  /engagement/comments     → CommentManagement
  /engagement/messages     → DMInbox
  /engagement-monitor      → EngagementMonitor
  /settings                → Settings
  /campaigns               → Campaigns (inline)
  /audience                → Audience (ErrorBoundary)
  /ugc                     → UGCManagement (ErrorBoundary)
  /agent-terminal          → AgentTerminal (ErrorBoundary)

CATCH-ALL: → /login
```

---

# 6. INFRASTRUCTURE AT A GLANCE

| Concern | Implementation |
|---|---|
| **Routing** | React Router v6, lazy + Suspense for everything except `Login`/`FacebookCallback`/`Layout`/`RequireAuth`/`ErrorBoundary` |
| **Server state** | TanStack Query v5 (5-min staleTime, 10-min gcTime, retry 1) |
| **Realtime** | Supabase Realtime `postgres_changes` channels per data type |
| **Client state** | Zustand (`authStore` only) + React Context (`Toast`, `Modal`) |
| **HTTP** | Native `fetch` (with custom retry in `supabase.ts`) |
| **Auth** | Supabase Auth PKCE + native `signInWithOAuth` + admin table check |
| **Form state** | Local `useState` |
| **Validation** | Zod (only on SSE protocol + JSONB columns) |
| **Styling** | Tailwind + custom `glass-morphism-card`, terminal CSS vars, framer-motion |
| **Icons** | `lucide-react` everywhere |
| **Type discipline** | Generated `Database` → all row types derived; `AGENT_WRITABLE_TABLES` registry constrains generics |

---

# 7. KNOWN GAPS / OBSERVATIONS

1. **`useOversightChat` swallows the `userId` change**: the first effect uses both `businessAccountId` and `userId` as deps, so re-renders triggered by token refresh will *not* re-run the session loader (correct), but a user switch would re-create a session. Fine.
2. **`LIVENESS_THRESHOLD_MS`** is exported from `useAgentHealth` but deprecated. `useOversightChat` still imports it for `MAX_STREAM_DURATION_MS` — could split.
3. **Logout in `Layout.tsx`** calls `navigate('/login')` directly instead of `useAuthStore.signOut()` — bypasses provider token cleanup and `localStorage` clearing.
4. **`DashboardOverview.tsx`** and **`StatusCard.tsx`** in `ui/` are 0-byte stubs.
5. **`AGENT_WRITABLE_TABLES`** includes `instagram_dm_conversations` + `instagram_dm_messages` as agent-writable, but the dashboard has no direct UI for editing DMs — read-only via `DMInbox` page.

---

**End of map.** Every file in `src/` is accounted for. The utility layer (Login, Heartbeats, SSE, TS foundation) sits in §1; data-coupled pages in §2; raw presentational components in §3.
