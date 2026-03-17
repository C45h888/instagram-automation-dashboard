// backend.api/services/sync/token-health.js
// Token health subsystem — fully independent of the circuit breaker / data-fetchers.
// Runs daily at 03:00 UTC (cron: 0 3 * * *) via services/sync/index.js.
//
// runTokenHealthCheck():
//   - Validates all active page tokens via Meta's /debug_token endpoint
//   - Attempts silent PAT recovery via stored UAT if token is invalid
//   - Marks invalid credentials inactive + inserts auth_failure system_alert
//
// runUATRefreshCheck():
//   - Finds UATs expiring within 14 days, attempts fb_exchange_token renewal
//   - Checks data_access_expires_at (separate Meta-controlled expiry, can't be refreshed)
//   - Inserts system_alerts for renewals and warnings
//
// NO import from ./helpers — this file is intentionally isolated.

const { getSupabaseAdmin } = require('../../config/supabase');
const {
  retrievePageToken,
  detectTokenType,
  retrieveUserToken,
  exchangeForPageToken,
  storePageToken,
  fetchDynamicScope,
  refreshUserToken,            // promoted from lazy require inside runUATRefreshCheck
} = require('../instagram-tokens');
const { clearCredentialCache } = require('../../helpers/agent-helpers');

// Private delay — not importing from ./helpers to keep this file fully independent
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Token Health Check ───────────────────────────────────────────────────────

/**
 * Validates all active page tokens via Meta's /debug_token endpoint.
 * Marks invalid tokens inactive and creates an auth_failure system_alert
 * visible in the user's NotificationDropdown.
 */
async function runTokenHealthCheck() {
  console.log('[TokenHealthCheck] Starting daily token validation...');
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.warn('[TokenHealthCheck] Supabase not available, skipping');
    return;
  }

  try {
    const { data: credentials, error } = await supabase
      .from('instagram_credentials')
      .select('id, user_id, business_account_id, debug_token_checked_at')
      .eq('token_type', 'page')
      .eq('is_active', true);

    if (error) throw error;
    if (!credentials?.length) {
      console.log('[TokenHealthCheck] No active page credentials found, nothing to check');
      return;
    }

    console.log(`[TokenHealthCheck] Checking ${credentials.length} active token(s)...`);
    let valid = 0, invalid = 0, skipped = 0;

    for (const cred of credentials) {
      // Skip if checked within the last 24 hours
      if (cred.debug_token_checked_at) {
        const hoursSince = (Date.now() - new Date(cred.debug_token_checked_at).getTime()) / 3_600_000;
        if (hoursSince < 24) {
          skipped++;
          continue;
        }
      }

      // Use service layer to retrieve decrypted token
      let token;
      try {
        token = await retrievePageToken(cred.user_id, cred.business_account_id);
      } catch (retrieveErr) {
        console.warn(`[TokenHealthCheck] Could not retrieve token for cred ${cred.id}:`, retrieveErr.message);
        skipped++;
        continue;
      }

      // Call /debug_token via detectTokenType
      try {
        const tokenInfo = await detectTokenType(token);

        if (!tokenInfo || !tokenInfo.isValid) {
          // ── Attempt silent PAT recovery via stored UAT ──
          let recovered = false;

          try {
            const uatData = await retrieveUserToken(cred.user_id, cred.business_account_id);
            const exchangeResult = await exchangeForPageToken(uatData.token);

            if (exchangeResult.success && !exchangeResult.requiresSelection) {
              const newScope = await fetchDynamicScope(exchangeResult.pageAccessToken, supabase);
              await storePageToken({
                userId:               cred.user_id,
                igBusinessAccountId:  exchangeResult.igBusinessAccountId,
                pageAccessToken:      exchangeResult.pageAccessToken,
                pageId:               exchangeResult.pageId,
                pageName:             exchangeResult.pageName,
                scope:                newScope,
              });
              clearCredentialCache(cred.business_account_id);

              await supabase.from('system_alerts').insert({
                alert_type:          'pat_auto_recovered',
                business_account_id: cred.business_account_id,
                message:             'Your Instagram access token was automatically recovered using stored credentials.',
                details:             { user_id: cred.user_id, old_credential_id: cred.id, source: 'token_health_check' },
                resolved:            true,
              });

              console.log(`[TokenHealthCheck] PAT auto-recovered for cred ${cred.id} via stored UAT`);
              recovered = true;
            }
          } catch (recoveryErr) {
            console.warn(`[TokenHealthCheck] UAT recovery failed for cred ${cred.id}:`, recoveryErr.message);
          }

          if (!recovered) {
            // No UAT or exchange failed — mark PAT inactive and alert user
            await supabase
              .from('instagram_credentials')
              .update({ is_active: false, updated_at: new Date().toISOString() })
              .eq('id', cred.id);

            await supabase.from('system_alerts').insert({
              alert_type:          'auth_failure',
              business_account_id: cred.business_account_id,
              message:             'Instagram access token is no longer valid. Please reconnect your account.',
              details:             { user_id: cred.user_id, credential_id: cred.id, source: 'token_health_check' },
              resolved:            false,
            });

            console.warn(`[TokenHealthCheck] Token invalid for cred ${cred.id} (user ${cred.user_id}), marked inactive`);
            invalid++;
          } else {
            valid++;
          }
        } else {
          // Token valid — stamp the check time so we skip for next 24h
          await supabase
            .from('instagram_credentials')
            .update({ debug_token_checked_at: new Date().toISOString() })
            .eq('id', cred.id);
          valid++;
        }
      } catch (apiErr) {
        console.warn(`[TokenHealthCheck] /debug_token call failed for cred ${cred.id}:`, apiErr.message);
        skipped++;
      }

      // 200ms between calls to avoid hammering the Meta API
      await delay(200);
    }

    console.log(`[TokenHealthCheck] Complete — valid: ${valid}, invalid: ${invalid}, skipped: ${skipped}`);
  } catch (err) {
    console.error('[TokenHealthCheck] Fatal error:', err.message);
  }
}

