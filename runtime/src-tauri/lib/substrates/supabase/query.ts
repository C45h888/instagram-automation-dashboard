/**
 * substrates/supabase/query.ts
 *
 * Generic Supabase query helpers. Shared shape definitions, UUID guards,
 * and semantic substrate wrappers for the queries domains need.
 *
 * Two layers:
 *  1. Types + utility (ServiceResponse, isValidUUID, etc.) — pure, no I/O.
 *  2. Substrate query wrappers (queryAgentHeartbeats, queryBusinessAccounts, etc.)
 *     — perform the actual supabase I/O but normalize errors, validate UUIDs,
 *     and return the standard ServiceResponse/ServiceListResponse shape.
 *
 * Domain files (domains/<x>/*.service.ts) call into the wrappers in layer 2.
 * They MUST NOT import `supabase` directly — that would bypass the substrate.
 * Use `substrates/supabase/client.ts` only from this file.
 */

// ─────────────────────────────────────────────────────────────────────────────
// vite-env types — enables import.meta.env.VITE_* in this compilation unit
// ─────────────────────────────────────────────────────────────────────────────
/// <reference types="vite/client" />

import { supabase } from './client';
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
} from '../../contracts/agent/agent-tables.contract';
import type { QueueOverview, QueueDLQItem } from '../../contracts/agent/agent-tables.contract';
import type { AuditLogEntry } from '../../contracts/agent/agent-tables.contract';
import type { Database } from './database.types';

// ─────────────────────────────────────────────────────────────────────────────
// Response shape contracts
// ─────────────────────────────────────────────────────────────────────────────

export interface ServiceResponse<T> {
  success: boolean;
  data: T | null;
  error?: string;
}

export interface ServiceListResponse<T> {
  success: boolean;
  data: T[];
  error?: string;
  count?: number;
}

