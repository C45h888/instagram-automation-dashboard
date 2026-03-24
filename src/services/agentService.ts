/**
 * agentService.ts
 *
 * Static service class for all agent-domain Supabase queries.
 * Follows the same pattern as DatabaseService in databaseservices.ts:
 *  - Static methods only
 *  - ServiceResponse<T> / ServiceListResponse<T> return wrappers
 *  - UUID validation before every query
 *  - try/catch with typed error extraction
 *
 * The generic AgentService.get<T>() method uses the AGENT_WRITABLE_TABLES
 * registry as its constraint, eliminating copy-paste across methods.
 *
 * Zod safeParse is used after reading JSONB columns so callers receive
 * typed data rather than raw Json.
 */

import { supabase } from '../lib/supabase'
import type {
  AgentHeartbeat,
  AgentWritableTableName,
  AnalyticsReport,
  AttributionModel,
  AttributionReview,
  AttributionReviewStatus,
  ReportType,
  ScheduledPost,
  ScheduledPostStatus,
  SystemAlert,
} from '@/types'
import type { QueueOverview, QueueDLQItem, QueueRetryResult, AuditLogEntry } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Response wrappers (same shape as DatabaseService)
// ─────────────────────────────────────────────────────────────────────────────

interface ServiceResponse<T> {
  success: boolean
  data:    T | null
  error?:  string
}

interface ServiceListResponse<T> {
  success: boolean
  data:    T[]
  count?:  number
  error?:  string
}

// ─────────────────────────────────────────────────────────────────────────────
// UUID guard (same pattern as DatabaseService.getBusinessAccounts)
// ─────────────────────────────────────────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id)
}

// ─────────────────────────────────────────────────────────────────────────────
// AgentService
// ─────────────────────────────────────────────────────────────────────────────

export class AgentService {

  // ── Generic query ─────────────────────────────────────────────────────────

