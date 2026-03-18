// backend.api/services/sync/engagement.js
// Proactive engagement sync: comments (every 6h) + conversations/messages (every 3 min).
//
// Two separate exported functions — each wired to its own cron in services/sync/index.js:
//
//   proactiveCommentSync()     → comment fetching for N most recent posts (every 6h)
//   proactiveEngagementSync()  → DM conversations + messages (every 3 min)
//
// Data flow:
//   node-cron (6h)  → proactiveCommentSync()
//     → fetchAndStoreComments()     → instagram_comments
//
//   node-cron (3m)  → proactiveEngagementSync()
//     → fetchAndStoreConversations() → instagram_dm_conversations
//     → fetchAndStoreMessages()      → instagram_dm_messages

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

const COMMENT_MAX_POSTS          = 5;
const ENGAGEMENT_MAX_CONVERSATIONS = 5;
const INTER_ITEM_DELAY_MS          = 1000;
const INTER_ACCOUNT_DELAY_MS       =
  parseInt(process.env.SYNC_ENGAGEMENT_DELAY_MS || '3000', 10);

// ── Comment Sync ──────────────────────────────────────────────────────────────

/**
 * Proactive comment sync — runs every 6 hours.
 * Fetches comments for the N most recent posts regardless of age.
 * Decoupled from DM sync so heavy Meta API calls don't block real-time DM pipeline.
 */
async function proactiveCommentSync() {
  const runId     = Date.now();
  const startTime = runId;
  console.log(`[Sync:comments] Starting run #${runId}`);

  await logSyncAudit('comments', null, { run_id: runId, status: 'started' });

  const accounts = await getActiveAccounts();
  if (accounts.length === 0) {
    console.log('[Sync:comments] No active accounts, skipping');
    return;
  }

  for (const account of accounts) {
    if (isAccountRateLimited(account.id)) {
      console.log(`[Sync:comments] Account ${account.id} rate-limited, skipping`);
      await logSyncAudit('comments', account.id, {
        run_id:        runId,
        duration_ms:   Date.now() - startTime,
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
      const recentMedia = await getRecentMedia(account.id);
      let totalComments    = 0;
      let commentAuthFailed = false;
      const postsToCheck   = recentMedia.slice(0, COMMENT_MAX_POSTS);

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

      await delay(INTER_ACCOUNT_DELAY_MS);

    } catch (accountError) {
      console.error(`[Sync:comments] Account ${account.id} failed:`, accountError.message);
      await logSyncAudit('comments', account.id, {
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

  console.log(`[Sync:comments] Run #${runId} complete`);
}

// ── DM Sync (Conversations + Messages) ───────────────────────────────────────

/**
 * Proactive DM engagement sync — runs every 3 minutes.
 * Handles conversations and messages only. Comment fetching moved to proactiveCommentSync.
 */
async function proactiveEngagementSync() {
  const runId     = Date.now();
  const startTime = runId;
  console.log(`[Sync:engagement] Starting run #${runId}`);

  await logSyncAudit('engagement', null, { run_id: runId, status: 'started' });

  const accounts = await getActiveAccounts();
  if (accounts.length === 0) {
    console.log('[Sync:engagement] No active accounts, skipping');
    return;
  }

  for (const account of accounts) {
    if (isAccountRateLimited(account.id)) {
      console.log(`[Sync:engagement] Account ${account.id} rate-limited, skipping`);
      await logSyncAudit('engagement', account.id, {
        run_id:        runId,
        duration_ms:   Date.now() - startTime,
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
        run_id:           runId,
        duration_ms:      Date.now() - startTime,
        items_fetched:    0,
        errors_count:     1,
        success:          false,
        status:           'error',
        error_message:    accountError.message,
        skipped_accounts: 1,
      });
    }
  }

  console.log(`[Sync:engagement] Run #${runId} complete`);
}

module.exports = { proactiveCommentSync, proactiveEngagementSync };