export interface DeleteResponse {
  success: boolean;
  error?: string;
  affected?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pagination
// ─────────────────────────────────────────────────────────────────────────────

export interface PaginationOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

// ─────────────────────────────────────────────────────────────────────────────
// UUID guard
//
// Prevents the "invalid input syntax for type uuid" Postgres error when a
// Facebook ID is mistakenly passed where a Supabase UUID is expected.
// ─────────────────────────────────────────────────────────────────────────────

export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers (private to substrate)
// ─────────────────────────────────────────────────────────────────────────────

function failList<T>(error: string): ServiceListResponse<T> {
  return { success: false, data: [], error };
}

function okList<T>(data: T[] | null, count?: number): ServiceListResponse<T> {
  return { success: true, data: data ?? [], count: count ?? 0 };
}

function failOne<T>(error: string): ServiceResponse<T> {
  return { success: false, data: null, error };
}

function okOne<T>(data: T): ServiceResponse<T> {
  return { success: true, data };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ─────────────────────────────────────────────────────────────────────────────
// Generic agent table query
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generic query against any agent-writable table. The type constraint
 * `T extends AgentWritableTableName` ensures only tables the agent actually
 * writes to can be queried through this method.
 */
export async function queryAgentTable<T extends AgentWritableTableName>(
  table: T,
  businessAccountId: string,
  options?: {
    limit?: number;
    orderBy?: string;
    filters?: Record<string, unknown>;
  },
): Promise<ServiceListResponse<unknown>> {
  if (!isValidUUID(businessAccountId)) {
    return failList('Invalid businessAccountId format');
  }
  try {
    let query = (supabase as any)
      .from(table as string)
      .select('*', { count: 'exact' })
      .eq('business_account_id', businessAccountId);

    if (options?.filters) {
      for (const [key, value] of Object.entries(options.filters)) {
        query = query.eq(key, value as string);
      }
    }
    if (options?.limit) query = query.limit(options.limit);
    if (options?.orderBy) query = query.order(options.orderBy, { ascending: false });

    const { data, error, count } = await query;
    if (error) throw error;
    return okList<unknown>(data, count ?? undefined);
  } catch (err) {
    return failList(errorMessage(err));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent health
// ─────────────────────────────────────────────────────────────────────────────

export async function queryAgentHeartbeats(limit = 5): Promise<ServiceListResponse<AgentHeartbeat>> {
  try {
    const { data, error } = await supabase
      .from('agent_heartbeats')
      .select('*')
      .order('last_beat_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return okList<AgentHeartbeat>(data);
  } catch (err) {
    return failList<AgentHeartbeat>(errorMessage(err));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// System alerts
// ─────────────────────────────────────────────────────────────────────────────

export async function querySystemAlerts(
  businessAccountId: string,
  resolved = false,
): Promise<ServiceListResponse<SystemAlert>> {
  if (!isValidUUID(businessAccountId)) {
    return failList<SystemAlert>('Invalid businessAccountId format');
  }
  try {
    const { data, error } = await supabase
      .from('system_alerts')
      .select('*')
      .eq('business_account_id', businessAccountId)
      .eq('resolved', resolved)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return okList<SystemAlert>(data);
  } catch (err) {
    return failList<SystemAlert>(errorMessage(err));
  }
}

export async function updateSystemAlertResolved(alertId: string): Promise<ServiceResponse<SystemAlert>> {
  if (!isValidUUID(alertId)) {
    return failOne<SystemAlert>('Invalid alertId format');
  }
  try {
    const { data, error } = await supabase
      .from('system_alerts')
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq('id', alertId)
      .select()
      .single();
    if (error) throw error;
    return okOne<SystemAlert>(data);
  } catch (err) {
    return failOne<SystemAlert>(errorMessage(err));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Scheduled posts
// ─────────────────────────────────────────────────────────────────────────────

export async function queryScheduledPosts(
  businessAccountId: string,
  status?: ScheduledPostStatus | 'all',
  limit = 50,
): Promise<ServiceListResponse<ScheduledPost>> {
  if (!isValidUUID(businessAccountId)) {
    return failList<ScheduledPost>('Invalid businessAccountId format');
  }
  try {
    let query = supabase
      .from('scheduled_posts')
      .select('*', { count: 'exact' })
      .eq('business_account_id', businessAccountId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;
    if (error) throw error;
    return okList<ScheduledPost>(data, count ?? undefined);
  } catch (err) {
    return failList<ScheduledPost>(errorMessage(err));
  }
}

export async function updateScheduledPostRowStatus(
  postId: string,
  status: ScheduledPostStatus,
): Promise<ServiceResponse<ScheduledPost>> {
  if (!isValidUUID(postId)) {
    return failOne<ScheduledPost>('Invalid postId format');
  }
  try {
    const { data, error } = await supabase
      .from('scheduled_posts')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', postId)
      .select()
      .single();
    if (error) throw error;
    return okOne<ScheduledPost>(data);
  } catch (err) {
    return failOne<ScheduledPost>(errorMessage(err));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Attribution
// ─────────────────────────────────────────────────────────────────────────────

export async function queryAttributionReviewQueue(
  businessAccountId: string,
  reviewStatus?: AttributionReviewStatus | 'all',
): Promise<ServiceListResponse<AttributionReview>> {
  if (!isValidUUID(businessAccountId)) {
    return failList<AttributionReview>('Invalid businessAccountId format');
  }
  try {
    let query = supabase
      .from('attribution_review_queue')
      .select('*', { count: 'exact' })
      .eq('business_account_id', businessAccountId)
      .order('created_at', { ascending: false });

    if (reviewStatus && reviewStatus !== 'all') {
      query = query.eq('review_status', reviewStatus);
    }

    const { data, error, count } = await query;
    if (error) throw error;
    return okList<AttributionReview>(data, count ?? undefined);
  } catch (err) {
    return failList<AttributionReview>(errorMessage(err));
  }
}

export async function updateAttributionReview(
  reviewId: string,
  status: AttributionReviewStatus,
  reviewedBy: string,
): Promise<ServiceResponse<AttributionReview>> {
  if (!isValidUUID(reviewId)) {
    return failOne<AttributionReview>('Invalid reviewId format');
  }
  try {
    const { data, error } = await supabase
      .from('attribution_review_queue')
      .update({
        review_status: status,
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', reviewId)
      .select()
      .single();
    if (error) throw error;
    return okOne<AttributionReview>(data);
  } catch (err) {
    return failOne<AttributionReview>(errorMessage(err));
  }
}

export async function queryAttributionModel(
  businessAccountId: string,
): Promise<ServiceResponse<AttributionModel>> {
  if (!isValidUUID(businessAccountId)) {
    return failOne<AttributionModel>('Invalid businessAccountId format');
  }
  try {
    const { data, error } = await supabase
      .from('attribution_models')
      .select('*')
      .eq('business_account_id', businessAccountId)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return failOne<AttributionModel>('No model found');
      throw error;
    }
    return okOne<AttributionModel>(data);
  } catch (err) {
    return failOne<AttributionModel>(errorMessage(err));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Analytics reports
// ─────────────────────────────────────────────────────────────────────────────

export async function queryAnalyticsReports(
  businessAccountId: string,
  reportType?: ReportType,
  limit = 30,
): Promise<ServiceListResponse<AnalyticsReport>> {
  if (!isValidUUID(businessAccountId)) {
    return failList<AnalyticsReport>('Invalid businessAccountId format');
  }
  try {
    let query = supabase
      .from('analytics_reports')
      .select('*', { count: 'exact' })
      .eq('business_account_id', businessAccountId)
      .order('report_date', { ascending: false })
      .limit(limit);

    if (reportType) {
      query = query.eq('report_type', reportType);
    }

    const { data, error, count } = await query;
    if (error) throw error;
    return okList<AnalyticsReport>(data, count ?? undefined);
  } catch (err) {
    return failList<AnalyticsReport>(errorMessage(err));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Queue monitor
// ─────────────────────────────────────────────────────────────────────────────

export async function queryPostQueueOverview(limit = 200): Promise<ServiceResponse<QueueOverview>> {
  try {
    const { data, error } = await supabase
      .from('post_queue')
      .select('status, action_type, id, business_account_id, payload, retry_count, error, error_category, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const byKey: Record<string, number> = {};
    const dlqItems: QueueDLQItem[] = [];

    for (const row of (data ?? [])) {
      const key = `${row.action_type}::${row.status}`;
      byKey[key] = (byKey[key] ?? 0) + 1;
      if (row.status === 'dlq') {
        dlqItems.push(row as QueueDLQItem);
      }
    }

    return okOne<QueueOverview>({
      byKey,
      total: data?.length ?? 0,
      dlqItems,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return failOne<QueueOverview>(errorMessage(err));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity feed (audit log)
// ─────────────────────────────────────────────────────────────────────────────

export async function queryAuditLog(limit = 50): Promise<ServiceListResponse<AuditLogEntry>> {
  try {
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return okList<AuditLogEntry>(data);
  } catch (err) {
    return failList<AuditLogEntry>(errorMessage(err));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Instagram business accounts
// ─────────────────────────────────────────────────────────────────────────────

type InstagramBusinessAccountRow = Database['public']['Tables']['instagram_business_accounts']['Row'];
type InstagramBusinessAccountInsert = Database['public']['Tables']['instagram_business_accounts']['Insert'];

export async function queryBusinessAccounts(
  userId: string,
): Promise<ServiceListResponse<InstagramBusinessAccountRow>> {
  if (!isValidUUID(userId)) {
    return failList<InstagramBusinessAccountRow>('Invalid user_id format. Expected UUID.');
  }
  try {
    const { data, error, count } = await supabase
      .from('instagram_business_accounts')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('is_connected', true)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return okList<InstagramBusinessAccountRow>(data, count ?? 0);
  } catch (err) {
    return failList<InstagramBusinessAccountRow>(errorMessage(err));
  }
}

export async function upsertBusinessAccount(
  accountData: InstagramBusinessAccountInsert,
): Promise<ServiceResponse<InstagramBusinessAccountRow>> {
  try {
    const { data, error } = await supabase
      .from('instagram_business_accounts')
      .upsert([accountData])
      .select()
      .single();
    if (error) throw error;
    return okOne<InstagramBusinessAccountRow>(data);
  } catch (err) {
    return failOne<InstagramBusinessAccountRow>(errorMessage(err));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GDPR — delete user data rows
//
// Performs the 6 cascading deletes in dependency order. Domain layer
// (domains/gdpr/privacy.service.ts) is responsible for the audit-log
// emission that records this deletion happened.
// ─────────────────────────────────────────────────────────────────────────────

export interface DeleteUserDataOptions {
  deleteProfile?: boolean;
  deleteAccounts?: boolean;
  deleteWorkflows?: boolean;
  deleteAnalytics?: boolean;
  deleteAuditLogs?: boolean;
  deleteNotifications?: boolean;
}

export interface DeleteUserDataResult {
  success: boolean;
  results: Record<string, boolean>;
  error?: string;
}

export async function deleteUserDataRows(
  userId: string,
  options: DeleteUserDataOptions = {},
): Promise<DeleteUserDataResult> {
  const results: Record<string, boolean> = {};

  if (options.deleteWorkflows) {
    const { error } = await supabase
      .from('automation_workflows')
      .delete()
      .eq('user_id', userId);
    results.workflows = !error;
  }

  if (options.deleteAnalytics) {
    const { error } = await supabase
      .from('daily_analytics')
      .delete()
      .eq('user_id', userId);
    results.analytics = !error;
  }

  if (options.deleteAccounts) {
    const { error } = await supabase
      .from('instagram_business_accounts')
      .delete()
      .eq('user_id', userId);
    results.accounts = !error;
  }

  if (options.deleteNotifications) {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId);
    results.notifications = !error;
  }

  if (options.deleteAuditLogs) {
    const { error } = await supabase
      .from('audit_log')
      .delete()
      .eq('user_id', userId);
    results.auditLogs = !error;
  }

  if (options.deleteProfile) {
    const { error } = await supabase
      .from('user_profiles')
      .delete()
      .eq('user_id', userId);
    results.profile = !error;
  }

  return { success: true, results };
}

// ─────────────────────────────────────────────────────────────────────────────
// RPC wrappers (used by consent domain)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generic typed wrapper for a Postgres RPC call. Returns the RPC result
 * cast to the expected type, or a structured error envelope on failure.
 */
async function callRpc<T>(name: string, params: Record<string, unknown>): Promise<ServiceResponse<T>> {
  try {
    const { data, error } = await supabase.rpc(name as any, params);
    if (error) throw error;
    return okOne<T>(data as T);
  } catch (err) {
    return failOne<T>(errorMessage(err));
  }
}

export async function rpcRecordConsent(
  userId: string,
  consentType: string,
  consentGiven: boolean,
  ipAddress: string,
  privacyPolicyVersion?: string,
  termsVersion?: string,
  consentText?: string,
  userAgent?: string,
  browserLanguage?: string,
  consentMethod: string = 'web',
): Promise<ServiceResponse<{ id: string }>> {
  return callRpc<{ id: string }>('record_consent', {
    p_user_id: userId,
    p_consent_type: consentType,
    p_consent_given: consentGiven,
    p_ip_address: ipAddress,
    p_privacy_policy_version: privacyPolicyVersion,
    p_terms_version: termsVersion,
    p_consent_text: consentText,
    p_user_agent: userAgent,
    p_browser_language: browserLanguage,
    p_consent_method: consentMethod,
  });
}

export async function rpcGetActiveConsent(
  userId: string,
  consentType: string,
): Promise<ServiceResponse<boolean>> {
  const result = await callRpc<boolean>('get_active_consent', {
    p_user_id: userId,
    p_consent_type: consentType,
  });
  if (result.success && result.data !== undefined && result.data !== null) {
    return okOne<boolean>(result.data === true);
  }
  return result;
}

export async function rpcRevokeConsent(
  userId: string,
  consentType: string,
  reason?: string,
): Promise<ServiceResponse<boolean>> {
  const result = await callRpc<boolean>('revoke_consent', {
    p_user_id: userId,
    p_consent_type: consentType,
    p_reason: reason,
  });
  if (result.success && result.data !== undefined && result.data !== null) {
    return okOne<boolean>(result.data === true);
  }
  return result;
}

export async function rpcGetConsentHistory(
  userId: string,
  consentType?: string,
): Promise<ServiceResponse<unknown[]>> {
  return callRpc<unknown[]>('get_consent_history', {
    p_user_id: userId,
    p_consent_type: consentType,
  });
}

export async function rpcHasRequiredConsents(
  userId: string,
): Promise<ServiceResponse<{ has_all_required: boolean; missing_consents: string[] }[]>> {
  return callRpc('has_required_consents', { p_user_id: userId });
}