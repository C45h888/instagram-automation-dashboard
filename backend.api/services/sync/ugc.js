// backend.api/services/sync/ugc.js
// Proactive UGC discovery sync: tagged posts + hashtag media.
// Runs every 3 hours (cron: 0 */3 * * *) via services/sync/index.js.
//
// Data flow:
//   node-cron → proactiveUgcSync()
//     → fetchAndStoreTaggedMedia()              → ugc_content (source: 'tagged')
//     → fetchHashtagMedia() × hashtags parallel → storeUgcContentBatch() × 1

const {
  delay,
  generateRunId,
  writeSyncRunLog,
  runConcurrent,
  isAccountRateLimited,
  handleFetchError,
  getActiveAccounts,
  getMonitoredHashtags,
  logSyncAudit,
} = require('./helpers');

const {
  fetchHashtagMedia,
  fetchAndStoreTaggedMedia,
} = require('../../helpers/data-fetchers/ugc-fetchers');

const {
  storeUgcContentBatch,
} = require('../../helpers/data-fetchers/base');

const UGC_MAX_HASHTAGS       = 5;
const INTER_ACCOUNT_DELAY_MS =
  parseInt(process.env.SYNC_UGC_DELAY_MS || '3000', 10);

/**
 * Proactive UGC discovery sync: tagged posts + hashtag media.
 * For each active account:
 *   1. Fetch tagged posts
 *   2. Fetch media for each monitored hashtag
 */
async function proactiveUgcSync() {
  const runId    = generateRunId();
  const startTime = Date.now();
  const startMem = process.memoryUsage().heapUsed;
  const startCpu = process.cpuUsage();
  console.log(`[Sync:ugc] Starting run ${runId}`);

  const accounts = await getActiveAccounts();

  await writeSyncRunLog({
    domain: 'ugc', run_id: runId, status: 'run_started',
    total_accounts: accounts.length,
    cron_expr: process.env.PROACTIVE_UGC_CRON || '0 */3 * * *',
    node_env: process.env.NODE_ENV,
    started_at: new Date().toISOString(),
  });

  if (accounts.length === 0) {
    console.log('[Sync:ugc] No active accounts, skipping');
    return;
  }

  let successCount = 0;
  let errorCount   = 0;
  let skippedCount = 0;
  let itemsFetched = 0;
  let lastErrorMessage    = null;
  let lastErrorAccountId  = null;

  for (const account of accounts) {
    // Rate-limit circuit breaker
    if (isAccountRateLimited(account.id)) {
      console.log(`[Sync:ugc] Account ${account.id} rate-limited, skipping`);
      skippedCount++;
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
        errorCount++;
        lastErrorMessage   = tagResult.error || 'tag_fetch_failed';
        lastErrorAccountId = account.id;
        await delay(INTER_ACCOUNT_DELAY_MS);
        continue;
      }

      itemsFetched += tagResult.count || 0;

      // ── Hashtag media ────────────────────────────────────────────────────
      const hashtags        = await getMonitoredHashtags(account.id);
      let totalHashtagMedia = 0;
      let hashAuthFailed    = false;
      const hashtagsToCheck = hashtags.slice(0, UGC_MAX_HASHTAGS);

      // PARALLEL FETCH — up to 3 hashtags in parallel per batch (each makes 2 IG API calls)
      const hashFetchResults = await runConcurrent(
        hashtagsToCheck,
        (hashtag) => fetchHashtagMedia(account.id, hashtag, 25),
        3
      );

      // Post-batch error accounting
      for (const hashResult of hashFetchResults) {
        if (hashResult.success) totalHashtagMedia += hashResult.count;
        const { skip, break: brk } = handleFetchError(hashResult, account.id);
        if (skip) { hashAuthFailed = true; break; }
        if (brk) break;
      }

      // BATCH WRITE — merge all hashtag results into one upsert
      if (!hashAuthFailed) {
        const allRecords = hashFetchResults
          .filter(r => r.success)
          .flatMap(r => r.records);
        if (allRecords.length > 0) {
          await storeUgcContentBatch(allRecords);
        }
      }

      itemsFetched += totalHashtagMedia;
      if (hashAuthFailed) { errorCount++; } else { successCount++; }

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
      errorCount++;
      lastErrorMessage   = accountError.message;
      lastErrorAccountId = account.id;
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

  await writeSyncRunLog({
    domain: 'ugc', run_id: runId, status: 'run_completed',
    total_accounts: accounts.length,
    success_count: successCount, error_count: errorCount, skipped_count: skippedCount,
    items_fetched: itemsFetched,
    duration_ms: Date.now() - startTime,
    memory_delta_kb: Math.round((process.memoryUsage().heapUsed - startMem) / 1024),
    cpu_delta_ms: Math.round(process.cpuUsage(startCpu).user / 1000),
    error_message: lastErrorMessage,
    last_error_account: lastErrorAccountId,
    completed_at: new Date().toISOString(),
  });

  console.log(`[Sync:ugc] Run ${runId} complete — ok:${successCount} err:${errorCount} skip:${skippedCount}`);
}

module.exports = { proactiveUgcSync };
