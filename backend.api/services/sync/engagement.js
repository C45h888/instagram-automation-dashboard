// backend.api/services/sync/engagement.js
// Proactive engagement sync: comments + conversations + messages.
// Runs every 3 min (cron: */3 * * * *) via services/sync/index.js.
//
// Data flow:
//   node-cron → proactiveEngagementSync()
//     → fetchAndStoreComments()     → instagram_comments
//     → fetchAndStoreConversations() → instagram_dm_conversations
//     → fetchAndStoreMessages()     → instagram_dm_messages

const {
  delay,
  isAccountRateLimited,
  handleFetchError,
  getActiveAccounts,
  getRecentMedia,
  logSyncAudit,
} = require('./helpers');

const {
  fetchAndStoreComments,
  fetchAndStoreConversations,
  fetchAndStoreMessages,
} = require('../../helpers/data-fetchers/messaging-fetchers');

const ENGAGEMENT_MAX_POSTS         = 5;
const ENGAGEMENT_MAX_CONVERSATIONS = 5;
const INTER_ITEM_DELAY_MS          = 1000;
const INTER_ACCOUNT_DELAY_MS       =
  parseInt(process.env.SYNC_ENGAGEMENT_DELAY_MS || '3000', 10);

/**
 * Proactive engagement sync: comments + conversations + messages.
 * For each active account:
 *   1. Fetch comments for recent media posts
 *   2. Fetch DM conversations
 *   3. Fetch messages for open-window conversations
 */
async function proactiveEngagementSync() {
  const runId    = Date.now();
  const startTime = runId;
  console.log(`[Sync:engagement] Starting run #${runId}`);

  // Lifecycle start marker
  await logSyncAudit('engagement', null, { run_id: runId, status: 'started' });

  const accounts = await getActiveAccounts();
  if (accounts.length === 0) {
    console.log('[Sync:engagement] No active accounts, skipping');
    return;
  }

  for (const account of accounts) {
    // Rate-limit circuit breaker
    if (isAccountRateLimited(account.id)) {
      console.log(`[Sync:engagement] Account ${account.id} rate-limited, skipping`);
      await logSyncAudit('engagement', account.id, {
        run_id:       runId,
        duration_ms:  Date.now() - startTime,
        items_fetched: 0,
        errors_count:  0,
        skipped:       true,
        success:       false,
        status:        'skipped',
        error_message: 'rate_limited',
      });
      continue;
    }

    try {
      // ── Comments for recent posts ────────────────────────────────────────
      const recentMedia = await getRecentMedia(account.id, 48);
      let totalComments   = 0;
      let commentAuthFailed = false;
      const postsToCheck  = recentMedia.slice(0, ENGAGEMENT_MAX_POSTS);

      for (const media of postsToCheck) {
        const result = await fetchAndStoreComments(account.id, media.instagram_media_id, 50);
        if (result.success) totalComments += result.count;

        const { skip, break: brk } = handleFetchError(result, account.id);
        if (skip) { commentAuthFailed = true; break; }
        if (brk) break;

        await delay(INTER_ITEM_DELAY_MS);
      }

      await logSyncAudit('comments', account.id, {
        run_id:         runId,
        duration_ms:    Date.now() - startTime,
        items_fetched:  totalComments,
        errors_count:   commentAuthFailed ? 1 : 0,
        success:        !commentAuthFailed,
        status:         commentAuthFailed ? 'error' : 'completed',
        posts_checked:  postsToCheck.length,
        total_comments: totalComments,
      });

      if (commentAuthFailed) continue; // auth failure — skip rest of this account

      // ── Conversations ────────────────────────────────────────────────────
      const convResult = await fetchAndStoreConversations(account.id, 20);
      const { skip: convSkip, break: convBrk } = handleFetchError(convResult, account.id);

      await logSyncAudit('conversations', account.id, {
        run_id:        runId,
        duration_ms:   Date.now() - startTime,
        items_fetched: convResult.count || 0,
        errors_count:  (convSkip || convBrk) ? 1 : 0,
        success:       convResult.success && !convSkip,
        status:        (convSkip || convBrk) ? 'error' : 'completed',
        count:         convResult.count,
      });

      if (convSkip || convBrk) {
        await delay(INTER_ACCOUNT_DELAY_MS);
        continue;
      }

      // ── Messages for open-window conversations ───────────────────────────
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
          run_id:                runId,
          duration_ms:           Date.now() - startTime,
          items_fetched:         openConvs.length,
          errors_count:          msgAuthFailed ? 1 : 0,
          success:               !msgAuthFailed,
          status:                msgAuthFailed ? 'error' : 'completed',
          conversations_checked: openConvs.length,
        });
      }

      await delay(INTER_ACCOUNT_DELAY_MS);

    } catch (accountError) {
      console.error(`[Sync:engagement] Account ${account.id} failed:`, accountError.message);
      await logSyncAudit('engagement', account.id, {
        run_id:          runId,
        duration_ms:     Date.now() - startTime,
        items_fetched:   0,
        errors_count:    1,
        success:         false,
        status:          'error',
        error_message:   accountError.message,
        skipped_accounts: 1,
      });
    }
  }

  console.log(`[Sync:engagement] Run #${runId} complete`);
}

module.exports = { proactiveEngagementSync };
