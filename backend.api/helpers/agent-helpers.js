// backend.api/helpers/agent-helpers.js
// Shared helper functions used across agent proxy route modules.
// Extracted from routes/agent-proxy.js to keep route files lean.

const { getSupabaseAdmin } = require('../config/supabase');
const { retrievePageToken } = require('../services/instagram-tokens');

const GRAPH_API_BASE = 'https://graph.facebook.com/v23.0';

// ============================================
// HELPER: CATEGORIZE INSTAGRAM API ERROR
// ============================================

/**
 * Maps an Instagram Graph API error to structured retry metadata.
 * Called by every catch block that handles a Graph API axios failure.
 *
 * IG rate limits come as HTTP 400 with specific error codes (4, 17, 32, 613).
 * They do NOT reliably use HTTP 429, so we must inspect the IG error code directly.
 *
 * @param {Error} error - axios error from a Graph API call
 * @returns {{ retryable: boolean, error_category: string, retry_after_seconds: number|null }}
 */
function categorizeIgError(error) {
  const status = error.response?.status;
  const igCode = error.response?.data?.error?.code;
  const retryAfterHeader = error.response?.headers?.['retry-after'];

  // Auth failures — token expired/invalid, requires user re-auth, must not retry
  if ([190, 102, 104].includes(igCode)) {
    return { retryable: false, error_category: 'auth_failure', retry_after_seconds: null };
  }

  // Permanent errors — bad params, permission denied, action blocked
  // Checked BEFORE rate-limit block because they're also HTTP 400
  if (status === 400 && igCode && ![4, 17, 32, 613].includes(igCode)) {
    return { retryable: false, error_category: 'permanent', retry_after_seconds: null };
  }

  // Rate limits — IG sends these as HTTP 400, not 429, with specific codes
  if ([4, 17, 613].includes(igCode)) {
    const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 3600;
    return { retryable: true, error_category: 'rate_limit', retry_after_seconds: retryAfter };
  }
  if (igCode === 32) {
    // Page-level throttling — shorter cooldown than app-level
    return { retryable: true, error_category: 'rate_limit', retry_after_seconds: 900 };
  }
  // Some IG endpoints do return HTTP 429 with Retry-After
  if (status === 429) {
    const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 3600;
    return { retryable: true, error_category: 'rate_limit', retry_after_seconds: retryAfter };
  }

  // Transient — IG server errors
  if (status >= 500) {
    return { retryable: true, error_category: 'transient', retry_after_seconds: 30 };
  }

  // Network timeout — axios ETIMEDOUT / ECONNABORTED (no response object)
  if (!status && (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED')) {
    return { retryable: true, error_category: 'transient', retry_after_seconds: 30 };
  }

  // Unknown — default safe to retry
  return { retryable: true, error_category: 'unknown', retry_after_seconds: 60 };
}

// ============================================
// CREDENTIAL CACHE
// ============================================
// Prevents redundant DB round trips (2-3 hits per call) across tight-loop callers
// like proactive-sync, which calls resolveAccountCredentials per-account per-fetcher.
// TTL is intentionally short (5 min) relative to 60-day token lifetime.
// Busted explicitly on token write events (exchange-token, refresh-token routes).

const _credentialCache = new Map();
const CREDENTIAL_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Removes a cached credential entry for a given business account.
 * Call this whenever a token is stored or refreshed in the DB.
 * @param {string} businessAccountId - UUID from instagram_business_accounts
 */
function clearCredentialCache(businessAccountId) {
  _credentialCache.delete(businessAccountId);
}

// ============================================
// HELPER: ENSURE MEDIA RECORD
// ============================================

/**
 * Ensures an instagram_media record exists for the given Instagram media ID.
 * Returns the Supabase UUID for use as FK in instagram_comments.media_id.
 * Creates a minimal stub if the record doesn't exist yet.
 */
async function ensureMediaRecord(supabase, instagramMediaId, businessAccountId) {
  const { data: existing } = await supabase
    .from('instagram_media')
    .select('id')
    .eq('instagram_media_id', instagramMediaId)
    .limit(1)
    .single();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from('instagram_media')
    .upsert({
      instagram_media_id: instagramMediaId,
      business_account_id: businessAccountId,
    }, { onConflict: 'instagram_media_id' })
    .select('id')
    .single();

  if (error) {
    console.warn(`⚠️ ensureMediaRecord failed for ${instagramMediaId}:`, error.message);
    return null;
  }
  return created.id;
}

// ============================================
// HELPER: SYNC HASHTAGS FROM CAPTIONS
// ============================================

/**
 * Extracts hashtags from brand post captions and upserts into ugc_monitored_hashtags.
 * Auto-populates the table the agent reads at the start of every UGC discovery cycle.
 */
async function syncHashtagsFromCaptions(supabase, businessAccountId, captions) {
  const tagSet = new Set();
  const hashtagRegex = /#(\w+)/g;
  for (const caption of captions) {
    if (!caption) continue;
    let match;
    while ((match = hashtagRegex.exec(caption)) !== null) {
      tagSet.add(match[1].toLowerCase());
    }
  }
  if (tagSet.size === 0) return;
  const records = [...tagSet].map(tag => ({
    business_account_id: businessAccountId,
    hashtag: tag,
    is_active: true,
  }));
  const { error } = await supabase
    .from('ugc_monitored_hashtags')
    .upsert(records, { onConflict: 'business_account_id,hashtag', ignoreDuplicates: true });
  if (error) console.warn('⚠️ Hashtag sync failed:', error.message);
}

// ============================================
// HELPER: RESOLVE ACCOUNT CREDENTIALS
// ============================================

/**
 * Resolves business_account_id UUID to Instagram credentials.
 * @param {string} businessAccountId - UUID from instagram_business_accounts table
 * @returns {Promise<{igUserId: string, pageToken: string, userId: string}>}
 * @throws {Error} If account not found or token retrieval fails
 */
async function resolveAccountCredentials(businessAccountId) {
  const cached = _credentialCache.get(businessAccountId);
  if (cached && (Date.now() - cached.ts) < CREDENTIAL_TTL_MS) {
    return cached.value;
  }

  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      throw new Error('Database not available');
    }

    const { data: account, error } = await supabase
      .from('instagram_business_accounts')
      .select('instagram_business_id, user_id, is_connected')
      .eq('id', businessAccountId)
      .single();

    if (error || !account) {
      throw new Error(`Business account not found: ${businessAccountId}`);
    }

    if (!account.is_connected) {
      throw new Error('Business account is disconnected');
    }

    const igUserId = account.instagram_business_id;
    const userId = account.user_id;

    const pageToken = await retrievePageToken(userId, businessAccountId);

    if (!pageToken) {
      throw new Error('Failed to retrieve access token');
    }

    const result = { igUserId, pageToken, userId };
    _credentialCache.set(businessAccountId, { value: result, ts: Date.now() });
    return result;
  } catch (error) {
    console.error('❌ Credential resolution failed:', error.message);
    throw error;
  }
}

