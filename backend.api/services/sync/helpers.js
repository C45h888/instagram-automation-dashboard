// backend.api/services/sync/helpers.js
// Shared infrastructure for all proactive sync domains:
//   - Rate-limit circuit breaker (shared with post-fallback.js)
//   - Auth failure strike counter
//   - DB query helpers (getActiveAccounts, getRecentMedia, getMonitoredHashtags)
//   - Enhanced logSyncAudit (writes structured run metadata to audit_log)
//
// Module-level Maps are singletons via Node cache — all domain files
// and post-fallback.js share the same circuit breaker state.

const { getSupabaseAdmin, logAudit } = require('../../config/supabase');
const { clearCredentialCache } = require('../../helpers/agent-helpers');

// ── In-memory state ──────────────────────────────────────────────────────────

const _rateLimitedAccounts = new Map(); // accountId → unblocked_at ms
const _authFailureStrikes  = new Map(); // accountId → strike count
const AUTH_FAILURE_MAX_STRIKES = 3;

// ── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Circuit Breaker ──────────────────────────────────────────────────────────

function isAccountRateLimited(accountId) {
  const unblocked = _rateLimitedAccounts.get(accountId);
  if (!unblocked) return false;
  if (Date.now() >= unblocked) {
    _rateLimitedAccounts.delete(accountId);
    return false;
  }
  return true;
}

function markAccountRateLimited(accountId, retryAfterSeconds) {
  const cooldown = (retryAfterSeconds || 3600) * 1000;
  _rateLimitedAccounts.set(accountId, Date.now() + cooldown);
  console.warn(`[Sync:helpers] Account ${accountId} rate-limited for ${retryAfterSeconds || 3600}s`);
}

// Async — called fire-and-forget from handleFetchError
async function markAccountDisconnectedOnAuthFailure(accountId, errorMessage) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  try {
    await supabase
      .from('instagram_business_accounts')
      .update({ is_connected: false, connection_status: 'disconnected' })
      .eq('id', accountId);

    await supabase
      .from('system_alerts')
      .insert({
        alert_type: 'auth_failure',
        business_account_id: accountId,
        message: `Proactive sync auth failure: ${errorMessage}`,
        details: { source: 'proactive_sync', error: errorMessage, occurred_at: new Date().toISOString() },
        resolved: false,
      });

    clearCredentialCache(accountId);
    console.error(`[Sync:helpers] Account ${accountId} disconnected due to auth_failure`);
  } catch (err) {
    console.warn(`[Sync:helpers] Failed to mark account ${accountId} disconnected:`, err.message);
  }
}

// Sync — callers use return value for flow control
// Returns { skip: boolean, break: boolean }
function handleFetchError(result, accountId) {
  if (!result || result.success) {
    _authFailureStrikes.delete(accountId);
    return { skip: false, break: false };
  }

  if (result.error_category === 'auth_failure') {
    const strikes = (_authFailureStrikes.get(accountId) || 0) + 1;
    _authFailureStrikes.set(accountId, strikes);
    console.warn(`[Sync:helpers] Account ${accountId} auth_failure strike ${strikes}/${AUTH_FAILURE_MAX_STRIKES}`);

    if (strikes >= AUTH_FAILURE_MAX_STRIKES) {
      _authFailureStrikes.delete(accountId);
      markAccountDisconnectedOnAuthFailure(accountId, result.error || 'auth_failure').catch(() => {});
    }
    return { skip: true, break: false };
  }

  if (result.error_category === 'rate_limit') {
    markAccountRateLimited(accountId, result.retry_after_seconds);
    return { skip: false, break: true };
  }

  return { skip: false, break: false };
}

// ── DB Query Helpers ─────────────────────────────────────────────────────────

async function getActiveAccounts() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('instagram_business_accounts')
    .select('id, instagram_business_id, user_id')
    .eq('is_connected', true)
    .eq('connection_status', 'active');

  if (error) {
    console.error('[Sync:helpers] Failed to fetch active accounts:', error.message);
    return [];
  }
  return data || [];
}

async function getRecentMedia(accountId) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  // No time filter — always return the N most recent posts regardless of age.
  // Comment sync (proactiveCommentSync) slices to COMMENT_MAX_POSTS at call site.
  // Fetching 10 here gives the caller room to cap without a second DB query.
  const { data, error } = await supabase
    .from('instagram_media')
    .select('instagram_media_id')
    .eq('business_account_id', accountId)
    .order('published_at', { ascending: false })
    .limit(10);

  if (error) {
    console.warn('[Sync:helpers] Failed to fetch recent media:', error.message);
    return [];
  }
  return data || [];
}

async function getMonitoredHashtags(accountId) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('ugc_monitored_hashtags')
    .select('hashtag')
    .eq('business_account_id', accountId)
    .eq('is_active', true);

  if (error) {
    console.warn('[Sync:helpers] Failed to fetch hashtags:', error.message);
    return [];
  }
  return (data || []).map(h => h.hashtag);
}

// ── Enhanced Audit Logging ───────────────────────────────────────────────────

/**
 * Writes a structured sync run entry to audit_log.
 *
 * Standard details shape (callers supply all fields):
 * {
 *   run_id:            number   — Date.now() captured at function entry
 *   status:            string   — 'started' | 'completed' | 'error'
 *   duration_ms:       number   — Date.now() - startTime (omit on 'started')
 *   items_fetched:     number
 *   errors_count:      number
 *   skipped:           boolean
 *   success:           boolean
 *   // domain-specific optional fields:
 *   posts_checked, total_comments, conversations_checked,
 *   hashtags_checked, total_media, count, error_message, skipped_accounts
 * }
 *
 * Queryable:
 *   SELECT action, details->>'run_id', details->>'duration_ms',
 *          details->>'items_fetched', details->>'errors_count', success, created_at
 *   FROM audit_log
 *   WHERE event_type = 'proactive_sync'
 *   ORDER BY created_at DESC LIMIT 20;
 */
async function logSyncAudit(syncType, accountId, details) {
  try {
    await logAudit({
      event_type:    'proactive_sync',
      action:        `sync_${syncType}`,
      resource_type: syncType,
      resource_id:   accountId,
      details: {
        sync_type:  syncType,
        timestamp:  new Date().toISOString(),
        ...details,
      },
      success: details.success !== false,
    });
  } catch (err) {
    console.warn(`[Sync:${syncType}] Audit log failed:`, err.message);
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  delay,
  _rateLimitedAccounts,
  _authFailureStrikes,
  isAccountRateLimited,
  markAccountRateLimited,
  handleFetchError,
  getActiveAccounts,
  getRecentMedia,
  getMonitoredHashtags,
  logSyncAudit,
};
