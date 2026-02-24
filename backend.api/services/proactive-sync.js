// backend.api/services/proactive-sync.js
// Proactive data sync: Backend autonomously fetches Instagram data on cron schedules
// and writes to Supabase (Bus 1: proactive). Agent reads from Supabase directly.
// Existing HTTP endpoints remain as Bus 2 (reactive fallback).

const cron = require('node-cron');
const { getSupabaseAdmin, logAudit } = require('../config/supabase');
const { clearCredentialCache } = require('../helpers/agent-helpers');
const {
  fetchAndStoreComments,
  fetchAndStoreConversations,
  fetchAndStoreMessages,
  fetchAndStoreHashtagMedia,
  fetchAndStoreTaggedMedia,
  fetchAndStoreMediaInsights,
} = require('../helpers/data-fetchers');

// ============================================
// CONFIGURATION
// ============================================

const DEFAULT_SCHEDULES = {
  engagement: '*/3 * * * *',   // Every 3 min (agent polls every 5 min)
  ugc:        '0 */3 * * *',   // Every 3 hours (agent polls every 4h)
  insights:   '0 2 * * *',     // Daily at 02:00 UTC (agent runs daily)
};

// Rate-limiting caps per cycle
const ENGAGEMENT_MAX_POSTS = 5;
const ENGAGEMENT_MAX_CONVERSATIONS = 5;
const INTER_ITEM_DELAY_MS = 1000;
const INTER_ACCOUNT_DELAY_MS = 3000;
const UGC_MAX_HASHTAGS = 5;

// ============================================
// HELPERS
// ============================================

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Error Handling Helpers ──────────────────────────────────────────────────

// A1: In-memory rate-limit circuit breaker
const _rateLimitedAccounts = new Map(); // accountId → unblocked_at ms

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
  console.warn(`[ProactiveSync] Account ${accountId} rate-limited for ${retryAfterSeconds || 3600}s`);
}

// A2: Auth-failure disconnect (async, called fire-and-forget from handleFetchError)
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
    console.error(`[ProactiveSync] Account ${accountId} disconnected due to auth_failure`);
  } catch (err) {
    console.warn(`[ProactiveSync] Failed to mark account ${accountId} disconnected:`, err.message);
  }
}

// A3: Result error-handler (sync — callers use return value for flow control)
function handleFetchError(result, accountId) {
  if (!result || result.success) return { skip: false, break: false };

  if (result.error_category === 'auth_failure') {
    markAccountDisconnectedOnAuthFailure(accountId, result.error || 'auth_failure').catch(() => {});
    return { skip: true, break: false };
  }

  if (result.error_category === 'rate_limit') {
    markAccountRateLimited(accountId, result.retry_after_seconds);
    return { skip: false, break: true };
  }

  return { skip: false, break: false };
}

/**
 * Returns all connected business accounts.
 */
async function getActiveAccounts() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('instagram_business_accounts')
    .select('id, instagram_business_id, user_id')
    .eq('is_connected', true)
    .eq('connection_status', 'active');

  if (error) {
    console.error('[ProactiveSync] Failed to fetch active accounts:', error.message);
    return [];
  }
  return data || [];
}

/**
 * Returns recent media IDs for an account (posted within `hours` hours).
 */
async function getRecentMedia(accountId, hours = 48) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const since = new Date(Date.now() - hours * 3600000).toISOString();

  const { data, error } = await supabase
    .from('instagram_media')
    .select('instagram_media_id')
    .eq('business_account_id', accountId)
    .gte('published_at', since)
    .order('published_at', { ascending: false });

  if (error) {
    console.warn('[ProactiveSync] Failed to fetch recent media:', error.message);
    return [];
  }
  return data || [];
}

/**
 * Returns active monitored hashtags for an account.
 */
async function getMonitoredHashtags(accountId) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('ugc_monitored_hashtags')
    .select('hashtag')
    .eq('business_account_id', accountId)
    .eq('is_active', true);

  if (error) {
    console.warn('[ProactiveSync] Failed to fetch hashtags:', error.message);
    return [];
  }
  return (data || []).map(h => h.hashtag);
}

