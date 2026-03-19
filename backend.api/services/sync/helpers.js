// backend.api/services/sync/helpers.js
// Shared infrastructure for all proactive sync domains:
//   - Rate-limit circuit breaker (shared with post-fallback.js)
//   - Auth failure strike counter
//   - DB query helpers (getActiveAccounts, getRecentMedia, getMonitoredHashtags)
//   - Enhanced logSyncAudit (writes structured run metadata to audit_log)
//
// Module-level Maps are singletons via Node cache — all domain files
// and post-fallback.js share the same circuit breaker state.

const { randomUUID } = require('crypto');
const { getSupabaseAdmin, logAudit } = require('../../config/supabase');
const { clearCredentialCache, logDataBusEvent } = require('../../helpers/agent-helpers');

// ── In-memory state ──────────────────────────────────────────────────────────

const _rateLimitedAccounts = new Map(); // accountId → unblocked_at ms
const _authFailureStrikes  = new Map(); // accountId → strike count
const AUTH_FAILURE_MAX_STRIKES = 3;

let _accountsCache = { data: [], expiresAt: 0 };
const ACCOUNTS_CACHE_TTL_MS = 30 * 1000; // 30s — covers inter-cron overlap window

// ── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Generates a UUID for correlating all log entries within one cron tick. */
function generateRunId() {
  return randomUUID();
}

/**
 * Writes a run-level aggregate row to sync_run_log.
 * Called twice per domain run: once at start (status='run_started'), once at end (status='run_completed').
 * This is the authoritative source for the /sync/health endpoint and stale-domain watchdog.
 * Do NOT use logSyncAudit for run-level markers — those go here instead.
 */
async function writeSyncRunLog(entry) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  await supabase.from('sync_run_log').insert(entry).catch((err) => {
    console.warn('[Sync:helpers] writeSyncRunLog failed:', err.message);
  });
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
  logAudit({
    event_type: 'rate_limit_triggered',
    action: 'circuit_breaker',
    resource_type: 'instagram_business_account',
    resource_id: null,
    details: { account_id: accountId, retry_after_seconds: retryAfterSeconds || 3600, source: 'proactive_sync' },
    success: false,
  }).catch(() => {});
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
    clearAccountsCache(); // disconnected account must be excluded from next cron tick immediately
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

    logAudit({
      event_type: 'auth_failure_strike',
      action: 'circuit_breaker',
      resource_type: 'instagram_business_account',
      resource_id: null,
      details: { account_id: accountId, strike: strikes, max: AUTH_FAILURE_MAX_STRIKES },
      success: false,
    }).catch(() => {});

    if (strikes >= AUTH_FAILURE_MAX_STRIKES) {
      _authFailureStrikes.delete(accountId);
      markAccountDisconnectedOnAuthFailure(accountId, result.error || 'auth_failure').catch(() => {});
      logDataBusEvent('sync', 'token_expired_mid_run', {
        account_id: accountId,
        error_code: result.code || null,
        domain: result.domain || null,
        success: false,
      }).catch(() => {});
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
  if (Date.now() < _accountsCache.expiresAt) return _accountsCache.data;

  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('instagram_business_accounts')
    .select('id, instagram_business_id, user_id')
    .eq('is_connected', true)
    .eq('connection_status', 'active');

  if (error) {
    console.error('[Sync:helpers] Failed to fetch active accounts:', error.message);
    return _accountsCache.data; // serve stale on DB error — blip shouldn't halt all cron processing
  }

  _accountsCache = { data: data || [], expiresAt: Date.now() + ACCOUNTS_CACHE_TTL_MS };
  return _accountsCache.data;
}

function clearAccountsCache() {
  _accountsCache = { data: [], expiresAt: 0 };
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

// ── Parallel Batch Runner ─────────────────────────────────────────────────────

/**
 * Runs asyncFn over items in parallel batches of `concurrency`.
 * Uses Promise.allSettled — one failure never cancels other calls in the same batch.
 * Results are returned in INPUT ORDER (allSettled preserves order).
 * Rejected promises are normalised to { success: false, error: reason.message }.
 *
 * @param {Array}    items           - items to process
 * @param {Function} asyncFn         - (item) => Promise<result>
 * @param {number}   [concurrency=3] - max simultaneous calls per batch
 * @param {number}   [batchDelayMs=200] - courtesy pause between batches
 * @returns {Promise<Array>}         - flat result array, same order as input
 */
async function runConcurrent(items, asyncFn, concurrency = 3, batchDelayMs = 200) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const settled = await Promise.allSettled(batch.map(asyncFn));
    for (const s of settled) {
      results.push(
        s.status === 'fulfilled'
          ? s.value
          : { success: false, error: s.reason?.message || 'unknown' }
      );
    }
    if (i + concurrency < items.length) await delay(batchDelayMs);
  }
  return results;
}

// ── Stale Domain Watchdog ─────────────────────────────────────────────────────

/**
 * Checks whether each sync domain has run within its expected window.
 * Inserts a system_alert if a domain is overdue.
 * Called from index.js every 5 min via the heartbeat failover cron.
 */
async function checkStaleDomains() {
  const THRESHOLDS = {
    engagement:   9  * 60 * 1000,          // 9 min  (runs every 3 min)
    ugc:          9  * 60 * 60 * 1000,      // 9 h    (runs every 3 h)
    media:        18 * 60 * 60 * 1000,      // 18 h   (runs every 6 h)
    insights:     48 * 60 * 60 * 1000,      // 48 h   (runs daily)
    token_health: 48 * 60 * 60 * 1000,      // 48 h   (runs daily)
  };
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  for (const [domain, thresholdMs] of Object.entries(THRESHOLDS)) {
    const { data } = await supabase
      .from('sync_run_log')
      .select('completed_at')
      .eq('domain', domain)
      .eq('status', 'run_completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastRun = data?.completed_at ? new Date(data.completed_at).getTime() : 0;
    if (Date.now() - lastRun > thresholdMs) {
      await supabase
        .from('system_alerts')
        .insert({
          alert_type: 'sync_stale',
          message: `${domain} sync has not completed in expected window`,
          details: {
            domain,
            last_completed_at: data?.completed_at || null,
            threshold_ms: thresholdMs,
            source: 'stale_domain_watchdog',
          },
          resolved: false,
        })
        .catch((err) => {
          console.warn(`[Sync:helpers] checkStaleDomains alert insert failed for ${domain}:`, err.message);
        });
      console.warn(`[Sync:helpers] Stale domain detected: ${domain} (last run: ${data?.completed_at || 'never'})`);
    }
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  delay,
  generateRunId,
  writeSyncRunLog,
  checkStaleDomains,
  runConcurrent,
  _rateLimitedAccounts,
  _authFailureStrikes,
  isAccountRateLimited,
  markAccountRateLimited,
  handleFetchError,
  getActiveAccounts,
  clearAccountsCache,
  getRecentMedia,
  getMonitoredHashtags,
  logSyncAudit,
};