  /**
   * Generic query against any agent-writable table.
   * The type constraint `T extends AgentWritableTableName` ensures only tables
   * the agent actually writes to can be queried through this method.
   *
   * For domain-specific filtering (e.g. status, review_status) use the typed
   * wrapper methods below.
   */
  static async get<T extends AgentWritableTableName>(
    table: T,
    businessAccountId: string,
    options?: {
      limit?:   number
      orderBy?: string
      filters?: Record<string, unknown>
    }
  ): Promise<ServiceListResponse<unknown>> {
    if (!isValidUUID(businessAccountId)) {
      return { success: false, data: [], error: 'Invalid businessAccountId format' }
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from(table as string)
        .select('*', { count: 'exact' })
        .eq('business_account_id', businessAccountId)

      if (options?.filters) {
        for (const [key, value] of Object.entries(options.filters)) {
          query = query.eq(key, value as string)
        }
      }
      if (options?.limit)   query = query.limit(options.limit)
      if (options?.orderBy) query = query.order(options.orderBy, { ascending: false })

      const { data, error, count } = await query
      if (error) throw error
      return { success: true, data: data ?? [], count: count ?? undefined }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`AgentService.get(${table}) failed:`, msg)
      return { success: false, data: [], error: msg }
    }
  }

  // ── Agent health ──────────────────────────────────────────────────────────

  /** Fetch the latest heartbeat rows (most recent first).
   *  Note: agent_heartbeats has no business_account_id column — returns all rows. */
  static async getHeartbeats(limit = 5): Promise<ServiceListResponse<AgentHeartbeat>> {
    try {
      const { data, error } = await supabase
        .from('agent_heartbeats')
        .select('*')
        .order('last_beat_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return { success: true, data: data ?? [] }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('AgentService.getHeartbeats failed:', msg)
      return { success: false, data: [], error: msg }
    }
  }

  /** Fetch computed agent liveness status via backend (single source of truth for LIVENESS_THRESHOLD_MS). */
  static async getAgentStatus(): Promise<ServiceResponse<{ status: import('@/types').AgentHeartbeatStatus; last_beat_at: string | null; agent_id: string | null }>> {
    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://api.888intelligenceautomation.in'
      const { data: { session } } = await supabase.auth.getSession()
      const headers: Record<string, string> = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}

      const res = await fetch(`${apiBaseUrl}/api/instagram/agent/status`, { headers })
      const json = await res.json() as ServiceResponse<{ status: import('@/types').AgentHeartbeatStatus; last_beat_at: string | null; agent_id: string | null }>
      return json
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('AgentService.getAgentStatus failed:', msg)
      return { success: false, data: null, error: msg }
    }
  }

  // ── System alerts ─────────────────────────────────────────────────────────

  /** Fetch system alerts for a business account.
   *  Defaults to unresolved alerts only; pass resolved=true to include all. */
  static async getSystemAlerts(
    businessAccountId: string,
    resolved = false
  ): Promise<ServiceListResponse<SystemAlert>> {
    if (!isValidUUID(businessAccountId)) {
      return { success: false, data: [], error: 'Invalid businessAccountId format' }
    }
    try {
      const { data, error } = await supabase
        .from('system_alerts')
        .select('*')
        .eq('business_account_id', businessAccountId)
        .eq('resolved', resolved)
        .order('created_at', { ascending: false })
      if (error) throw error
      return { success: true, data: data ?? [] }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('AgentService.getSystemAlerts failed:', msg)
      return { success: false, data: [], error: msg }
    }
  }

  /** Mark a system alert as resolved */
  static async resolveAlert(alertId: string): Promise<ServiceResponse<SystemAlert>> {
    if (!isValidUUID(alertId)) {
      return { success: false, data: null, error: 'Invalid alertId format' }
    }
    try {
      const { data, error } = await supabase
        .from('system_alerts')
        .update({ resolved: true, resolved_at: new Date().toISOString() })
        .eq('id', alertId)
        .select()
        .single()
      if (error) throw error
      return { success: true, data }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('AgentService.resolveAlert failed:', msg)
      return { success: false, data: null, error: msg }
    }
  }

  // ── Scheduled posts ───────────────────────────────────────────────────────

  /** Fetch scheduled posts, optionally filtered by status */
  static async getScheduledPosts(
    businessAccountId: string,
    status?: ScheduledPostStatus | 'all',
    limit = 50
  ): Promise<ServiceListResponse<ScheduledPost>> {
    if (!isValidUUID(businessAccountId)) {
      return { success: false, data: [], error: 'Invalid businessAccountId format' }
    }
    try {
      let query = supabase
        .from('scheduled_posts')
        .select('*', { count: 'exact' })
        .eq('business_account_id', businessAccountId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (status && status !== 'all') {
        query = query.eq('status', status)
      }

      const { data, error, count } = await query
      if (error) throw error
      return { success: true, data: data ?? [], count: count ?? undefined }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('AgentService.getScheduledPosts failed:', msg)
      return { success: false, data: [], error: msg }
    }
  }

  /** Update a scheduled post's status (approve / reject / reset to pending) */
  static async updateScheduledPostStatus(
    postId: string,
    status: ScheduledPostStatus
  ): Promise<ServiceResponse<ScheduledPost>> {
    if (!isValidUUID(postId)) {
      return { success: false, data: null, error: 'Invalid postId format' }
    }
    try {
      const { data, error } = await supabase
        .from('scheduled_posts')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', postId)
        .select()
        .single()
      if (error) throw error
      return { success: true, data }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('AgentService.updateScheduledPostStatus failed:', msg)
      return { success: false, data: null, error: msg }
    }
  }

  // ── Attribution queue ─────────────────────────────────────────────────────

  /** Fetch the human review queue for sales attributions */
  static async getAttributionQueue(
    businessAccountId: string,
    reviewStatus?: AttributionReviewStatus | 'all'
  ): Promise<ServiceListResponse<AttributionReview>> {
    if (!isValidUUID(businessAccountId)) {
      return { success: false, data: [], error: 'Invalid businessAccountId format' }
    }
    try {
      let query = supabase
        .from('attribution_review_queue')
        .select('*', { count: 'exact' })
        .eq('business_account_id', businessAccountId)
        .order('created_at', { ascending: false })

      if (reviewStatus && reviewStatus !== 'all') {
        query = query.eq('review_status', reviewStatus)
      }

      const { data, error, count } = await query
      if (error) throw error
      return { success: true, data: data ?? [], count: count ?? undefined }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('AgentService.getAttributionQueue failed:', msg)
      return { success: false, data: [], error: msg }
    }
  }

  /** Submit a review decision on a pending attribution */
  static async reviewAttribution(
    reviewId: string,
    status: AttributionReviewStatus,
    reviewedBy: string
  ): Promise<ServiceResponse<AttributionReview>> {
    if (!isValidUUID(reviewId)) {
      return { success: false, data: null, error: 'Invalid reviewId format' }
    }
    try {
      const { data, error } = await supabase
        .from('attribution_review_queue')
        .update({
          review_status: status,
          reviewed_by:   reviewedBy,
          reviewed_at:   new Date().toISOString(),
        })
        .eq('id', reviewId)
        .select()
        .single()
      if (error) throw error
      return { success: true, data }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('AgentService.reviewAttribution failed:', msg)
      return { success: false, data: null, error: msg }
    }
  }

  // ── Attribution model ─────────────────────────────────────────────────────

  /** Fetch the current attribution model weights for a business account */
  static async getAttributionModel(
    businessAccountId: string
  ): Promise<ServiceResponse<AttributionModel>> {
    if (!isValidUUID(businessAccountId)) {
      return { success: false, data: null, error: 'Invalid businessAccountId format' }
    }
    try {
      const { data, error } = await supabase
        .from('attribution_models')
        .select('*')
        .eq('business_account_id', businessAccountId)
        .single()
      if (error) {
        if (error.code === 'PGRST116') return { success: false, data: null, error: 'No model found' }
        throw error
      }
      return { success: true, data }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('AgentService.getAttributionModel failed:', msg)
      return { success: false, data: null, error: msg }
    }
  }

  // ── Analytics reports ─────────────────────────────────────────────────────

  /** Fetch analytics reports, optionally filtered by report_type */
  static async getAnalyticsReports(
    businessAccountId: string,
    reportType?: ReportType,
    limit = 30
  ): Promise<ServiceListResponse<AnalyticsReport>> {
    if (!isValidUUID(businessAccountId)) {
      return { success: false, data: [], error: 'Invalid businessAccountId format' }
    }
    try {
      let query = supabase
        .from('analytics_reports')
        .select('*', { count: 'exact' })
        .eq('business_account_id', businessAccountId)
        .order('report_date', { ascending: false })
        .limit(limit)

      if (reportType) {
        query = query.eq('report_type', reportType)
      }

      const { data, error, count } = await query
      if (error) throw error
      return { success: true, data: data ?? [], count: count ?? undefined }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('AgentService.getAnalyticsReports failed:', msg)
      return { success: false, data: [], error: msg }
    }
  }

  // ── Queue Monitor (Supabase direct reads + backend retry) ───────────────────
  //
  // Status and DLQ reads query post_queue directly via the Supabase client.
  // RLS policy (authenticated_select_own_post_queue) scopes rows to the
  // authenticated user's business accounts automatically.
  //
  // Retry stays on the backend because it requires service_role to UPDATE.
  // The session access_token is passed as Authorization: Bearer so the backend
  // can verify the user's identity and ownership before resetting the row.

  /** API base URL for backend Express routes (retry only) */
  private static get apiBase(): string {
    return import.meta.env.VITE_API_BASE_URL || 'https://api.888intelligenceautomation.in'
  }

  /** Single query replacing getQueueStatus + getQueueDLQ.
   *  Fetches up to 200 rows, derives histogram and DLQ items from the same result.
   *  Eliminates two independent polling clocks on the same table. */
  static async getQueueOverview(): Promise<ServiceResponse<QueueOverview>> {
    try {
      const { data, error } = await supabase
        .from('post_queue')
        .select('status, action_type, id, business_account_id, payload, retry_count, error, error_category, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(200)

      if (error) throw error

      const byKey: Record<string, number> = {}
      const dlqItems: QueueDLQItem[] = []

      for (const row of (data ?? [])) {
        const key = `${row.action_type}::${row.status}`
        byKey[key] = (byKey[key] ?? 0) + 1
        if (row.status === 'dlq') {
          dlqItems.push(row as QueueDLQItem)
        }
      }

      return {
        success: true,
        data: {
          byKey,
          total: data?.length ?? 0,
          dlqItems,
          timestamp: new Date().toISOString(),
        },
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('AgentService.getQueueOverview failed:', msg)
      return { success: false, data: null, error: msg }
    }
  }

  /** Retry a failed/DLQ queue item via backend API (requires session JWT) */
  static async retryQueueItem(queueId: string): Promise<ServiceResponse<QueueRetryResult>> {
    if (!isValidUUID(queueId)) {
      return { success: false, data: null, error: 'Invalid queueId format' }
    }
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        return { success: false, data: null, error: 'Not authenticated' }
      }

      const response = await fetch(`${this.apiBase}/api/instagram/post-queue/retry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ queue_id: queueId }),
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Failed to retry item' }))
        return { success: false, data: null, error: err.error ?? `HTTP ${response.status}` }
      }
      const result = await response.json()
      return {
        success: true,
        data: {
          queue_id: result.queue_id,
          action_type: result.action_type,
          previous_retry_count: result.previous_retry_count,
          message: result.message,
        },
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('AgentService.retryQueueItem failed:', msg)
      return { success: false, data: null, error: msg }
    }
  }

  // ── Activity Feed (Supabase - Phase 5) ──────────────────────────────────────

  /** Fetch audit log entries from Supabase (client-side filter by business_account_id in details) */
  static async getAuditLog(limit = 50): Promise<ServiceListResponse<AuditLogEntry>> {
    try {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return { success: true, data: data ?? [] }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('AgentService.getAuditLog failed:', msg)
      return { success: false, data: [], error: msg }
    }
  }
}
