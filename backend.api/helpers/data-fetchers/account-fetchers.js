// backend.api/helpers/data-fetchers/account-fetchers.js
// Domain: account — account-level insights.
// Fetches from Instagram Graph API via the instagram-tokens service.
// No req/res dependencies — callable from routes and proactive-sync cron.
//
// All api_usage rows written with domain='account' for targeted debugging:
//   SELECT * FROM api_usage WHERE domain = 'account' AND success = false ORDER BY created_at DESC

const {
  getSupabaseAdmin,
  resolveAccountCredentials,
  categorizeIgError,
  logWithDomain,
} = require('./base');
const { getAccountInsights } = require('../../services/instagram-tokens');

// ============================================
// ACCOUNT INSIGHTS
// ============================================

/**
 * Fetches account-level insights.
 * Thin wrapper around getAccountInsights() from instagram-tokens.js.
 *
 * @param {string} businessAccountId - UUID
 * @param {Object} [options] - {since, until, period}
 * @returns {Promise<{success: boolean, data: Object, error?: string}>}
 */
async function fetchAndStoreAccountInsights(businessAccountId, options = {}) {
  const startTime = Date.now();

  try {
    // DB-aware: check if account has a website URL configured before requesting website_clicks.
    // website_clicks is a v2 total_value metric that Meta only returns for accounts with websites.
    const supabase = getSupabaseAdmin();
    const { data: accountRow } = await supabase
      .from('instagram_business_accounts')
      .select('website')
      .eq('id', businessAccountId)
      .single();

    const hasWebsite = !!accountRow?.website;

    const { igUserId, pageToken } = await resolveAccountCredentials(businessAccountId);

    const accountInsights = await getAccountInsights(igUserId, pageToken, {
      ...options,
      hasWebsite
    });

    const latency = Date.now() - startTime;

    await logWithDomain('account', {
      endpoint: '/account-insights',
      method: 'GET',
      business_account_id: businessAccountId,
      user_id: igUserId,
      success: true,
      latency
    });

    return { success: true, data: accountInsights };

  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error.response?.data?.error?.message || error.message;

    await logWithDomain('account', {
      endpoint: '/account-insights',
      method: 'GET',
      business_account_id: businessAccountId,
      success: false,
      error: errorMessage,
      latency
    });

    // Write insights failure to audit_log for observability — domain embedded in details JSONB
    const supabase = getSupabaseAdmin();
    await supabase.from('audit_log').insert({
      event_type: 'api_error',
      action: 'fetch_account_insights_failed',
      success: false,
      error_message: errorMessage,
      details: {
        domain: 'account',
        code: error.response?.data?.error?.code,
        business_account_id: businessAccountId
      }
    }).catch(() => {});

    const { retryable, error_category, retry_after_seconds } = categorizeIgError(error);
    return {
      success: false, data: {}, error: errorMessage,
      code: error.response?.data?.error?.code,
      retryable, error_category, retry_after_seconds
    };
  }
}

module.exports = {
  fetchAndStoreAccountInsights,
};
