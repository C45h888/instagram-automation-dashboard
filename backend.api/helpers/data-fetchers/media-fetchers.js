// backend.api/helpers/data-fetchers/media-fetchers.js
// Domain: media — business post feed, per-post insights.
// Fetches from Instagram Graph API and upserts to Supabase instagram_media.
// No req/res dependencies — callable from routes and proactive-sync cron.
//
// All api_usage rows written with domain='media' for targeted debugging:
//   SELECT * FROM api_usage WHERE domain = 'media' AND success = false ORDER BY created_at DESC

const {
  axios,
  getSupabaseAdmin,
  resolveAccountCredentials,
  categorizeIgError,
  syncHashtagsFromCaptions,
  GRAPH_API_BASE,
  logWithDomain,
} = require('./base');

// ============================================
// MEDIA INSIGHTS
// ============================================

/**
 * Fetches media insights (reach, impressions) and upserts to instagram_media.
 * Also syncs hashtags from captions into ugc_monitored_hashtags.
 *
 * @param {string} businessAccountId - UUID
 * @param {string|number} [since] - ISO date string or unix timestamp
 * @param {string|number} [until] - ISO date string or unix timestamp
 * @returns {Promise<{success: boolean, mediaInsights: Array, count: number, error?: string}>}
 */
async function fetchAndStoreMediaInsights(businessAccountId, since, until) {
  const startTime = Date.now();

  try {
    const { igUserId, pageToken } = await resolveAccountCredentials(businessAccountId);

    const mediaUrl = `${GRAPH_API_BASE}/${igUserId}/media`;
    const mediaParams = {
      fields: 'id,media_type,timestamp,caption,media_url,thumbnail_url,permalink,like_count,comments_count',
      limit: 50,
      access_token: pageToken
    };
    if (since) mediaParams.since = typeof since === 'number' ? since : Math.floor(new Date(since).getTime() / 1000);
    if (until) mediaParams.until = typeof until === 'number' ? until : Math.floor(new Date(until).getTime() / 1000);

    const mediaRes = await axios.get(mediaUrl, { params: mediaParams });
    const mediaList = mediaRes.data.data || [];

    const INSIGHTS_BATCH_SIZE = 5;
    const INSIGHTS_BATCH_DELAY_MS = 500;

    const fetchInsightsForMedia = async (media) => {
      try {
        const insightsRes = await axios.get(`${GRAPH_API_BASE}/${media.id}/insights`, {
          params: {
            metric: 'reach,impressions,saved',
            access_token: pageToken
          }
        });
        return {
          media_id: media.id,
          media_type: media.media_type,
          timestamp: media.timestamp,
          caption: media.caption || null,
          media_url: media.media_url || null,
          thumbnail_url: media.thumbnail_url || null,
          permalink: media.permalink || null,
          like_count: media.like_count || 0,
          comments_count: media.comments_count || 0,
          insights: insightsRes.data.data || []
        };
      } catch (err) {
        console.warn(`[media] Failed to fetch insights for media ${media.id}:`, err.message);
        return {
          media_id: media.id,
          media_type: media.media_type,
          timestamp: media.timestamp,
          caption: media.caption || null,
          media_url: media.media_url || null,
          thumbnail_url: media.thumbnail_url || null,
          permalink: media.permalink || null,
          like_count: media.like_count || 0,
          comments_count: media.comments_count || 0,
          insights: [],
          error: err.message
        };
      }
    };

    const mediaInsights = [];
    for (let i = 0; i < mediaList.length; i += INSIGHTS_BATCH_SIZE) {
      const batch = mediaList.slice(i, i + INSIGHTS_BATCH_SIZE);
      const batchResults = await Promise.all(batch.map(fetchInsightsForMedia));
      mediaInsights.push(...batchResults);
      // Pause between batches to avoid rate-limit bursts (skip delay after last batch)
      if (i + INSIGHTS_BATCH_SIZE < mediaList.length) {
        await new Promise(resolve => setTimeout(resolve, INSIGHTS_BATCH_DELAY_MS));
      }
    }

    const latency = Date.now() - startTime;

    await logWithDomain('media', {
      endpoint: '/media-insights',
      method: 'GET',
      business_account_id: businessAccountId,
      user_id: igUserId,
      success: true,
      latency
    });

    // Supabase write-through: upsert instagram_media metrics + sync hashtags
    if (mediaInsights.length > 0) {
      try {
        const supabase = getSupabaseAdmin();
        if (supabase) {
          const mediaRecords = mediaInsights.map(m => ({
            instagram_media_id: m.media_id,
            business_account_id: businessAccountId,
            media_type: m.media_type || null,
            caption: m.caption || null,
            media_url: m.media_url || null,
            thumbnail_url: m.thumbnail_url || null,
            permalink: m.permalink || null,
            like_count: m.like_count || 0,
            comments_count: m.comments_count || 0,
            reach: m.insights.find(i => i.name === 'reach')?.values?.[0]?.value || 0,
            impressions: m.insights.find(i => i.name === 'impressions')?.values?.[0]?.value || 0,
            saves: m.insights.find(i => i.name === 'saved')?.values?.[0]?.value || 0,
            published_at: m.timestamp || null,
          }));
          const { error: mediaErr } = await supabase
            .from('instagram_media')
            .upsert(mediaRecords, { onConflict: 'instagram_media_id', ignoreDuplicates: false });
          if (mediaErr) console.warn('[media] instagram_media insights upsert failed:', mediaErr.message);

          const captions = mediaList.map(m => m.caption).filter(Boolean);
          await syncHashtagsFromCaptions(supabase, businessAccountId, captions);
        }
      } catch (wtErr) {
        console.warn('[media] Media insights write-through error:', wtErr.message);
      }
    }

    return { success: true, mediaInsights, count: mediaInsights.length };

  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error.response?.data?.error?.message || error.message;

    await logWithDomain('media', {
      endpoint: '/media-insights',
      method: 'GET',
      business_account_id: businessAccountId,
      success: false,
      error: errorMessage,
      latency
    });

    const { retryable, error_category, retry_after_seconds } = categorizeIgError(error);
    return {
      success: false, mediaInsights: [], count: 0, error: errorMessage,
      code: error.response?.data?.error?.code,
      retryable, error_category, retry_after_seconds
    };
  }
}

