// backend.api/services/proactive-sync.js
// Proactive data sync: Backend autonomously fetches Instagram data on cron schedules
// and writes to Supabase (Bus 1: proactive). Agent reads from Supabase directly.
// Existing HTTP endpoints remain as Bus 2 (reactive fallback).

const cron = require('node-cron');
const { getSupabaseAdmin, logAudit } = require('../config/supabase');
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

/**
 * Returns all connected business accounts.
 */
async function getActiveAccounts() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('instagram_business_accounts')
    .select('id, instagram_business_id, user_id')
    .eq('is_connected', true);

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
    try {
      // --- Comments for recent posts ---
      const recentMedia = await getRecentMedia(account.id, 48);
      let totalComments = 0;
      const postsToCheck = recentMedia.slice(0, ENGAGEMENT_MAX_POSTS);

      for (const media of postsToCheck) {
        const result = await fetchAndStoreComments(account.id, media.instagram_media_id, 50);
        if (result.success) totalComments += result.count;
        await delay(INTER_ITEM_DELAY_MS);
      }

      await logSyncAudit('comments', account.id, {
        success: true,
        posts_checked: postsToCheck.length,
        total_comments: totalComments,
      });

      // --- Conversations ---
      const convResult = await fetchAndStoreConversations(account.id, 20);
      await logSyncAudit('conversations', account.id, {
        success: convResult.success,
        count: convResult.count,
      });

      // --- Messages for open-window conversations ---
      if (convResult.success && convResult.conversations) {
        const openConvs = convResult.conversations
          .filter(c => c.within_window || c.messaging_window?.is_open)
          .slice(0, ENGAGEMENT_MAX_CONVERSATIONS);

        for (const conv of openConvs) {
          await fetchAndStoreMessages(account.id, conv.id, 20);
          await delay(INTER_ITEM_DELAY_MS);
        }

        await logSyncAudit('messages', account.id, {
          success: true,
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
    try {
      // --- Tagged media ---
      const tagResult = await fetchAndStoreTaggedMedia(account.id, 50);
      await logSyncAudit('ugc_tagged', account.id, {
        success: tagResult.success,
        count: tagResult.count,
      });

      await delay(INTER_ITEM_DELAY_MS);

      // --- Hashtag media ---
      const hashtags = await getMonitoredHashtags(account.id);
      let totalHashtagMedia = 0;
      const hashtagsToCheck = hashtags.slice(0, UGC_MAX_HASHTAGS);

      for (const hashtag of hashtagsToCheck) {
        const hashResult = await fetchAndStoreHashtagMedia(account.id, hashtag, 25);
        if (hashResult.success) totalHashtagMedia += hashResult.count;
        await delay(INTER_ITEM_DELAY_MS);
      }

      await logSyncAudit('ugc_hashtags', account.id, {
        success: true,
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
    try {
      const sevenDaysAgo = Math.floor((Date.now() - 7 * 24 * 3600000) / 1000);
      const now = Math.floor(Date.now() / 1000);

      const result = await fetchAndStoreMediaInsights(account.id, sevenDaysAgo, now);

      await logSyncAudit('media_insights', account.id, {
        success: result.success,
        count: result.count,
      });

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

  scheduledJobs = [engagementJob, ugcJob, insightsJob];
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
};
