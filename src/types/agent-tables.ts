/**
 * agent-tables.ts
 *
 * TypeScript types and Zod runtime schemas for every table the Python/LangChain
 * agent writes to. Organised into five sections:
 *
 *  A. Row type aliases (re-exported from database.types.ts)
 *  B. Status union types (narrowing the loose `string` DB fields)
 *  C. JSONB interfaces + companion Zod schemas
 *  D. AgentWritableTables registry (operations × triggers)
 *  E. Filter states + DEFAULT constants
 */

import type { Database } from '../lib/database.types'
import { z } from 'zod'

// ─────────────────────────────────────────────────────────────────────────────
// SECTION A — Row Type Aliases
// ─────────────────────────────────────────────────────────────────────────────

// ── Core Automation ──────────────────────────────────────────────────────────

/** Liveness record for the Python/LangChain agent process */
export type AgentHeartbeat = Database['public']['Tables']['agent_heartbeats']['Row']

/** instagram_comments row — Engagement Monitor writes sentiment, category, priority,
 *  processed_by_automation, automated_response_sent, response_text */
export type AgentComment = Database['public']['Tables']['instagram_comments']['Row']

/** DM conversation thread — agent UPSERTs on DM webhook and live fetch fallback */
export type AgentDMConversation = Database['public']['Tables']['instagram_dm_conversations']['Row']

/** Individual DM message — agent UPSERTs via live fetch fallback */
export type AgentDMMessage = Database['public']['Tables']['instagram_dm_messages']['Row']

// ── Content Pipeline ─────────────────────────────────────────────────────────

/** Media asset record — Content Scheduler UPDATEs last_posted, post_count,
 *  avg_engagement after a successful publish */
export type AgentAsset = Database['public']['Tables']['instagram_assets']['Row']

/** Content Scheduler's primary output — agent INSERTs a draft, then UPDATEs
 *  after evaluation (agent_approved, agent_quality_score, status, etc.) */
export type ScheduledPost = Database['public']['Tables']['scheduled_posts']['Row']
export type ScheduledPostInsert = Database['public']['Tables']['scheduled_posts']['Insert']
export type ScheduledPostUpdate = Database['public']['Tables']['scheduled_posts']['Update']

// ── Sales Attribution ────────────────────────────────────────────────────────

/** Full attribution record — agent is the sole writer; triggered by order webhook */
export type SalesAttribution = Database['public']['Tables']['sales_attributions']['Row']

/** Human review queue entry — agent INSERTs non-auto-approved attributions here */
export type AttributionReview = Database['public']['Tables']['attribution_review_queue']['Row']
export type AttributionReviewUpdate = Database['public']['Tables']['attribution_review_queue']['Update']

/** Attribution model weights — UPSERTed by the weekly learning run (Mon 8am) */
export type AttributionModel = Database['public']['Tables']['attribution_models']['Row']

// ── Analytics & Ops ──────────────────────────────────────────────────────────

/** Daily and weekly analytics report — UPSERTed by the analytics scheduler */
export type AnalyticsReport = Database['public']['Tables']['analytics_reports']['Row']

/** Universal audit trail — every agent operation INSERTs a row here */
export type AuditLogEntry = Database['public']['Tables']['audit_log']['Row']

/** Outbound IG API queue — agent INSERTs jobs and UPDATEs status as they process */
export type OutboundQueueJob = Database['public']['Tables']['outbound_queue_jobs']['Row']

/** Subset of instagram_business_accounts that the queue DLQ UPDATEs on auth failures
 *  (sets is_connected=false, updates connection_status) */
export type AgentAccountUpdate = Pick<
  Database['public']['Tables']['instagram_business_accounts']['Row'],
  'id' | 'is_connected' | 'connection_status' | 'updated_at'
>

/** Agent-generated error and health alert */
export type SystemAlert = Database['public']['Tables']['system_alerts']['Row']

// UGCContent + UGCPermission live in ugc.ts — imported from there, not re-declared.

// ─────────────────────────────────────────────────────────────────────────────
// SECTION B — Status Union Types
// ─────────────────────────────────────────────────────────────────────────────

/** Current liveness of the Python/LangChain agent process */
export type AgentHeartbeatStatus = 'alive' | 'down'

/**
 * Lifecycle of a content post through the agent→human approval pipeline:
 * pending → approved → publishing → published
 *                 ↘ rejected
 *                              ↘ failed
 */
export type ScheduledPostStatus =
  | 'pending'     // agent created the draft, awaiting evaluation
  | 'approved'    // agent (or human) approved, ready to publish
  | 'rejected'    // agent or human rejected
  | 'publishing'  // in-flight IG API call
  | 'published'   // live on Instagram
  | 'failed'      // IG API call failed permanently

