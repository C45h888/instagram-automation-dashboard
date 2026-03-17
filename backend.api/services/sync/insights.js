// backend.api/services/sync/insights.js
// Proactive media insights sync: reach/impressions/saves for last 7 days.
// Runs daily at 02:00 UTC (cron: 0 2 * * *) via services/sync/index.js.
//
// Data flow:
//   node-cron → proactiveInsightsSync()
//     → fetchAndStoreMediaInsights() → instagram_media (reach, impressions, saved metrics)

const {
  delay,
  isAccountRateLimited,
  handleFetchError,
  getActiveAccounts,
  logSyncAudit,
} = require('./helpers');

const {
  fetchAndStoreMediaInsights,
} = require('../../helpers/data-fetchers/media-fetchers');

const INTER_ACCOUNT_DELAY_MS =
  parseInt(process.env.SYNC_INSIGHTS_DELAY_MS || '3000', 10);

/**
 * Proactive insights sync: media metrics for last 7 days.
 * For each active account: fetch and store media insights.
 */
async function proactiveInsightsSync() {
  const runId    = Date.now();
  const startTime = runId;
  console.log(`[Sync:insights] Starting run #${runId}`);

  // Lifecycle start marker
  await logSyncAudit('insights', null, { run_id: runId, status: 'started' });

  const accounts = await getActiveAccounts();
  if (accounts.length === 0) {
    console.log('[Sync:insights] No active accounts, skipping');
    return;
  }

  for (const account of accounts) {
    if (isAccountRateLimited(account.id)) {
      console.log(`[Sync:insights] Account ${account.id} rate-limited, skipping`);
      await logSyncAudit('insights', account.id, {
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
      const sevenDaysAgo = Math.floor((Date.now() - 7 * 24 * 3600000) / 1000);
      const now          = Math.floor(Date.now() / 1000);

      const result = await fetchAndStoreMediaInsights(account.id, sevenDaysAgo, now);
      const { skip, break: brk } = handleFetchError(result, account.id);

      await logSyncAudit('media_insights', account.id, {
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

      await delay(INTER_ACCOUNT_DELAY_MS);

    } catch (accountError) {
      console.error(`[Sync:insights] Account ${account.id} failed:`, accountError.message);
      await logSyncAudit('insights', account.id, {
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

  console.log(`[Sync:insights] Run #${runId} complete`);
}

module.exports = { proactiveInsightsSync };
