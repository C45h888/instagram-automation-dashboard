// backend.api/helpers/data-fetchers/ugc-fetchers.js
// Domain: ugc — hashtag search, tagged media.
// Fetches from Instagram Graph API and upserts to Supabase ugc_content.
// No req/res dependencies — callable from routes and proactive-sync cron.
//
// All api_usage rows written with domain='ugc' for targeted debugging:
//   SELECT * FROM api_usage WHERE domain = 'ugc' AND success = false ORDER BY created_at DESC

const {
  axios,
  getSupabaseAdmin,
  resolveAccountCredentials,
  categorizeIgError,
  mapRawPostToUgcContent,
  GRAPH_API_BASE,
  logWithDomain,
} = require('./base');

// ============================================
// HASHTAG MEDIA (UGC)
// ============================================

/**
 * Searches hashtag media and upserts to ugc_content.
 * Extracted from: routes/agents/ugc.js POST /search-hashtag
 *
 * @param {string} businessAccountId - UUID
 * @param {string} hashtag - Hashtag string (with or without #)
 * @param {number} [limit=25] - Max media (capped at 50)
 * @returns {Promise<{success: boolean, media: Array, count: number, hashtagId?: string, error?: string}>}
 */
async function fetchAndStoreHashtagMedia(businessAccountId, hashtag, limit = 25) {
  const startTime = Date.now();
  const searchLimit = Math.min(parseInt(limit) || 25, 50);
  const cleanHashtag = String(hashtag).replace(/^#/, '');

  try {
    const { igUserId, pageToken } = await resolveAccountCredentials(businessAccountId);

    // Step 1: Search for hashtag ID
    const hashtagSearchRes = await axios.get(`${GRAPH_API_BASE}/ig_hashtag_search`, {
      params: {
        user_id: igUserId,
        q: cleanHashtag,
        access_token: pageToken
      }
    });

    const hashtagId = hashtagSearchRes.data?.data?.[0]?.id;
    if (!hashtagId) {
      return { success: false, media: [], count: 0, error: `Hashtag not found: #${cleanHashtag}` };
    }

    // Step 2: Get recent media for hashtag
    const mediaRes = await axios.get(`${GRAPH_API_BASE}/${hashtagId}/recent_media`, {
      params: {
        user_id: igUserId,
        fields: 'id,media_type,media_url,thumbnail_url,permalink,caption,timestamp,username,like_count,comments_count,owner{id}',
        limit: searchLimit,
        access_token: pageToken
      }
    });

    const latency = Date.now() - startTime;

    await logWithDomain('ugc', {
      endpoint: '/search-hashtag',
      method: 'POST',
      business_account_id: businessAccountId,
      user_id: igUserId,
      success: true,
      latency
    });

    // Flatten owner{id} → owner_id for agent compatibility
    const media = (mediaRes.data.data || []).map(item => ({
      ...item,
      owner_id: item.owner?.id || null,
    }));

    // Supabase write-through: raw UGC into unified ugc_content (agent enriches quality fields later)
    if (media.length > 0) {
      try {
        const supabase = getSupabaseAdmin();
        if (supabase) {
          const ugcRecords = media
            .filter(m => m.id)
            .map(m => mapRawPostToUgcContent(m, businessAccountId, 'hashtag', cleanHashtag));
          const { error: upsertErr } = await supabase
            .from('ugc_content')
            .upsert(ugcRecords, { onConflict: 'business_account_id,visitor_post_id', ignoreDuplicates: false });
          if (upsertErr) console.warn('[ugc] Hashtag upsert failed:', upsertErr.message);
        }
      } catch (wtErr) {
        console.warn('[ugc] Hashtag write-through error:', wtErr.message);
      }
    }

    return { success: true, media, count: media.length, hashtagId };

  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error.response?.data?.error?.message || error.message;

    await logWithDomain('ugc', {
      endpoint: '/search-hashtag',
      method: 'POST',
      business_account_id: businessAccountId,
      success: false,
      error: errorMessage,
      latency
    });

    const { retryable, error_category, retry_after_seconds } = categorizeIgError(error);
    return {
      success: false, media: [], count: 0, error: errorMessage,
      code: error.response?.data?.error?.code,
      retryable, error_category, retry_after_seconds
    };
  }
}

// ============================================
// TAGGED MEDIA (UGC)
// ============================================

/**
 * Fetches tagged posts and upserts to ugc_content.
 * Extracted from: routes/agents/ugc.js GET /tags
 *
 * @param {string} businessAccountId - UUID
 * @param {number} [limit=25] - Max tagged posts (capped at 50)
 * @returns {Promise<{success: boolean, taggedPosts: Array, count: number, error?: string}>}
 */
async function fetchAndStoreTaggedMedia(businessAccountId, limit = 25) {
  const startTime = Date.now();
  const fetchLimit = Math.min(parseInt(limit) || 25, 50);

  try {
    const { igUserId, pageToken } = await resolveAccountCredentials(businessAccountId);

    const tagsRes = await axios.get(`${GRAPH_API_BASE}/${igUserId}/tags`, {
      params: {
        fields: 'id,media_type,media_url,thumbnail_url,caption,permalink,timestamp,username,like_count,comments_count',
        limit: fetchLimit,
        access_token: pageToken
      }
    });

    const latency = Date.now() - startTime;

    await logWithDomain('ugc', {
      endpoint: '/tags',
      method: 'GET',
      business_account_id: businessAccountId,
      user_id: igUserId,
      success: true,
      latency
    });

    const taggedPosts = tagsRes.data.data || [];

    // Supabase write-through: raw tagged UGC into unified ugc_content (agent enriches quality fields later)
    if (taggedPosts.length > 0) {
      try {
        const supabase = getSupabaseAdmin();
        if (supabase) {
          const ugcRecords = taggedPosts
            .filter(p => p.id)
            .map(p => mapRawPostToUgcContent(p, businessAccountId, 'tagged', null));
          const { error: upsertErr } = await supabase
            .from('ugc_content')
            .upsert(ugcRecords, { onConflict: 'business_account_id,visitor_post_id', ignoreDuplicates: false });
          if (upsertErr) console.warn('[ugc] Tagged media upsert failed:', upsertErr.message);
        }
      } catch (wtErr) {
        console.warn('[ugc] Tagged media write-through error:', wtErr.message);
      }
    }

    return { success: true, taggedPosts, count: taggedPosts.length };

  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error.response?.data?.error?.message || error.message;

    await logWithDomain('ugc', {
      endpoint: '/tags',
      method: 'GET',
      business_account_id: businessAccountId,
      success: false,
      error: errorMessage,
      latency
    });

    const { retryable, error_category, retry_after_seconds } = categorizeIgError(error);
    return {
      success: false, taggedPosts: [], count: 0, error: errorMessage,
      code: error.response?.data?.error?.code,
      retryable, error_category, retry_after_seconds
    };
  }
}

module.exports = {
  fetchAndStoreHashtagMedia,
  fetchAndStoreTaggedMedia,
};