/** Human review decision on a sales attribution */
export type AttributionReviewStatus = 'pending' | 'approved' | 'rejected'

/** outbound_queue_jobs.status lifecycle */
export type QueueJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'dlq'

/** outbound_queue_jobs.priority */
export type QueueJobPriority = 'high' | 'normal'

/** post_queue.status lifecycle */
export type PostQueueStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'dlq'

/** post_queue.action_type — the type of outgoing IG action being queued */
export type PostQueueActionType =
  | 'reply_comment'
  | 'reply_dm'
  | 'send_dm'
  | 'publish_post'
  | 'repost_ugc'

/** system_alerts.alert_type — categories of agent-generated health events */
export type SystemAlertType =
  | 'auth_failure'
  | 'rate_limit'
  | 'content_violation'
  | 'agent_down'
  | 'sync_failure'

/** instagram_comments.sentiment — AI-analysed tone of a comment */
export type CommentSentiment = 'positive' | 'neutral' | 'negative'

/** instagram_comments.priority — triage level set by the Engagement Monitor */
export type CommentPriority = 'low' | 'medium' | 'high' | 'urgent'

/**
 * IG API error classification from categorizeIgError() in backend.api/helpers/agent-helpers.js.
 * Drives retry/backoff decisions in the queue worker.
 */
export type ErrorCategory = 'auth_failure' | 'permanent' | 'rate_limit' | 'transient' | 'unknown'

/** analytics_reports.report_type — cadence of the scheduler run */
export type ReportType = 'daily' | 'weekly'

/**
 * automation_type DB enum — identifies which agent pipeline is active.
 * Values: engagement_monitor | analytics_pipeline | sales_attribution |
 *         ugc_collection | customer_service
 */
export type AgentType = Database['public']['Enums']['automation_type']

// ─────────────────────────────────────────────────────────────────────────────
// SECTION C — JSONB Interfaces + Zod Schemas
//
// Pattern: TypeScript interface for compile-time safety,
//          Zod schema for runtime validation after reading from DB.
//
// Usage:
//   Reading  → const result = MySchema.safeParse(row.jsonb_column)
//   Writing  → MySchema.parse(payload) before INSERT/UPDATE
// ─────────────────────────────────────────────────────────────────────────────

// ── attribution_models.weights ────────────────────────────────────────────────
/** Default: { first_touch: 0.25, last_touch: 0.25, linear: 0.25, time_decay: 0.25 } */
export interface AttributionModelWeights {
  first_touch: number
  last_touch:  number
  linear:      number
  time_decay:  number
}
export const AttributionModelWeightsSchema = z.object({
  first_touch: z.number().min(0).max(1),
  last_touch:  z.number().min(0).max(1),
  linear:      z.number().min(0).max(1),
  time_decay:  z.number().min(0).max(1),
})

// ── attribution_models.performance_metrics ────────────────────────────────────
export interface AttributionPerformanceMetrics {
  accuracy?:       number
  precision?:      number
  recall?:         number
  last_evaluated?: string
  sample_size?:    number
}
export const AttributionPerformanceMetricsSchema = z.object({
  accuracy:       z.number().optional(),
  precision:      z.number().optional(),
  recall:         z.number().optional(),
  last_evaluated: z.string().optional(),
  sample_size:    z.number().int().optional(),
}).optional()

// ── scheduled_posts.agent_modifications ──────────────────────────────────────
/** Changes the agent made to the originally generated content.
 *  `reason` is always required — the agent must explain every modification. */
export interface AgentModifications {
  caption?:  string
  hook?:     string
  body?:     string
  cta?:      string
  hashtags?: string[]
  reason:    string
}
export const AgentModificationsSchema = z.object({
  caption:  z.string().optional(),
  hook:     z.string().optional(),
  body:     z.string().optional(),
  cta:      z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  reason:   z.string().min(1),
})

// ── scheduled_posts.selection_factors ────────────────────────────────────────
/** Scoring breakdown that explains why this asset was selected for scheduling. */
export interface PostSelectionFactors {
  visual_quality?:       number   // 0–100
  engagement_potential?: number   // 0–100
  brand_alignment?:      number   // 0–100
  recency?:              number   // 0–100
  uniqueness?:           number   // 0–100
}
export const PostSelectionFactorsSchema = z.object({
  visual_quality:       z.number().min(0).max(100).optional(),
  engagement_potential: z.number().min(0).max(100).optional(),
  brand_alignment:      z.number().min(0).max(100).optional(),
  recency:              z.number().min(0).max(100).optional(),
  uniqueness:           z.number().min(0).max(100).optional(),
}).optional()

