Agent Terminal Dashboard — Production Implementation Plan
Context
The Instagram automation platform has a single unified AI agent (Nvidia Orchestrator, modified Qwen model) handling 5 operation types: UGC Discovery, Engagement Monitor, Content Scheduler, Analytics Pipeline, and Oversight Brain (chat). The dashboard needs a distinctive terminal-style UI inspired by gtop to monitor agent health, queue status, activity, metrics, and provide a chat interface via SSE streaming.

Key constraint: This dashboard must feel like a completely different UI from the rest of the platform — a full-screen dark terminal, not glass-morphism cards.

Design Principles (Locked In)
Background: Pure black #000 / dark #0d1117
Font: JetBrains Mono (loaded only on terminal page via CSS import)
Colors: Green #00ff41 (main), Cyan #00ffff (status), Red #ff5555 (errors), Yellow #ffcc00 (warnings), Dim #888 (secondary)
No: borders, cards, gradients, emojis, rounded corners
Layout: Fixed top status bar + scrollable center + fixed bottom input bar
Prompt style: oversight@agent ~ $
Cursor: Blinking block cursor (CSS @keyframes)
Files to Create
Phase	File	Purpose
1	src/pages/AgentTerminal.tsx	Page component (lazy loaded)
1	src/components/agent-terminal/AgentTerminalDashboard.tsx	Root layout: 3-column CSS Grid
1	src/components/agent-terminal/TerminalStatusBar.tsx	Fixed top status bar
1	src/components/agent-terminal/TerminalInput.tsx	Fixed bottom input with prompt
1	src/components/agent-terminal/TerminalScrollArea.tsx	Central scrollable container
1	src/styles/terminal.css	Global terminal CSS (font, cursor, scrollbar, colors)
2	src/components/agent-terminal/OversightTerminalChat.tsx	Chat messages + streaming
2	src/components/agent-terminal/TerminalMessage.tsx	Single message renderer
2	src/components/agent-terminal/TerminalStreamingCursor.tsx	Blinking block cursor
4	src/hooks/useQueueMonitor.ts	TanStack Query hook for queue data
4	src/components/agent-terminal/QueueMonitorPanel.tsx	Right sidebar panel
5	src/hooks/useActivityFeed.ts	TanStack Query hook for audit_log
5	src/components/agent-terminal/ActivityFeedPanel.tsx	Left sidebar panel
6	src/hooks/useTerminalKeyboard.ts	Ctrl+L, Ctrl+C, arrow history
6	src/components/agent-terminal/mockData.ts	Dev-only mock data
Files to Modify
File	Change
src/App.tsx (line ~45)	Add const AgentTerminal = lazy(() => import('./pages/AgentTerminal'))
src/App.tsx (line ~420)	Add <Route path="agent-terminal" element={<AgentTerminal />} /> inside protected routes
src/components/layout/Layout.tsx (line ~44)	Add { name: 'Terminal', path: '/agent-terminal', icon: <Terminal /> } to navigationItems
tailwind.config.js	Add terminal color palette + blink-cursor animation + font family
src/types/agent-tables.ts	Add QueueStatusSummary, QueueDLQItem, QueueRetryResult types
src/services/agentService.ts	Add getQueueStatus(), getQueueDLQ(), retryQueueItem(), getAuditLog()
backend.api/server.js (line ~421)	Mount queue routes directly (bypass validateAgentApiKey, same as oversight)
Phase 1 — Terminal Shell & Layout Skeleton
1.1 Terminal CSS (src/styles/terminal.css)
Load JetBrains Mono via Google Fonts (deferred — only on terminal page):


@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&display=swap');
Define .terminal-root scope: font-family, background, color, font-size 13px, line-height 1.5, anti-aliased. Override .glass-morphism-card inside terminal to transparent/no-blur/no-border. Custom thin scrollbar (6px, dark track/thumb). .terminal-cursor blinking block. .terminal-prompt cyan + nowrap. .terminal-input transparent bg, green caret, no outline. ::selection green tint.

1.2 Tailwind Config Additions (tailwind.config.js)

// theme.extend.colors
terminal: {
  green: '#00ff41', cyan: '#00ffff', red: '#ff5555',
  yellow: '#ffcc00', dim: '#888888', bg: '#000000',
  'bg-alt': '#0d1117', 'bg-panel': '#161b22', border: '#30363d',
}

