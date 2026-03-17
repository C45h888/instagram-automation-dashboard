// backend.api/services/sync/ugc.js
// Proactive UGC discovery sync: tagged posts + hashtag media.
// Runs every 3 hours (cron: 0 */3 * * *) via services/sync/index.js.
//
// Data flow:
//   node-cron → proactiveUgcSync()
//     → fetchAndStoreTaggedMedia()   → ugc_content (source: 'tagged')
//     → fetchAndStoreHashtagMedia()  → ugc_content (source: 'hashtag')

const {
  delay,
  isAccountRateLimited,
  handleFetchError,
  getActiveAccounts,
  getMonitoredHashtags,
  logSyncAudit,
} = require('./helpers');

const {
  fetchAndStoreHashtagMedia,
  fetchAndStoreTaggedMedia,
} = require('../../helpers/data-fetchers/ugc-fetchers');

const UGC_MAX_HASHTAGS       = 5;
const INTER_ITEM_DELAY_MS    = 1000;
const INTER_ACCOUNT_DELAY_MS =
  parseInt(process.env.SYNC_UGC_DELAY_MS || '3000', 10);

/**
 * Proactive UGC discovery sync: tagged posts + hashtag media.
 * For each active account:
 *   1. Fetch tagged posts
 *   2. Fetch media for each monitored hashtag
 */
async function proactiveUgcSync() {
  const runId    = Date.now();
  const startTime = runId;
  console.log(`[Sync:ugc] Starting run #${runId}`);

  // Lifecycle start marker
  await logSyncAudit('ugc', null, { run_id: runId, status: 'started' });

  const accounts = await getActiveAccounts();
  if (accounts.length === 0) {
    console.log('[Sync:ugc] No active accounts, skipping');
    return;
  }

  for (const account of accounts) {
    // Rate-limit circuit breaker
    if (isAccountRateLimited(account.id)) {
      console.log(`[Sync:ugc] Account ${account.id} rate-limited, skipping`);
      await logSyncAudit('ugc', account.id, {
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
      // ── Tagged media ─────────────────────────────────────────────────────
      const tagResult = await fetchAndStoreTaggedMedia(account.id, 50);
      const { skip: tagSkip, break: tagBrk } = handleFetchError(tagResult, account.id);

      await logSyncAudit('ugc_tagged', account.id, {
        run_id:        runId,
        duration_ms:   Date.now() - startTime,
        items_fetched: tagResult.count || 0,
        errors_count:  (tagSkip || tagBrk) ? 1 : 0,
        success:       tagResult.success && !tagSkip,
        status:        (tagSkip || tagBrk) ? 'error' : 'completed',
        count:         tagResult.count,
      });

      if (tagSkip || tagBrk) {
        await delay(INTER_ACCOUNT_DELAY_MS);
        continue;
      }

      await delay(INTER_ITEM_DELAY_MS);

      // ── Hashtag media ────────────────────────────────────────────────────
      const hashtags        = await getMonitoredHashtags(account.id);
      let totalHashtagMedia = 0;
      let hashAuthFailed    = false;
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
        run_id:           runId,
        duration_ms:      Date.now() - startTime,
        items_fetched:    totalHashtagMedia,
        errors_count:     hashAuthFailed ? 1 : 0,
        success:          !hashAuthFailed,
        status:           hashAuthFailed ? 'error' : 'completed',
        hashtags_checked: hashtagsToCheck.length,
        total_media:      totalHashtagMedia,
      });

      await delay(INTER_ACCOUNT_DELAY_MS);

    } catch (accountError) {
      console.error(`[Sync:ugc] Account ${account.id} failed:`, accountError.message);
      await logSyncAudit('ugc', account.id, {
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

  console.log(`[Sync:ugc] Run #${runId} complete`);
}

module.exports = { proactiveUgcSync };
