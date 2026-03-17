// backend.api/services/sync/media.js
// Proactive media posts sync: business account's own media feed.
// Runs every 6 hours (cron: 0 */6 * * *) via services/sync/index.js.
//
// Data flow:
//   node-cron → proactiveMediaSync()
//     → fetchAndStoreBusinessPosts() → instagram_media (caption, media_url, permalink, published_at)

const {
  delay,
  isAccountRateLimited,
  handleFetchError,
  getActiveAccounts,
  logSyncAudit,
} = require('./helpers');

const {
  fetchAndStoreBusinessPosts,
} = require('../../helpers/data-fetchers/media-fetchers');

const INTER_ACCOUNT_DELAY_MS =
  parseInt(process.env.SYNC_MEDIA_DELAY_MS || '3000', 10);

/**
 * Proactive media posts sync: fetches the business account's own media feed
 * and writes full post data to instagram_media.
 * This populates the table read by GET /media/:accountId.
 */
async function proactiveMediaSync() {
  const runId    = Date.now();
  const startTime = runId;
  console.log(`[Sync:media] Starting run #${runId}`);

  // Lifecycle start marker
  await logSyncAudit('media', null, { run_id: runId, status: 'started' });

  const accounts = await getActiveAccounts();
  if (accounts.length === 0) {
    console.log('[Sync:media] No active accounts, skipping');
    return;
  }

  for (const account of accounts) {
    if (isAccountRateLimited(account.id)) {
      console.log(`[Sync:media] Account ${account.id} rate-limited, skipping`);
      await logSyncAudit('media', account.id, {
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
      const result = await fetchAndStoreBusinessPosts(account.id, 50);
      const { skip, break: brk } = handleFetchError(result, account.id);

      await logSyncAudit('media_posts', account.id, {
        run_id:        runId,
        duration_ms:   Date.now() - startTime,
        items_fetched: result.count || 0,
        errors_count:  (skip || brk) ? 1 : 0,
        success:       result.success && !skip,
        status:        (skip || brk) ? 'error' : 'completed',
        count:         result.count,
        error_message: result.success ? undefined : result.error,
      });

      if (skip || brk) continue;

    } catch (accountError) {
      console.error(`[Sync:media] Account ${account.id} failed:`, accountError.message);
      await logSyncAudit('media', account.id, {
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

    // Note: delay is after try/catch — runs even on skip/brk to pace between accounts
    await delay(INTER_ACCOUNT_DELAY_MS);
  }

  console.log(`[Sync:media] Run #${runId} complete`);
}

module.exports = { proactiveMediaSync };
