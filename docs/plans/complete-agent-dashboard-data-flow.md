# Agent Dashboard - Complete Data Flow Reference

This document contains raw data and information about all Agent Dashboard components. This is a data dump for the planning agent to create implementation plans.

---

# TABLE OF CONTENTS

1. [Queue Monitor](#1-queue-monitor)
2. [Agent Status Panel](#2-agent-status-panel)
3. [Oversight Chat](#3-oversight-chat)
4. [Activity Feed](#4-activity-feed)
5. [System Alerts](#5-system-alerts)
6. [Metrics Dashboard](#6-metrics-dashboard)

---

# 1. QUEUE MONITOR

## 1.1 Database Table

**Table Name:** `post_queue`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Unique row identifier |
| `business_account_id` | UUID | FK to `instagram_business_accounts` |
| `action_type` | string | Type of IG action being performed |
| `payload` | JSON | Action-specific data |
| `idempotency_key` | string | SHA-256 hash to prevent duplicate operations |
| `status` | string | Current lifecycle state |
| `retry_count` | number | Number of retry attempts (max 5 before DLQ) |
| `error` | string | Error message from last failed attempt |
| `error_category` | string | Classification: auth_failure/permanent/rate_limit/transient/unknown |
| `instagram_id` | string | Instagram media/conversation ID on success |
| `next_retry_at` | TIMESTAMP | When to retry (for rate-limited items) |
| `created_at` | TIMESTAMP | Row creation time |
| `updated_at` | TIMESTAMP | Last modification time |

## 1.2 Action Types

| Action Type | Triggered By | Payload Keys |
|-------------|--------------|--------------|
| `reply_comment` | Engagement Agent | `comment_id`, `reply_text`, `post_id` |
| `reply_dm` | Engagement Agent | `conversation_id`, `message_text` |
| `send_dm` | Engagement Agent | `recipient_id`, `message_text` |
| `publish_post` | Publishing Agent | `image_url`, `caption`, `media_type`, `scheduled_post_id`, `creation_id` |
| `repost_ugc` | UGC Agent | `permission_id`, `creation_id` |

## 1.3 Status Values

| Status | Description |
|--------|-------------|
| `pending` | Queued, waiting for cron pickup |
| `processing` | Currently being executed (prevents concurrent pickup) |
| `sent` | Successfully delivered to Instagram |
| `failed` | Temporary failure (retryable), will be retried by cron |
| `dlq` | Dead Letter Queue - permanent failure, requires manual intervention |

## 1.4 Error Categories

| Category | Retry? | IG Error Codes |
|----------|--------|----------------|
| `auth_failure` | No | 190, 102, 104 |
| `permanent` | No | Most 400s |
| `rate_limit` | Yes | 4, 17, 32, 613, 429 |
| `transient` | Yes |  `unknown` |5xx |
| Yes | ETIMEDOUT, ECONNABORTED |

## 1.5 Backend API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/post-queue/status` | GET | Summary counts by status × action_type |
| `/post-queue/dlq` | GET | List all DLQ items with error details |
| `/post-queue/retry` | POST | Reset failed/DLQ row to pending |

**Request/Response Format:**
```javascript
// GET /post-queue/status
// Response: { success: true, summary: { "publish_post::pending": 5, ... }, total: 178, timestamp: "..." }

// GET /post-queue/dlq
// Query: ?limit=50
// Response: { success: true, dlq: [...], count: 3, timestamp: "..." }

// POST /post-queue/retry
// Body: { queue_id: "uuid" }
// Response: { success: true, queue_id: "...", action_type: "...", previous_retry_count: 5, message: "..." }
```

## 1.6 Retry Logic (post-fallback.js)

- **Cron Schedule:** Every 5 minutes (`*/5 * * * *`)
- **Max Retries:** 5 before moving to DLQ
- **Batch Size:** 20 items per tick
- **Backoff Formula:** `Math.min(2^retry_count * 60000, 3600000)` ms
- **Backoff Values:** 2min → 4min → 8min → 16min → 32min → DLQ

## 1.7 Frontend Hook

**Existing File:** `src/hooks/useAgentHealth.ts`
- Provides alerts and heartbeat data
- Polling Interval: 30 seconds

**Proposed New Hook:** `src/hooks/useQueueMonitor.ts`
- Will fetch from `/post-queue/status` and `/post-queue/dlq`

## 1.8 Frontend Service

**Existing File:** `src/services/agentService.ts`
- Already has methods for agent data fetching
- Queue-specific methods need to be added

---

# 2. AGENT STATUS PANEL

## 2.1 Database Table

**Table Name:** `agent_heartbeats`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Unique row identifier |
| `agent_id` | string | Agent identifier |
| `status` | 'alive' \| 'down' | Current agent status |
| `last_beat_at` | TIMESTAMP | Last heartbeat timestamp |
| `created_at` | TIMESTAMP | Row creation time |
| `updated_at` | TIMESTAMP | Last modification time |

## 2.2 Backend API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/agent/heartbeat` | POST | Receive heartbeat from Python agent |

**Python Agent sends:**
```javascript
// POST /agent/heartbeat
// Body: { agent_id: "uuid", timestamp: "ISO-8601" }
// Response: { success: true, agent_id: "...", received_at: "..." }
```

## 2.3 Frontend Implementation

**Existing File:** `src/hooks/useAgentHealth.ts`

**Key Constants:**
```typescript
const LIVENESS_THRESHOLD_MS = 60_000  // 60 seconds - agent considered alive if last beat within this time
const POLL_INTERVAL_MS = 30_000       // 30 seconds - polling interval
```

**Existing Functionality:**
- Fetches heartbeats with limit (default 5)
- Derives agentStatus client-side: 'alive' if newest heartbeat <= 60s ago, else 'down'
- Polls every 30 seconds

**Data Returned:**
```typescript
interface UseAgentHealthResult {
  heartbeats: AgentHeartbeat[]
  alerts: SystemAlert[]
  agentStatus: 'alive' | 'down'
  isLoading: boolean
  error: string | null
  resolveAlert: (alertId: string) => Promise<void>
  refetch: () => void
}
```

## 2.4 Status Determination Logic

```typescript
// Client-side status determination
const newestBeat = heartbeats[0]?.last_beat_at
const agentStatus = newestBeat
  ? Date.now() - new Date(newestBeat).getTime() <= LIVENESS_THRESHOLD_MS
    ? 'alive'
    : 'down'
  : 'down'
```

---

# 3. OVERSIGHT CHAT

## 3.1 Database Table

**Table Name:** `oversight_chat_sessions`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Unique row identifier |
| `business_account_id` | UUID | FK to `instagram_business_accounts` |
| `dashboard_user_id` | string | User who started the session |
| `messages` | JSON | Array of chat messages |
| `session_title` | string \| null | Auto-generated or user-provided title |
| `is_active` | boolean | Whether session is currently active |
| `last_question` | string \| null | Last question asked |
| `last_answer` | string \| null | Last answer received |
| `last_latency_ms` | number \| null | Last response latency |
| `last_tools_used` | JSON \| null | Array of tools used in last query |
| `total_queries` | number | Total queries in session |
| `created_at` | TIMESTAMP | Session creation time |
| `updated_at` | TIMESTAMP | Last modification time |

## 3.2 Message Structure (JSON in messages column)

```typescript
interface OversightMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  tools_used?: string[]
  latency_ms?: number
  incomplete?: boolean  // marks interrupted responses
}
```

## 3.3 Backend API

**Endpoint:** `POST /api/instagram/oversight/chat`

**Headers Required:**
- `Content-Type: application/json`
- `X-User-ID: <user_id>`
- For SSE: `Accept: text/event-stream`

**Request Body:**
```javascript
{
  business_account_id: "uuid",
  user_id: "uuid",
  question: "string (max 2000 chars)",
  chat_history: [...],  // previous messages
  stream: true  // for SSE
}
```

**SSE Response Format:**
```
// Keep-alive ping (ignore)
: ping

// Token event (accumulate)
data: {"token": "..."}

// Done event (complete)
data: {"done": true, "latency_ms": 1234}

// Error event
data: {"type": "error", "content": "error message"}
```

## 3.4 Frontend Implementation

**Existing File:** `src/hooks/useOversightChat.ts`

**Key Features:**
- NOT TanStack Query - uses manual SSE stream management
- Session management: create, list, select sessions
- Real-time streaming with token accumulation
- Message persistence to Supabase
- Cleanup on unmount/error

**Data Returned:**
```typescript
interface UseOversightChatResult {
  sessions: OversightSession[]
  activeSession: OversightSession | null
  messages: OversightMessage[]
  isStreaming: boolean
  streamBuffer: string
  error: string | null
  startSession: () => Promise<void>
  sendMessage: (question: string) => void
  selectSession: (sessionId: string) => void
  closeStream: () => void
}
```

**Constants:**
```typescript
const MAX_STREAM_DURATION_MS = LIVENESS_THRESHOLD_MS * 5  // 5 minutes max stream
const POLL_INTERVAL_MS = 30_000  // for session list refresh
```

## 3.5 Agent Liveness Check (Backend)

Before establishing SSE connection, backend checks agent heartbeat:

```javascript
// In backend.api/routes/agents/oversight.js
const LIVENESS_THRESHOLD_MS = 60_000;
const heartbeat = await supabase
  .from('agent_heartbeats')
  .select('last_beat_at, status')
  .order('last_beat_at', { ascending: false })
  .limit(1)
  .single();

const isAlive = heartbeat && 
  (Date.now() - new Date(heartbeat.last_beat_at).getTime()) <= LIVENESS_THRESHOLD_MS;

if (!isAlive) {
  return res.status(503).json({ 
    error: 'Agent is not responding - cannot start oversight chat',
    code: 'AGENT_DOWN' 
  });
}
```

---

# 4. ACTIVITY FEED

## 4.1 Database Table

**Table Name:** `audit_log`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Unique row identifier |
| `event_type` | string | Type of event (e.g., 'post_published', 'comment_replied') |
| `action` | string | Action performed (e.g., 'publish', 'reply', 'send') |
| `resource_type` | string | Type of resource affected |
| `resource_id` | string | ID of affected resource |
| `user_id` | string \| null | User who triggered the action |
| `success` | boolean \| null | Whether action succeeded |
| `error_message` | string \| null | Error message if failed |
| `details` | JSON \| null | Additional context |
| `ip_address` | unknown | Client IP |
| `user_agent` | string \| null | Client user agent |
| `created_at` | TIMESTAMP \| null | Event timestamp |

## 4.2 Event Types

| Event Type | Action | Resource Type | Description |
|------------|--------|---------------|-------------|
| `post_published` | publish | instagram_post | Post successfully published |
| `comment_replied` | reply | instagram_comment | Comment reply sent |
| `dm_sent` | send | instagram_dm | DM message sent |
| `ugc_reposted` | repost | ugc_content | UGC reposted |
| `post_failed_permanent` | post_queue_dlq | post_queue | Post moved to DLQ |
| `auth_failure` | disconnect | instagram_business_accounts | Account disconnected |

## 4.3 Backend API

**Where audit logs are written:**

1. **backend.api/routes/agents/engagement.js**
   - After successful comment reply
   - After successful DM send
   - On failure

2. **backend.api/routes/agents/publishing.js**
   - After successful post publish
   - On failure

3. **backend.api/routes/agents/ugc.js**
   - After successful UGC repost
   - On failure

4. **backend.api/services/post-fallback.js**
   - When moving to DLQ

5. **backend.api/config/supabase.js**
   - General API request logging

**Log Function:**
```javascript
// logAudit() function
await logAudit({
  event_type: 'post_published',
  action: 'publish',
  resource_type: 'instagram_post',
  resource_id: mediaId,
  details: { caption, image_url, media_type },
  success: true
});
```

## 4.4 Frontend Implementation

**Existing Components:**
- `src/components/dashboard/ActivityFeed.tsx` (EXISTING)
- `src/components/dashboard/AnimatedActivityFeed.tsx` (EXISTING)

**Existing Hook:** None specifically for audit_log
- Uses `useDashboardData.ts` for general dashboard data

**Proposed Implementation:**
- New hook: `src/hooks/useActivityFeed.ts`
- Query `audit_log` table
- Filter by business_account_id, event_type, date range
- Sort by created_at descending
- Pagination support

---

# 5. SYSTEM ALERTS

## 5.1 Database Table

**Table Name:** `system_alerts`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Unique row identifier |
| `alert_type` | string | Type of alert (see below) |
| `message` | string | Alert message |
| `business_account_id` | UUID \| null | Related business account |
| `details` | JSON \| null | Additional context |
| `resolved` | boolean | Whether alert is resolved |
| `resolved_at` | TIMESTAMP \| null | When alert was resolved |
| `created_at` | TIMESTAMP \| null | Alert creation time |
| `updated_at` | TIMESTAMP \| null | Last modification time |

## 5.2 Alert Types

| Alert Type | Description | Severity |
|------------|-------------|----------|
| `auth_failure` | Instagram token expired or invalid | CRITICAL |
| `rate_limit` | Instagram API rate limit hit | WARNING |
| `content_violation` | Content rejected by Instagram | ERROR |
| `agent_down` | Python agent not responding | CRITICAL |
| `sync_failure` | Data sync from Instagram failed | ERROR |

## 5.3 Alert Details Structure

```typescript
interface SystemAlertDetails {
  agent_id?: string
  error_code?: string
  endpoint?: string
  retry_count?: number
  last_error?: string
  source?: string  // e.g., 'proactive_sync'
  occurred_at?: string
  [key: string]: unknown
}
```

## 5.4 Backend API

**Where alerts are created:**

1. **backend.api/services/proactive-sync.js**
   - On auth failure: mark account disconnected + create alert
   - On rate limit: create alert

2. **backend.api/routes/agents/engagement.js**
   - On API error (if severe)

3. **backend.api/routes/agents/publishing.js**
   - On API error (if severe)

**Alert Creation:**
```javascript
await supabase.from('system_alerts').insert({
  alert_type: 'auth_failure',
  business_account_id: accountId,
  message: `Proactive sync auth failure: ${errorMessage}`,
  details: { source: 'proactive_sync', error: errorMessage, occurred_at: new Date().toISOString() },
  resolved: false,
});
```

## 5.5 Frontend Implementation

**Existing File:** `src/hooks/useAgentHealth.ts`

**Existing Functionality:**
- Fetches system alerts via `AgentService.getSystemAlerts(businessAccountId, resolved = false)`
- Polls every 30 seconds (same as heartbeat)
- Provides `resolveAlert(alertId)` function

**Data Retrieved:**
```typescript
// Via useAgentHealth
alerts: SystemAlert[]
// Filter: unresolved only by default
```

**Alert Filter State:**
```typescript
interface AlertFilterState {
  type: 'all' | SystemAlertType
  resolved: boolean
}
```

---

# 6. METRICS DASHBOARD

## 6.1 Database Table

**Table Name:** `analytics_reports`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Unique row identifier |
| `business_account_id` | UUID | FK to `instagram_business_accounts` |
| `report_type` | string | 'daily' or 'weekly' |
| `report_date` | TIMESTAMP | Date of report |
| `start_date` | string | Period start date |
| `end_date` | string | Period end date |
| `instagram_metrics` | JSON | Account-level metrics |
| `media_metrics` | JSON | Media-level metrics |
| `revenue_metrics` | JSON | Revenue attribution metrics |
| `historical_comparison` | JSON | Comparison with previous period |
| `insights` | JSON | AI-generated insights |
| `data_sources` | JSON \| null | Sources used |
| `processed_at` | TIMESTAMP | When report was generated |
| `run_id` | string \| null | ID of the run |
| `created_at` | TIMESTAMP | Row creation time |

## 6.2 Report Types

| Report Type | Cadence | Generated By |
|-------------|---------|--------------|
| `daily` | Every day at 02:00 UTC | analytics_scheduler.py |
| `weekly` | Weekly (Monday 08:00 UTC) | analytics_scheduler.py |

## 6.3 Instagram Metrics Structure

```typescript
interface InstagramReportMetrics {
  impressions?: number
  reach?: number
  profile_views?: number
  website_clicks?: number
  follower_growth?: number
  followers_count?: number
  posts_published?: number
  total_likes?: number
  total_comments?: number
  total_saves?: number
  total_shares?: number
  avg_engagement_rate?: number
}
```

## 6.4 Media Metrics Structure

```typescript
interface MediaReportMetrics {
  total_posts?: number
  total_posts_in_period?: number
  avg_likes?: number
  avg_comments?: number
  avg_likes_per_post?: number
  avg_comments_per_post?: number
  avg_reach?: number
  avg_engagement_rate?: number
  top_performing?: Array<{
    media_id: string
    engagement: number
    caption_snippet: string
  }>
  best_post?: Record<string, unknown>
  worst_post?: Record<string, unknown>
  by_media_type?: Record<string, unknown>
}
```

## 6.5 Revenue Metrics Structure

```typescript
interface RevenueReportMetrics {
  attributed_revenue?: number
  attribution_count?: number
  avg_order_value?: number
  conversion_rate?: number  // 0-1
  attributed_orders?: number
  avg_attribution_score?: number
  top_touchpoint_type?: string
}
```

## 6.6 Historical Comparison Structure

```typescript
interface HistoricalComparison {
  period?: string  // e.g., 'vs_last_7d', 'vs_last_30d'
  impressions_delta?: number
  reach_delta?: number
  engagement_delta?: number
  follower_delta?: number
  previous_period?: { start_date?: string; end_date?: string }
  changes?: Record<string, {
    previous: number
    current: number
    change_pct: number
    trend: string
  }>
  note?: string
}
```

## 6.7 Insights Structure

```typescript
interface ReportInsights {
  key_findings?: string[]
  recommendations?: string[]
  anomalies?: string[]
}
```

## 6.8 Backend API

**File:** `backend.api/routes/agents/analytics.js`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/agents/insights` | GET | Gets account or media insights |
| `/agents/account-insights` | GET | Account-level insights |
| `/agents/media-insights` | GET | Media-level insights |

**Query Parameters:**
- `business_account_id` (required)
- `since` (optional) - start date
- `until` (optional) - end date

**Response:**
```javascript
// Proxies to Python agent's analytics_tools.py
// Returns aggregated metrics from analytics_reports table
```

## 6.9 Frontend Implementation

**Existing File:** `src/hooks/useAnalyticsReports.ts`

**Existing Functionality:**
- Fetches analytics reports via `AgentService.getAnalyticsReports(businessAccountId, reportType, limit)`
- Report types: 'daily', 'weekly'

**Existing File:** `src/components/dashboard/PerformanceChart.tsx`
- Displays performance metrics visually

**Data Retrieved:**
```typescript
interface UseAnalyticsReportsResult {
  reports: AnalyticsReport[]
  isLoading: boolean
  error: string | null
  refetch: () => void
}
```

---

# SUMMARY: ALL DATABASE TABLES

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `post_queue` | Outbound IG API operations queue | action_type, status, retry_count, error |
| `agent_heartbeats` | Agent liveness tracking | agent_id, status, last_beat_at |
| `oversight_chat_sessions` | Chat sessions with Oversight Brain | messages, session_title, total_queries |
| `system_alerts` | Error and health alerts | alert_type, message, resolved |
| `audit_log` | Universal audit trail | event_type, action, resource_type, success |
| `analytics_reports` | Daily/weekly metrics reports | report_type, instagram_metrics, media_metrics |

---

# SUMMARY: ALL BACKEND ENDPOINTS

| Endpoint | File | Purpose |
|----------|------|---------|
| `POST /agent/heartbeat` | agents/heartbeat.js | Receive agent heartbeat |
| `GET /post-queue/status` | agents/queue.js | Queue summary |
| `GET /post-queue/dlq` | agents/queue.js | DLQ items |
| `POST /post-queue/retry` | agents/queue.js | Manual retry |
| `POST /oversight/chat` | agents/oversight.js | Oversight Brain chat |
| `GET /agents/insights` | agents/analytics.js | Analytics data |
| `POST /reply-comment` | agents/engagement.js | Reply to comment |
| `POST /reply-dm` | agents/engagement.js | Reply to DM |
| `POST /send-dm` | agents/engagement.js | Send DM |
| `POST /publish-post` | agents/publishing.js | Publish post |
| `POST /repost-ugc` | agents/ugc.js | Repost UGC |

---

# SUMMARY: ALL FRONTEND HOOKS

| Hook | File | Purpose |
|------|------|---------|
| `useAgentHealth` | hooks/useAgentHealth.ts | Heartbeat + alerts (EXISTING) |
| `useOversightChat` | hooks/useOversightChat.ts | Chat with Oversight Brain (EXISTING) |
| `useAnalyticsReports` | hooks/useAnalyticsReports.ts | Analytics reports (EXISTING) |
| `useQueueMonitor` | hooks/useQueueMonitor.ts | Queue data (TO BE CREATED) |
| `useActivityFeed` | hooks/useActivityFeed.ts | Audit log feed (TO BE CREATED) |

---

# SUMMARY: ALL FRONTEND SERVICES

| Service | File | Purpose |
|---------|------|---------|
| `AgentService` | services/agentService.ts | All agent data queries (EXISTING) |

**Existing AgentService Methods:**
- `getHeartbeats(limit)` - Get agent heartbeats
- `getSystemAlerts(businessAccountId, resolved)` - Get alerts
- `resolveAlert(alertId)` - Resolve an alert
- `getScheduledPosts(businessAccountId, status, limit)` - Get scheduled posts
- `updateScheduledPostStatus(postId, status)` - Update post status
- `getAttributionQueue(businessAccountId, reviewStatus)` - Get attribution queue
- `reviewAttribution(reviewId, status, reviewedBy)` - Review attribution
- `getAttributionModel(businessAccountId)` - Get model weights
- `getAnalyticsReports(businessAccountId, reportType, limit)` - Get reports

---

# CONSTANTS REFERENCE

| Constant | Value | Location | Purpose |
|----------|-------|----------|---------|
| `LIVENESS_THRESHOLD_MS` | 60,000 | useAgentHealth.ts | Agent alive if heartbeat within 60s |
| `POLL_INTERVAL_MS` | 30,000 | useAgentHealth.ts | Polling interval |
| `MAX_STREAM_DURATION_MS` | 300,000 | useOversightChat.ts | Max SSE stream duration (5 min) |
| `MAX_RETRIES` | 5 | post-fallback.js | Max retries before DLQ |
| `BATCH_SIZE` | 20 | post-fallback.js | Items per cron tick |
| `DEFAULT_CRON` | */5 * * * * | post-fallback.js | Cron schedule (every 5 min) |

---

# ERROR CATEGORIZATION FUNCTION

**File:** `backend.api/helpers/agent-helpers.js`

**Function:** `categorizeIgError(error)`

**Logic:**
```javascript
function categorizeIgError(error) {
  const status = error.response?.status;
  const igCode = error.response?.data?.error?.code;
  
  // Auth failures
  if ([190, 102, 104].includes(igCode)) {
    return { retryable: false, error_category: 'auth_failure' };
  }
  
  // Permanent errors
  if (status === 400 && igCode && ![4, 17, 32, 613].includes(igCode)) {
    return { retryable: false, error_category: 'permanent' };
  }
  
  // Rate limits
  if ([4, 17, 613].includes(igCode) || status === 429) {
    return { retryable: true, error_category: 'rate_limit' };
  }
  
  // Transient errors
  if (status >= 500) {
    return { retryable: true, error_category: 'transient' };
  }
  
  // Network timeouts
  if (!status && (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED')) {
    return { retryable: true, error_category: 'transient' };
  }
  
  // Unknown
  return { retryable: true, error_category: 'unknown' };
}
```

---

# DATA FLOW SUMMARY DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         AGENT DASHBOARD DATA FLOWS                                  │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐  │
│  │                     PYTHON AGENT (LangChain)                                  │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │  │
│  │  │ Engagement  │  │  Content    │  │    UGC      │  │  Oversight  │        │  │
│  │  │  Monitor   │  │  Scheduler  │  │  Discovery  │  │   Brain    │        │  │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │  │
│  │         │                 │                 │                 │               │  │
│  │         │    ┌────────────┼─────────────────┼─────────────────┘               │  │
│  │         │    │            │                 │                                  │  │
│  │         ▼    ▼            ▼                 ▼                                  │  │
│  │  ┌───────────────────────────────────────────────────────────────────────┐   │  │
│  │  │                  INSTAGRAM GRAPH API                                   │   │  │
│  │  └───────────────────────────────────────────────────────────────────────┘   │  │
│  │                                    │                                            │  │
│  └────────────────────────────────────┼────────────────────────────────────────────┘  │
│                                       │                                              │
│                                       ▼                                              │
│  ┌────────────────────────────────────────────────────────────────────────────────┐  │
│  │                         BACKEND API (Node.js)                                 │  │
│  │                                                                                │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │  │
│  │  │  heartbeat │  │   queue     │  │  oversight  │  │  analytics  │         │  │
│  │  │   POST     │  │   GET/POST  │  │   POST SSE  │  │    GET     │         │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘         │  │
│  │                                                                                │  │
│  │  Also writes to:                                                               │  │
│  │  - audit_log (on every action)                                                │  │
│  │  - system_alerts (on errors)                                                  │  │
│  │  - post_queue (for retryable actions)                                        │  │
│  │                                                                                │  │
│  └────────────────────────────────────────────────────────────────────────────────┘  │
│                                       │                                              │
│                                       ▼                                              │
│  ┌────────────────────────────────────────────────────────────────────────────────┐  │
│  │                     DATABASE (SUPABASE/POSTGRESQL)                            │  │
│  │                                                                                │  │
│  │  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐                   │  │
│  │  │ agent_heartbeats│ │ post_queue     │ │system_alerts   │                   │  │
│  │  │                │ │                │ │                │                   │  │
│  │  │ - agent_id     │ │ - action_type  │ │ - alert_type   │                   │  │
│  │  │ - status       │ │ - status       │ │ - message     │                   │  │
│  │  │ - last_beat_at │ │ - retry_count  │ │ - resolved    │                   │  │
│  │  └────────────────┘ └────────────────┘ └────────────────┘                   │  │
│  │                                                                                │  │
│  │  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐                   │  │
│  │  │oversight_chat  │ │  audit_log     │ │analytics_      │                   │  │
│  │  │_sessions      │ │                │ │reports         │                   │  │
│  │  │                │ │                │ │                │                   │  │
│  │  │ - messages     │ │ - event_type   │ │ - report_type │                   │  │
│  │  │ - session_title│ │ - action       │ │ - metrics     │                   │  │
│  │  │ - total_queries│ │ - success     │ │ - insights    │                   │  │
│  │  └────────────────┘ └────────────────┘ └────────────────┘                   │  │
│  │                                                                                │  │
│  └────────────────────────────────────────────────────────────────────────────────┘  │
│                                       ▲                                              │
│                                       │                                              │
│  ┌────────────────────────────────────┼────────────────────────────────────────────┐  │
│  │                         FRONTEND (React + TypeScript)                          │  │
│  │                                                                                │  │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐  │  │
│  │  │                         TANSTACK QUERY + SSE                               │  │  │
│  │  │                                                                          │  │  │
│  │  │   Polling (30s):                          SSE Streaming:               │  │  │
│  │  │   - useAgentHealth (heartbeats, alerts)  - useOversightChat            │  │  │
│  │  │   - useQueueMonitor (queue status)                                      │  │  │
│  │  │   - useActivityFeed (audit log)                                        │  │  │
│  │  │   - useAnalyticsReports (metrics)                                      │  │  │
│  │  │                                                                          │  │  │
│  │  └─────────────────────────────────────────────────────────────────────────┘  │  │
│  │                                    │                                           │  │
│  │                                    ▼                                           │  │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐  │  │
│  │  │                      AGENT DASHBOARD UI                                 │  │  │
│  │  │                                                                          │  │  │
│  │  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │  │  │
│  │  │  │ Agent Status │ │    Queue      │ │  Oversight   │ │   Metrics    │  │  │  │
│  │  │  │    Panel     │ │   Monitor     │ │    Chat      │ │  Dashboard   │  │  │  │
│  │  │  │              │ │              │ │              │ │              │  │  │  │
│  │  │  │ - alive/down │ │ - status cnt │ │ - sessions   │ │ - daily rpt │  │  │  │
│  │  │  │ - uptime     │ │ - dlq viewer │ │ - messages   │ │ - weekly    │  │  │  │
│  │  │  │ - last beat  │ │ - retry btn  │ │ - streaming  │ │ - charts    │  │  │  │
│  │  │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘  │  │  │
│  │  │                                                                          │  │  │
│  │  │  ┌──────────────┐ ┌──────────────┐                                     │  │  │
│  │  │  │Activity Feed │ │ System Alerts │                                     │  │  │
│  │  │  │              │ │              │                                     │  │  │
│  │  │  │ - timeline   │ │ - alert list │                                     │  │  │
│  │  │  │ - filters    │ │ - resolve    │                                     │  │  │
│  │  │  │ - search     │ │ - severity   │                                     │  │  │
│  │  │  └──────────────┘ └──────────────┘                                     │  │  │
│  │  │                                                                          │  │  │
│  │  └─────────────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                                │  │
│  └────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```