/**
 * Audit wrapper for proactive sync operations.
 */
async function logSyncAudit(syncType, accountId, details) {
  try {
    await logAudit({
      event_type: 'proactive_sync',
      action: `sync_${syncType}`,
      resource_type: syncType,
      resource_id: accountId,
      details: { ...details, sync_type: syncType, timestamp: new Date().toISOString() },
      success: details.success !== false,
    });
  } catch (err) {
    console.warn(`[ProactiveSync] Audit log failed for ${syncType}:`, err.message);
  }
}

// ============================================
// SYNC ENTRY POINTS
// ============================================

/**
 * Proactive engagement sync: comments + conversations + messages.
 * For each active account:
 *   1. Fetch comments for recent media posts
 *   2. Fetch DM conversations
 *   3. Fetch messages for open-window conversations
 */
async function proactiveEngagementSync() {
  const runId = Date.now();
  console.log(`[ProactiveSync:engagement] Starting run #${runId}`);

  const accounts = await getActiveAccounts();
  if (accounts.length === 0) {
    console.log('[ProactiveSync:engagement] No active accounts, skipping');
    return;
  }

  for (const account of accounts) {
    // Rate-limit circuit breaker
    if (isAccountRateLimited(account.id)) {
      console.log(`[ProactiveSync:engagement] Account ${account.id} rate-limited, skipping`);
      await logSyncAudit('engagement', account.id, { success: false, error: 'rate_limited', skipped: true });
      continue;
    }

    try {
      // --- Comments for recent posts ---
      const recentMedia = await getRecentMedia(account.id, 48);
      let totalComments = 0;
      let commentAuthFailed = false;
      const postsToCheck = recentMedia.slice(0, ENGAGEMENT_MAX_POSTS);

      for (const media of postsToCheck) {
        const result = await fetchAndStoreComments(account.id, media.instagram_media_id, 50);
        if (result.success) totalComments += result.count;

        const { skip, break: brk } = handleFetchError(result, account.id);
        if (skip) { commentAuthFailed = true; break; }
        if (brk) break;

        await delay(INTER_ITEM_DELAY_MS);
      }

      await logSyncAudit('comments', account.id, {
        success: !commentAuthFailed,
        posts_checked: postsToCheck.length,
        total_comments: totalComments,
      });

      if (commentAuthFailed) continue; // auth failure — skip rest of this account

      // --- Conversations ---
      const convResult = await fetchAndStoreConversations(account.id, 20);
      const { skip: convSkip, break: convBrk } = handleFetchError(convResult, account.id);
      await logSyncAudit('conversations', account.id, {
        success: convResult.success && !convSkip,
        count: convResult.count,
      });

      if (convSkip || convBrk) {
        await delay(INTER_ACCOUNT_DELAY_MS);
        continue;
      }

      // --- Messages for open-window conversations ---
      if (convResult.success && convResult.conversations) {
        const openConvs = convResult.conversations
          .filter(c => c.within_window || c.messaging_window?.is_open)
          .slice(0, ENGAGEMENT_MAX_CONVERSATIONS);

        let msgAuthFailed = false;
        for (const conv of openConvs) {
          const msgResult = await fetchAndStoreMessages(account.id, conv.id, 20);
          const { skip, break: brk } = handleFetchError(msgResult, account.id);
          if (skip) { msgAuthFailed = true; break; }
          if (brk) break;
          await delay(INTER_ITEM_DELAY_MS);
        }

        await logSyncAudit('messages', account.id, {
          success: !msgAuthFailed,
          conversations_checked: openConvs.length,
        });
      }

      await delay(INTER_ACCOUNT_DELAY_MS);

    } catch (accountError) {
      console.error(`[ProactiveSync:engagement] Account ${account.id} failed:`, accountError.message);
      await logSyncAudit('engagement', account.id, {
        success: false,
        error: accountError.message,
      });
    }
  }

  console.log(`[ProactiveSync:engagement] Run #${runId} complete`);
}