// ── UAT Refresh Check ────────────────────────────────────────────────────────

/**
 * Proactive UAT refresh: finds UATs expiring within 14 days and attempts
 * fb_exchange_token renewal. On failure, creates a system_alert so the
 * user knows they need to reconnect.
 * Also checks data_access_expires_at (separate Meta-controlled expiry).
 */
async function runUATRefreshCheck() {
  console.log('[UATRefresh] Running proactive UAT refresh check...');
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.warn('[UATRefresh] Supabase not available, skipping');
    return;
  }

  // Find UATs expiring within 14 days
  const fourteenDaysFromNow = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const { data: expiringUATs, error } = await supabase
    .from('instagram_credentials')
    .select('id, user_id, business_account_id, expires_at')
    .eq('token_type', 'user')
    .eq('is_active', true)
    .not('expires_at', 'is', null)
    .lt('expires_at', fourteenDaysFromNow);

  if (error) {
    console.error('[UATRefresh] Query failed:', error.message);
    return;
  }

  if (!expiringUATs?.length) {
    console.log('[UATRefresh] No UATs need refresh');
    return;
  }

  console.log(`[UATRefresh] Found ${expiringUATs.length} UAT(s) expiring within 14 days`);

  for (const uat of expiringUATs) {
    const daysLeft = Math.ceil((new Date(uat.expires_at) - Date.now()) / (24 * 60 * 60 * 1000));
    console.log(`[UATRefresh] UAT ${uat.id}: ${daysLeft} days remaining`);

    try {
      const result = await refreshUserToken(uat.user_id, uat.business_account_id);
      console.log(`[UATRefresh] UAT refreshed, new expiry: ${result.expiresAt}`);

      await supabase.from('system_alerts').insert({
        alert_type:          'uat_auto_refreshed',
        business_account_id: uat.business_account_id,
        message:             `Your access token was automatically refreshed. New expiry: ${result.expiresAt}`,
        details: {
          old_expires_at:          uat.expires_at,
          new_expires_at:          result.expiresAt,
          days_remaining_at_refresh: daysLeft,
        },
        resolved: true,
      });
    } catch (refreshErr) {
      console.error(`[UATRefresh] UAT refresh failed: ${refreshErr.message}`);

      await supabase.from('system_alerts').insert({
        alert_type:          'uat_expiry_warning',
        business_account_id: uat.business_account_id,
        message:             `Your access token expires in ${daysLeft} days and auto-refresh failed. Please reconnect your Instagram account.`,
        details: {
          expires_at:     uat.expires_at,
          error:          refreshErr.message,
          days_remaining: daysLeft,
        },
        resolved: false,
      });
    }

    await delay(1000); // Rate-limit between refresh attempts
  }

  // ── data_access_expires_at check ─────────────────────────────────────────
  // data_access_expires_at is a separate Meta-controlled expiry that caps
  // access to user messages and comments. Cannot be extended via
  // fb_exchange_token — only a fresh user OAuth consent resets it.
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: dataAccessExpiring } = await supabase
    .from('instagram_credentials')
    .select('id, user_id, business_account_id, data_access_expires_at')
    .eq('token_type', 'user')
    .eq('is_active', true)
    .not('data_access_expires_at', 'is', null)
    .lt('data_access_expires_at', thirtyDaysFromNow);

  for (const uat of (dataAccessExpiring || [])) {
    const daysLeft = Math.ceil((new Date(uat.data_access_expires_at) - Date.now()) / (24 * 60 * 60 * 1000));

    // Deduplicate: skip if an unresolved warning already exists for this account
    const { data: existing } = await supabase
      .from('system_alerts')
      .select('id')
      .eq('business_account_id', uat.business_account_id)
      .eq('alert_type', 'data_access_expiry_warning')
      .eq('resolved', false)
      .maybeSingle();

    if (!existing) {
      await supabase.from('system_alerts').insert({
        alert_type:          'data_access_expiry_warning',
        business_account_id: uat.business_account_id,
        message:             `Instagram data access expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Reconnect your account to renew access to messages and comments.`,
        details: {
          data_access_expires_at: uat.data_access_expires_at,
          days_remaining:         daysLeft,
          note:                   'Cannot be refreshed via fb_exchange_token — requires fresh OAuth consent',
        },
        resolved: false,
      });
      console.log(`[UATRefresh] data_access_expiry_warning created for account ${uat.business_account_id} (${daysLeft} days left)`);
    }
  }

  console.log('[UATRefresh] Proactive UAT refresh check complete');
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = { runTokenHealthCheck, runUATRefreshCheck };