// ============================================
// BUSINESS POSTS
// ============================================

/**
 * Fetches the business account's own media feed and upserts full post data to instagram_media.
 * This is the proactive sync that populates the table read by GET /media/:accountId.
 *
 * @param {string} businessAccountId - UUID
 * @param {number} [limit=50] - Max posts to fetch
 * @returns {Promise<{success: boolean, count: number, error?: string}>}
 */
async function fetchAndStoreBusinessPosts(businessAccountId, limit = 50) {
  const startTime = Date.now();
  const fetchLimit = Math.min(parseInt(limit) || 50, 100);

  try {
    const { igUserId, pageToken } = await resolveAccountCredentials(businessAccountId);

    const mediaRes = await axios.get(`${GRAPH_API_BASE}/${igUserId}/media`, {
      params: {
        fields: 'id,media_type,caption,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count',
        limit: fetchLimit,
        access_token: pageToken
      },
      timeout: 15000
    });

    const posts = mediaRes.data.data || [];
    const latency = Date.now() - startTime;

    await logWithDomain('media', {
      endpoint: '/sync/posts',
      method: 'GET',
      business_account_id: businessAccountId,
      user_id: igUserId,
      success: true,
      latency
    });

    if (posts.length > 0) {
      try {
        const supabase = getSupabaseAdmin();
        if (supabase) {
          const mediaRecords = posts.map(p => ({
            instagram_media_id: p.id,
            business_account_id: businessAccountId,
            media_type: p.media_type || null,
            caption: p.caption || null,
            media_url: p.media_url || null,
            thumbnail_url: p.thumbnail_url || null,
            permalink: p.permalink || null,
            like_count: p.like_count || 0,
            comments_count: p.comments_count || 0,
            published_at: p.timestamp || null,
          }));
          const { error: upsertErr } = await supabase
            .from('instagram_media')
            .upsert(mediaRecords, { onConflict: 'instagram_media_id', ignoreDuplicates: false });
          if (upsertErr) console.warn('[media] Business posts upsert failed:', upsertErr.message);

          // Auto-populate monitored hashtags from captions
          const captions = posts.map(p => p.caption).filter(Boolean);
          await syncHashtagsFromCaptions(supabase, businessAccountId, captions);
        }
      } catch (wtErr) {
        console.warn('[media] Business posts write-through error:', wtErr.message);
      }
    }

    return { success: true, count: posts.length };

  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error.response?.data?.error?.message || error.message;

    await logWithDomain('media', {
      endpoint: '/sync/posts',
      method: 'GET',
      business_account_id: businessAccountId,
      success: false,
      error: errorMessage,
      latency
    });

    const { retryable, error_category, retry_after_seconds } = categorizeIgError(error);
    return {
      success: false, count: 0, error: errorMessage,
      code: error.response?.data?.error?.code,
      retryable, error_category, retry_after_seconds
    };
  }
}

module.exports = {
  fetchAndStoreMediaInsights,
  fetchAndStoreBusinessPosts,
};