// theme.extend.fontFamily
mono: ["'JetBrains Mono'", "'Fira Code'", "'Cascadia Code'", 'monospace']

// theme.extend.animation
'blink-cursor': 'blink-cursor 1s step-end infinite'

// theme.extend.keyframes
'blink-cursor': { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0' } }
1.3 Root Component (AgentTerminalDashboard.tsx)
Renders position: fixed; inset: 0; z-index: 60 to overlay standard Layout chrome
Wraps everything in .terminal-root class
CSS Grid layout:

grid-template-areas: "status status status" "feed chat queue" "input input input"
grid-template-rows: auto 1fr auto
grid-template-columns: 280px 1fr 280px
Responsive: At <1024px sidebars collapse to bottom tabs; at <768px single-panel with tab switcher
Includes close/back button (top-right) that navigates to /
Reads businessAccountId from useAuthStore()
Instantiates hooks: useAgentHealth(), useOversightChat()
1.4 Status Bar (TerminalStatusBar.tsx)
Props: agentStatus, uptime, activeTaskCount, alertCount, queuedCount, isLoading

Renders single line:


[ALIVE] Uptime: 14h 22m | Active: 3 | Alerts: 0 | Queued: 7          2026-02-26 14:54 UTC
[ALIVE] green, [DOWN] red + blink animation
Alert count red if > 0, dim gray if 0
Queued count yellow if > 0
1.5 Input Bar (TerminalInput.tsx)
Props: onSubmit, isStreaming, disabled, promptPrefix (default: oversight@agent ~ $)

<textarea> single row, auto-expanding (max 4 rows), transparent bg
Enter submits, Shift+Enter newline, Ctrl+Enter always submits
When streaming: disabled, shows [streaming...] in dim text
Cyan prompt prefix as <span>, green caret-color
1.6 Routing (src/App.tsx)

// Line ~45: Add lazy import
const AgentTerminal = lazy(() => import('./pages/AgentTerminal'))

// Line ~420: Add inside protected <Route> block
<Route path="agent-terminal" element={<ErrorBoundary><AgentTerminal /></ErrorBoundary>} />
1.7 Page Component (src/pages/AgentTerminal.tsx)
Thin wrapper: imports terminal.css, renders <AgentTerminalDashboard />.

Phase 2 — Oversight Chat Wiring
2.1 Chat Display (OversightTerminalChat.tsx)
Props: receives all of UseOversightChatResult

Maps messages to <TerminalMessage> components
During streaming: appends streamBuffer text + <TerminalStreamingCursor>
Auto-scroll to bottom via useRef + scrollIntoView({ behavior: 'smooth' })
Session selector: minimal horizontal list of session IDs (if > 1 session)
Error display: red [ERROR] {message}
Empty state: shows oversight@agent ~ $ type a question to begin... in dim text
2.2 Message Renderer (TerminalMessage.tsx)
Props: message: OversightMessage, isLatest: boolean

User: [HH:MM:SS] user@dashboard ~ $ {content} — timestamp dim, prompt cyan, content white
Assistant: [HH:MM:SS] {content} — timestamp dim, content green, pre-wrap whitespace
If tools_used: yellow [tools: name1, name2] prefix before content
If incomplete: yellow [INTERRUPTED] suffix
Use React.memo to prevent re-renders of non-streaming messages
2.3 Streaming Cursor (TerminalStreamingCursor.tsx)
Pure CSS component: <span className="terminal-cursor" aria-hidden="true" />

0.6em wide, 1.15em tall, green bg, blink-cursor animation
2.4 Integration
The existing useOversightChat hook is consumed directly — no modifications needed. The hook returns sessions, activeSession, messages, isStreaming, streamBuffer, error, startSession, sendMessage, selectSession, closeStream.

TerminalInput.onSubmit → calls sendMessage(input) if activeSession exists, or startSession() then sendMessage() if no session.

Phase 3 — Agent Status Panel
3.1 Wiring (AgentStatusBar.tsx)
Consumes useAgentHealth(businessAccountId) directly — already polls every 30s.

Derives uptime from oldest heartbeat: Date.now() - new Date(heartbeats[heartbeats.length-1]?.created_at).getTime(), formatted as Xh Ym.

Active task count: derived from queue summary (Phase 4). Until Phase 4, shows --.

Phase 4 — Queue Monitor
4.1 Backend Mount (backend.api/server.js)
Mount queue routes directly in server.js after the oversight block (line ~421), bypassing validateAgentApiKey — same pattern as oversight:


// After the oversight routes block:
try {
  const queueRoutes = require('./routes/agents/queue');
  app.use('/api/instagram', queueRoutes);
  console.log('Queue monitor routes loaded (GET /post-queue/status, /dlq, POST /retry)');
} catch (error) {
  console.error('Failed to load queue routes:', error.message);
}
4.2 Types (src/types/agent-tables.ts)
Add to Section E (Filter States):


/** Parsed summary from GET /post-queue/status */
export interface QueueStatusSummary {
  byKey: Record<string, number>  // "{action_type}::{status}" → count
  total: number
  timestamp: string
}

/** DLQ item from GET /post-queue/dlq */
export interface QueueDLQItem {
  id: string
  business_account_id: string
  action_type: string
  payload: unknown
  retry_count: number
  error: string | null
  error_category: string | null
  created_at: string
  updated_at: string
}

/** Response from POST /post-queue/retry */
export interface QueueRetryResult {
  queue_id: string
  action_type: string
  /** retry_count BEFORE reset (5 for DLQ items) */
  previous_retry_count: number
  message: string
}
4.3 Service Layer (src/services/agentService.ts)
Add 3 methods using fetch against the backend API (NOT direct Supabase — queue endpoints are Express routes). Use the same apiBase pattern as useOversightChat:


private static get apiBase(): string {
  return import.meta.env.VITE_API_BASE_URL || 'https://api.888intelligenceautomation.in'
}

static async getQueueStatus(): Promise<ServiceResponse<QueueStatusSummary>>
static async getQueueDLQ(limit?: number): Promise<ServiceListResponse<QueueDLQItem>>
static async retryQueueItem(queueId: string): Promise<ServiceResponse<QueueRetryResult>>
4.4 Hook (src/hooks/useQueueMonitor.ts)

export interface UseQueueMonitorResult {
  summary: QueueStatusSummary
  dlqItems: QueueDLQItem[]
  totalQueued: number
  totalDLQ: number
  isLoading: boolean
  error: string | null
  retryItem: (queueId: string) => Promise<void>
  refetch: () => void
}
Queue status: TanStack Query, queryKey: ['queue-monitor', 'status'], refetchInterval: 15_000 (15s — queue changes faster)
DLQ: TanStack Query, queryKey: ['queue-monitor', 'dlq'], refetchInterval: 30_000
Retry mutation: calls AgentService.retryQueueItem(), invalidates both queries on success, optimistic remove from DLQ cache
4.5 UI Panel (QueueMonitorPanel.tsx)
Monospace table rendering:


-- QUEUE MONITOR --
reply_comment  3 pending   0 processing
reply_dm       4 pending   0 processing
publish_post   0 pending   1 processing
send_dm        0 pending   2 failed

-- DLQ (2 items) --
[a1b2] reply_dm      err:rate_limit  [RETRY]
[c3d4] publish_post  err:auth_fail   [RETRY]
Error display formatting: Backend returns error_category (string) and error (full message). The DLQ display uses the short category form:


// Format: err:{error_category}
const errorDisplay = `err:${item.error_category ?? 'unknown'}`
// Full error available on hover/expand: item.error
Colors: pending yellow, processing cyan, sent green, failed red, dlq bright red + blink. [RETRY] button styled as cyan underlined text.

Phase 5 — Activity Feed
5.1 Service Layer (src/services/agentService.ts)
Add getAuditLog() — direct Supabase query:


static async getAuditLog(limit = 50): Promise<ServiceListResponse<AuditLogEntry>>
CRITICAL: audit_log has NO business_account_id column at top level. The account ID is stored inside the details JSONB column. The service queries all recent entries ordered by created_at DESC with limit. Client-side filtering is required:


// In useActivityFeed hook — filter raw results by businessAccountId
const filtered = useMemo(() =>
  events.filter(e =>
    (e.details as Record<string, unknown>)?.business_account_id === businessAccountId
  ),
  [events, businessAccountId]
)
5.2 Hook (src/hooks/useActivityFeed.ts)

export interface UseActivityFeedResult {
  events: AuditLogEntry[]
  isLoading: boolean
  error: string | null
  refetch: () => void
}
TanStack Query, queryKey: ['activity-feed', limit], refetchInterval: 30_000, staleTime: 30_000
5.3 UI Panel (ActivityFeedPanel.tsx)
Reverse-chronological list:


-- ACTIVITY FEED --
[14:54:22] UGC discovered post#47 score:0.82
[14:52:01] DM sent to @user123
[14:50:33] Comment replied media#889
[14:48:12] Post published media#890
[14:45:00] [ERROR] Auth failure for account#xyz
Color by event_type:

post_published → green
comment_replied, dm_sent → cyan
ugc_reposted → yellow
post_failed_permanent, auth_failure → red
Phase 6 — Polish & Keyboard Shortcuts
6.1 Terminal Keyboard (useTerminalKeyboard.ts)

interface UseTerminalKeyboardOptions {
  onClearScreen: () => void
  onHistoryUp: () => string | undefined
  onHistoryDown: () => string | undefined
  onEscape: () => void
}
Ctrl+L → clear screen (clear messages display, session persists)
Ctrl+C → cancel streaming
ArrowUp/Down (when input focused) → command history navigation
History stored in useRef<string[]> (max 100), persisted to sessionStorage
6.2 Mock Data Mode
AgentTerminalDashboard accepts ?mock=true URL param for development. Mock data file exports MOCK_AGENT_HEALTH, MOCK_MESSAGES, MOCK_QUEUE_SUMMARY, MOCK_ACTIVITY_EVENTS.

6.3 Responsive Behavior
Breakpoint	Layout
>= 1280px	3-column: 280px / 1fr / 280px (full sidebars)
1024-1279px	3-column: 240px / 1fr / 240px (narrower sidebars)
768-1023px	1-column, bottom tabs for feed/queue (collapsible drawer)
< 768px	1-column, tab switcher: Chat / Feed / Queue
Implementation Dependencies

Phase 1 (Shell)          → No dependencies
  ├─→ Phase 2 (Chat)     → Uses existing useOversightChat
  ├─→ Phase 3 (Status)   → Uses existing useAgentHealth
  ├─→ Phase 4 (Queue)    → Needs backend mount + new hook/service
  └─→ Phase 5 (Feed)     → Needs new hook/service
Phase 6 (Polish)         → Depends on all above
Phases 2-5 are parallel after Phase 1 completes — they occupy independent grid areas.

Verification Plan
Phase	Verification
1	Terminal renders full-screen black, JetBrains Mono loads, green text on black, responsive grid works at all breakpoints
2	Type question → SSE stream renders green tokens → blinking cursor during streaming → [done] persists message → auto-scroll works
3	Agent alive → green [ALIVE] badge. Stop agent (or wait 60s) → red blinking [DOWN]. Alert count updates.
4	Restart backend with queue routes mounted. Insert test post_queue rows. Summary counts match. Click [RETRY] → row resets to pending.
5	Insert test audit_log rows. Events appear reverse-chronological. Colors match event_type. Polls every 30s.
6	Ctrl+L clears screen. Up arrow restores previous command. Ctrl+C cancels streaming. Resize to mobile → panels collapse.
Performance Notes
Stream buffer rendering: React.memo on TerminalMessage — only streaming message re-renders on token events
Font loading: JetBrains Mono (~100KB for 4 weights) loaded with font-display: swap — fallback monospace renders immediately
Polling stagger: Heartbeats 30s, Queue status 15s, DLQ 30s, Activity 30s — all use staleTime === refetchInterval
Code splitting: Terminal page is lazy-loaded — CSS + JS only fetched on navigation
Scroll perf: overflow-anchor: auto on scroll container for bottom-anchored scrolling
Critical Existing Files Reference
src/hooks/useOversightChat.ts — SSE streaming hook (reuse directly, no changes)
src/hooks/useAgentHealth.ts — Heartbeat + alerts polling (reuse directly, no changes)
src/services/agentService.ts — Add 4 methods (getQueueStatus, getQueueDLQ, retryQueueItem, getAuditLog)
src/types/agent-tables.ts — Add queue types (QueueStatusSummary, QueueDLQItem, QueueRetryResult)
src/types/oversight.ts — SSE protocol types + type guards (reuse directly)
backend.api/routes/agents/queue.js — 3 endpoints exist, just needs mounting in server.js
backend.api/server.js (line ~421) — Mount queue routes after oversight block
tailwind.config.js — Add terminal color palette + blink-cursor animation