// ============================================
// HELPER: HANDLE INSIGHTS REQUEST
// ============================================
// Shared by /insights, /account-insights, and /media-insights.
// metricTypeOverride: if provided, ignores the metric_type query param.
// Delegates to data-fetchers for Graph API + Supabase logic.

async function handleInsightsRequest(req, res, _startTime, metricTypeOverride) {
  const { business_account_id, since, until, metric_type } = req.query;

  // Lazy-require to avoid circular dependency (data-fetchers imports from this file)
  const {
    fetchAndStoreMediaInsights,
    fetchAndStoreAccountInsights,
  } = require('./data-fetchers');

  try {
    if (!business_account_id) {
      return res.status(400).json({
        error: 'Missing required query parameter: business_account_id'
      });
    }

    const type = metricTypeOverride || metric_type || 'account';

    let insightsData = {};

    if (type === 'account') {
      const result = await fetchAndStoreAccountInsights(business_account_id, { since, until });
      if (!result.success) {
        throw new Error(result.error);
      }
      insightsData = result.data;

    } else if (type === 'media') {
      const result = await fetchAndStoreMediaInsights(business_account_id, since, until);
      if (!result.success) {
        throw new Error(result.error);
      }
      insightsData = { media_insights: result.mediaInsights };

    } else {
      return res.status(400).json({
        error: 'Invalid metric_type. Must be "account" or "media"'
      });
    }

    res.json({ success: true, data: insightsData });

  } catch (error) {
    const errorMessage = error.response?.data?.error?.message || error.message;

    console.error('❌ Insights fetch failed:', errorMessage);
    const { retryable, error_category, retry_after_seconds } = categorizeIgError(error);
    res.status(error.response?.status || 500).json({
      error: errorMessage,
      code: error.response?.data?.error?.code,
      retryable,
      error_category,
      retry_after_seconds
    });
  }
}

module.exports = {
  ensureMediaRecord,
  syncHashtagsFromCaptions,
  resolveAccountCredentials,
  clearCredentialCache,
  categorizeIgError,
  handleInsightsRequest,
  GRAPH_API_BASE,
};