// ── analytics_reports.instagram_metrics ──────────────────────────────────────
export interface InstagramReportMetrics {
  impressions?:     number
  reach?:           number
  profile_views?:   number
  website_clicks?:  number
  follower_growth?: number
}
export const InstagramReportMetricsSchema = z.object({
  impressions:     z.number().int().optional(),
  reach:           z.number().int().optional(),
  profile_views:   z.number().int().optional(),
  website_clicks:  z.number().int().optional(),
  follower_growth: z.number().int().optional(),
})

// ── analytics_reports.media_metrics ──────────────────────────────────────────
export interface MediaReportMetrics {
  total_posts?:         number
  avg_likes?:           number
  avg_comments?:        number
  avg_reach?:           number
  avg_engagement_rate?: number
  top_performing?:      Array<{
    media_id:        string
    engagement:      number
    caption_snippet: string
  }>
}
export const MediaReportMetricsSchema = z.object({
  total_posts:         z.number().int().optional(),
  avg_likes:           z.number().optional(),
  avg_comments:        z.number().optional(),
  avg_reach:           z.number().optional(),
  avg_engagement_rate: z.number().optional(),
  top_performing:      z.array(z.object({
    media_id:        z.string(),
    engagement:      z.number(),
    caption_snippet: z.string(),
  })).optional(),
})

// ── analytics_reports.revenue_metrics ────────────────────────────────────────
export interface RevenueReportMetrics {
  attributed_revenue?: number
  attribution_count?:  number
  avg_order_value?:    number
  conversion_rate?:    number   // 0–1
}
export const RevenueReportMetricsSchema = z.object({
  attributed_revenue: z.number().optional(),
  attribution_count:  z.number().int().optional(),
  avg_order_value:    z.number().optional(),
  conversion_rate:    z.number().min(0).max(1).optional(),
})

// ── analytics_reports.insights ───────────────────────────────────────────────
export interface ReportInsights {
  key_findings?:    string[]
  recommendations?: string[]
  anomalies?:       string[]
}
export const ReportInsightsSchema = z.object({
  key_findings:    z.array(z.string()).optional(),
  recommendations: z.array(z.string()).optional(),
  anomalies:       z.array(z.string()).optional(),
})

// ── analytics_reports.historical_comparison ──────────────────────────────────
export interface HistoricalComparison {
  period?:             string   // e.g. 'vs_last_7d', 'vs_last_30d'
  impressions_delta?:  number
  reach_delta?:        number
  engagement_delta?:   number
  follower_delta?:     number
}
export const HistoricalComparisonSchema = z.object({
  period:            z.string().optional(),
  impressions_delta: z.number().optional(),
  reach_delta:       z.number().optional(),
  engagement_delta:  z.number().optional(),
  follower_delta:    z.number().optional(),
})

// ── ugc_content.quality_factors ──────────────────────────────────────────────
/** Quality scoring breakdown set by the UGC Discovery agent. Re-exported in ugc.ts. */
export interface UGCQualityFactors {
  visual_quality?:  number   // 0–100
  caption_quality?: number   // 0–100
  engagement_rate?: number
  follower_count?:  number
  brand_relevance?: number   // 0–100
}
export const UGCQualityFactorsSchema = z.object({
  visual_quality:  z.number().min(0).max(100).optional(),
  caption_quality: z.number().min(0).max(100).optional(),
  engagement_rate: z.number().optional(),
  follower_count:  z.number().int().optional(),
  brand_relevance: z.number().min(0).max(100).optional(),
}).optional()

// ── sales_attributions.model_scores ──────────────────────────────────────────
export interface AttributionModelScores {
  first_touch?: number
  last_touch?:  number
  linear?:      number
  time_decay?:  number
  combined?:    number
}
export const AttributionModelScoresSchema = z.object({
  first_touch: z.number().optional(),
  last_touch:  z.number().optional(),
  linear:      z.number().optional(),
  time_decay:  z.number().optional(),
  combined:    z.number().optional(),
}).optional()

// ── sales_attributions.journey_timeline ──────────────────────────────────────
/** Single touchpoint in a customer's journey from Instagram to purchase */
export interface AttributionJourneyEvent {
  timestamp:       string
  event_type:      string   // 'post_view' | 'story_view' | 'link_click' | 'comment'
  media_id?:       string
  caption_snippet?: string
  engagement?:     string
}
export const AttributionJourneyEventSchema = z.object({
  timestamp:       z.string(),
  event_type:      z.string(),
  media_id:        z.string().optional(),
  caption_snippet: z.string().optional(),
  engagement:      z.string().optional(),
})
export const AttributionJourneyTimelineSchema = z.array(AttributionJourneyEventSchema).optional()