/**
 * Proactive UGC discovery sync: tagged posts + hashtag media.
 * For each active account:
 *   1. Fetch tagged posts
 *   2. Fetch media for each monitored hashtag
 */
async function proactiveUgcSync() {
  const runId = Date.now();
  console.log(`[ProactiveSync:ugc] Starting run #${runId}`);

  const accounts = await getActiveAccounts();
  if (accounts.length === 0) {
    console.log('[ProactiveSync:ugc] No active accounts, skipping');
    return;
  }

  for (const account of accounts) {
    // Rate-limit circuit breaker
    if (isAccountRateLimited(account.id)) {
      console.log(`[ProactiveSync:ugc] Account ${account.id} rate-limited, skipping`);
      await logSyncAudit('ugc', account.id, { success: false, error: 'rate_limited', skipped: true });
      continue;
    }

    try {
      // --- Tagged media ---
      const tagResult = await fetchAndStoreTaggedMedia(account.id, 50);
      const { skip: tagSkip, break: tagBrk } = handleFetchError(tagResult, account.id);
      await logSyncAudit('ugc_tagged', account.id, {
        success: tagResult.success && !tagSkip,
        count: tagResult.count,
      });

      if (tagSkip || tagBrk) {
        await delay(INTER_ACCOUNT_DELAY_MS);
        continue;
      }

      await delay(INTER_ITEM_DELAY_MS);

      // --- Hashtag media ---
      const hashtags = await getMonitoredHashtags(account.id);
      let totalHashtagMedia = 0;
      let hashAuthFailed = false;
      const hashtagsToCheck = hashtags.slice(0, UGC_MAX_HASHTAGS);

      for (const hashtag of hashtagsToCheck) {
        const hashResult = await fetchAndStoreHashtagMedia(account.id, hashtag, 25);
        if (hashResult.success) totalHashtagMedia += hashResult.count;

        const { skip, break: brk } = handleFetchError(hashResult, account.id);
        if (skip) { hashAuthFailed = true; break; }
        if (brk) break;

        await delay(INTER_ITEM_DELAY_MS);
      }

      await logSyncAudit('ugc_hashtags', account.id, {
        success: !hashAuthFailed,
        hashtags_checked: hashtagsToCheck.length,
        total_media: totalHashtagMedia,
      });

      await delay(INTER_ACCOUNT_DELAY_MS);

    } catch (accountError) {
      console.error(`[ProactiveSync:ugc] Account ${account.id} failed:`, accountError.message);
      await logSyncAudit('ugc', account.id, {
        success: false,
        error: accountError.message,
      });
    }
  }

  console.log(`[ProactiveSync:ugc] Run #${runId} complete`);
}

/**
 * Proactive insights sync: media metrics for last 7 days.
 * For each active account: fetch and store media insights.
 */
async function proactiveInsightsSync() {
  const runId = Date.now();
  console.log(`[ProactiveSync:insights] Starting run #${runId}`);

  const accounts = await getActiveAccounts();
  if (accounts.length === 0) {
    console.log('[ProactiveSync:insights] No active accounts, skipping');
    return;
  }

  for (const account of accounts) {
    // Rate-limit circuit breaker
    if (isAccountRateLimited(account.id)) {
      console.log(`[ProactiveSync:insights] Account ${account.id} rate-limited, skipping`);
      await logSyncAudit('insights', account.id, { success: false, error: 'rate_limited', skipped: true });
      continue;
    }

    try {
      const sevenDaysAgo = Math.floor((Date.now() - 7 * 24 * 3600000) / 1000);
      const now = Math.floor(Date.now() / 1000);

      const result = await fetchAndStoreMediaInsights(account.id, sevenDaysAgo, now);
      const { skip, break: brk } = handleFetchError(result, account.id);

      await logSyncAudit('media_insights', account.id, {
        success: result.success && !skip,
        count: result.count,
        error: result.success ? undefined : result.error,
      });

      if (skip || brk) continue;

      await delay(INTER_ACCOUNT_DELAY_MS);

    } catch (accountError) {
      console.error(`[ProactiveSync:insights] Account ${account.id} failed:`, accountError.message);
      await logSyncAudit('insights', account.id, {
        success: false,
        error: accountError.message,
      });
    }
  }

  console.log(`[ProactiveSync:insights] Run #${runId} complete`);
}