// ── system_alerts.details ─────────────────────────────────────────────────────
/** Contextual metadata attached to a system alert by the agent */
export interface SystemAlertDetails {
  agent_id?:    string
  error_code?:  string
  endpoint?:    string
  retry_count?: number
  last_error?:  string
  [key: string]: unknown
}
export const SystemAlertDetailsSchema = z.object({
  agent_id:    z.string().optional(),
  error_code:  z.string().optional(),
  endpoint:    z.string().optional(),
  retry_count: z.number().int().optional(),
  last_error:  z.string().optional(),
}).passthrough().optional()

// ── audit_log.details ─────────────────────────────────────────────────────────
/** Contextual metadata on an audit event — which record was affected and how */
export interface AuditLogDetails {
  run_id?:     string
  table_name?: string
  record_id?:  string
  changes?:    Record<string, unknown>
  [key: string]: unknown
}
export const AuditLogDetailsSchema = z.object({
  run_id:     z.string().optional(),
  table_name: z.string().optional(),
  record_id:  z.string().optional(),
  changes:    z.record(z.string(), z.unknown()).optional(),
}).passthrough().optional()

// ─────────────────────────────────────────────────────────────────────────────
// SECTION D — AgentWritableTables Registry
//
// Maps every table the agent writes to → the operations it performs
// and the scheduler/trigger that initiates them.
//
// Used by AgentService.get<T>() and by the dashboard's audit query layer.
// ─────────────────────────────────────────────────────────────────────────────

export const AGENT_WRITABLE_TABLES = {
  instagram_comments:          { ops: ['UPDATE', 'UPSERT'] as const, triggers: ['engagement_monitor', 'webhook'] as const },
  instagram_dm_conversations:  { ops: ['UPSERT'] as const,           triggers: ['dm_webhook', 'live_fetch_fallback'] as const },
  instagram_dm_messages:       { ops: ['UPSERT'] as const,           triggers: ['live_fetch_fallback'] as const },
  instagram_assets:            { ops: ['UPDATE'] as const,           triggers: ['content_scheduler'] as const },
  scheduled_posts:             { ops: ['INSERT', 'UPDATE'] as const, triggers: ['content_scheduler'] as const },
  ugc_content:                 { ops: ['UPSERT'] as const,           triggers: ['ugc_discovery'] as const },
  ugc_permissions:             { ops: ['INSERT', 'UPDATE'] as const, triggers: ['ugc_discovery'] as const },
  sales_attributions:          { ops: ['INSERT'] as const,           triggers: ['order_webhook'] as const },
  attribution_review_queue:    { ops: ['INSERT'] as const,           triggers: ['order_webhook'] as const },
  attribution_models:          { ops: ['UPSERT'] as const,           triggers: ['weekly_learning'] as const },
  analytics_reports:           { ops: ['UPSERT'] as const,           triggers: ['analytics_scheduler'] as const },
  audit_log:                   { ops: ['INSERT'] as const,           triggers: ['universal_audit'] as const },
  outbound_queue_jobs:         { ops: ['INSERT', 'UPDATE'] as const, triggers: ['queue_worker'] as const },
  instagram_business_accounts: { ops: ['UPDATE'] as const,           triggers: ['queue_dlq'] as const },
  system_alerts:               { ops: ['INSERT'] as const,           triggers: ['error_handling'] as const },
} as const

export type AgentWritableTableName = keyof typeof AGENT_WRITABLE_TABLES
export type AgentWriteOperation    = 'INSERT' | 'UPDATE' | 'UPSERT'
export type AgentTrigger           = typeof AGENT_WRITABLE_TABLES[AgentWritableTableName]['triggers'][number]

// ─────────────────────────────────────────────────────────────────────────────
// SECTION E — Filter States + DEFAULT Constants
// ─────────────────────────────────────────────────────────────────────────────

export interface ScheduledPostFilterState {
  status: 'all' | ScheduledPostStatus
  search: string
}
export const DEFAULT_SCHEDULED_POST_FILTERS: ScheduledPostFilterState = {
  status: 'all',
  search: '',
}

export interface AlertFilterState {
  type:     'all' | SystemAlertType
  resolved: boolean
}
export const DEFAULT_ALERT_FILTERS: AlertFilterState = {
  type:     'all',
  resolved: false,
}

export interface AttributionFilterState {
  review_status: 'all' | AttributionReviewStatus
  fraud_risk:    boolean | 'all'
}
export const DEFAULT_ATTRIBUTION_FILTERS: AttributionFilterState = {
  review_status: 'all',
  fraud_risk:    'all',
}