// ============================================
// CRON LIFECYCLE
// ============================================

let scheduledJobs = [];

/**
 * Initializes all cron jobs. Call after DB init in server.js.
 * Returns a cleanup function for graceful shutdown.
 *
 * @returns {Function} cleanup — stops all cron jobs
 */
function initScheduledJobs() {
  if (process.env.PROACTIVE_SYNC_ENABLED !== 'true') {
    console.log('[ProactiveSync] Disabled (PROACTIVE_SYNC_ENABLED !== "true")');
    return () => {};
  }

  const schedules = {
    engagement: process.env.PROACTIVE_COMMENTS_CRON || DEFAULT_SCHEDULES.engagement,
    ugc:        process.env.PROACTIVE_UGC_CRON       || DEFAULT_SCHEDULES.ugc,
    insights:   process.env.PROACTIVE_INSIGHTS_CRON   || DEFAULT_SCHEDULES.insights,
  };

  // Validate cron expressions
  for (const [name, expr] of Object.entries(schedules)) {
    if (!cron.validate(expr)) {
      console.error(`[ProactiveSync] Invalid cron expression for ${name}: "${expr}"`);
      return () => {};
    }
  }

  console.log('[ProactiveSync] Initializing scheduled jobs:');
  console.log(`   Engagement (comments+conversations): ${schedules.engagement}`);
  console.log(`   UGC discovery: ${schedules.ugc}`);
  console.log(`   Media insights: ${schedules.insights}`);

  // Overlap guards
  let engagementRunning = false;
  let ugcRunning = false;
  let insightsRunning = false;

  const engagementJob = cron.schedule(schedules.engagement, async () => {
    if (engagementRunning) {
      console.log('[ProactiveSync:engagement] Previous run still active, skipping');
      return;
    }
    engagementRunning = true;
    try {
      await proactiveEngagementSync();
    } catch (err) {
      console.error('[ProactiveSync:engagement] Unhandled error:', err.message);
    } finally {
      engagementRunning = false;
    }
  }, { scheduled: true, timezone: 'UTC' });

  const ugcJob = cron.schedule(schedules.ugc, async () => {
    if (ugcRunning) {
      console.log('[ProactiveSync:ugc] Previous run still active, skipping');
      return;
    }
    ugcRunning = true;
    try {
      await proactiveUgcSync();
    } catch (err) {
      console.error('[ProactiveSync:ugc] Unhandled error:', err.message);
    } finally {
      ugcRunning = false;
    }
  }, { scheduled: true, timezone: 'UTC' });

  const insightsJob = cron.schedule(schedules.insights, async () => {
    if (insightsRunning) {
      console.log('[ProactiveSync:insights] Previous run still active, skipping');
      return;
    }
    insightsRunning = true;
    try {
      await proactiveInsightsSync();
    } catch (err) {
      console.error('[ProactiveSync:insights] Unhandled error:', err.message);
    } finally {
      insightsRunning = false;
    }
  }, { scheduled: true, timezone: 'UTC' });

  // ── Heartbeat failover detector — every 5 min ───────────────────────────────
  // If agent is silent >HEARTBEAT_STALE_MINUTES, mark it 'down' and move any
  // approved scheduled_posts into post_queue so post-fallback.js can publish them.
  const HEARTBEAT_STALE_MINUTES = parseInt(process.env.HEARTBEAT_STALE_MINUTES || '30', 10);
  let heartbeatRunning = false;

  const heartbeatJob = cron.schedule(process.env.POST_FALLBACK_CRON || '*/5 * * * *', async () => {
    if (heartbeatRunning) return;
    heartbeatRunning = true;
    try {
      const supabase = getSupabaseAdmin();
      if (!supabase) return;

      const staleThreshold = new Date(Date.now() - HEARTBEAT_STALE_MINUTES * 60 * 1000).toISOString();

      // Mark stale agents as down
      const { data: downAgents } = await supabase
        .from('agent_heartbeats')
        .update({ status: 'down' })
        .lt('last_beat_at', staleThreshold)
        .eq('status', 'alive')
        .select('agent_id, last_beat_at');

      if (!downAgents?.length) return;

      console.warn(`[Failover] Agent(s) down: ${downAgents.map(a => a.agent_id).join(', ')}`);

      for (const agent of downAgents) {
        const missCount = Math.floor(
          (Date.now() - new Date(agent.last_beat_at).getTime()) / (5 * 60 * 1000)
        );
        if (missCount >= 3) {
          await logAudit({
            event_type: 'agent_down_alert',
            action: 'heartbeat_missed',
            resource_type: 'agent_heartbeats',
            resource_id: agent.agent_id,
            details: { missed_beats: missCount, last_beat_at: agent.last_beat_at },
            success: false,
          }).catch(() => {});
          console.error(`[Failover] ⚠️ Agent ${agent.agent_id} missed ${missCount} heartbeats`);
        }
      }

      // Failover: enqueue approved scheduled_posts older than stale window
      const { data: stuck } = await supabase
        .from('scheduled_posts')
        .select('id, business_account_id, asset_id')
        .eq('status', 'approved')
        .lt('created_at', staleThreshold);

      for (const post of (stuck || [])) {
        const { data: asset } = await supabase
          .from('instagram_assets')
          .select('storage_path, media_type')
          .eq('id', post.asset_id)
          .single();

        if (!asset) continue;

        // Lazy require avoids circular dependency (agent-helpers imports config/supabase)
        const { insertQueueRow } = require('../helpers/agent-helpers');
        const crypto = require('crypto');
        const idemKey = crypto.createHash('sha256')
          .update(`failover_publish:${post.id}`)
          .digest('hex');

        await insertQueueRow(supabase, {
          business_account_id: post.business_account_id,
          action_type: 'publish_post',
          payload: {
            image_url: asset.storage_path,
            media_type: asset.media_type || 'IMAGE',
            scheduled_post_id: post.id,
          },
          idempotency_key: idemKey,
        });

        // Mark as publishing so we don't re-insert on the next tick
        await supabase
          .from('scheduled_posts')
          .update({ status: 'publishing' })
          .eq('id', post.id);

        console.log(`[Failover] Enqueued publish_post for scheduled_post ${post.id}`);
      }
    } catch (err) {
      console.error('[Failover] Heartbeat cron error:', err.message);
    } finally {
      heartbeatRunning = false;
    }
  }, { scheduled: true, timezone: 'UTC' });

  scheduledJobs = [engagementJob, ugcJob, insightsJob, heartbeatJob];
  console.log(`[ProactiveSync] ${scheduledJobs.length} jobs scheduled`);

  return function stopScheduledJobs() {
    console.log('[ProactiveSync] Stopping all scheduled jobs...');
    for (const job of scheduledJobs) {
      job.stop();
    }
    scheduledJobs = [];
    console.log('[ProactiveSync] All jobs stopped');
  };
}

module.exports = {
  initScheduledJobs,
  // Exposed for manual testing
  proactiveEngagementSync,
  proactiveUgcSync,
  proactiveInsightsSync,
  // Exposed for unit testing
  getActiveAccounts,
  getRecentMedia,
  getMonitoredHashtags,
  // Shared in-memory rate-limit circuit breaker — used by post-fallback.js
  isAccountRateLimited,
  markAccountRateLimited,
};
