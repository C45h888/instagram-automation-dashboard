// backend/routes/agent-proxy.js - Agent Proxy Layer (Path C)
// Provides 5 REST endpoints for the Python/LangChain agent to execute IG API calls
// Agent never holds tokens - this backend acts as secure proxy

const express = require('express');
const router = express.Router();
const axios = require('axios');
const { validateAgentApiKey } = require('../middleware/agent-auth');
const { getSupabaseAdmin, logApiRequest, logAudit } = require('../config/supabase');
const { retrievePageToken, getAccountInsights } = require('../services/instagram-tokens');

// Graph API base URL (matches instagram-tokens.js:10)
const GRAPH_API_BASE = 'https://graph.facebook.com/v23.0';

// Apply authentication middleware to all agent proxy endpoints
router.use(validateAgentApiKey);

// ============================================
// SHARED HELPER: RESOLVE ACCOUNT CREDENTIALS
// ============================================

/**
 * Resolves business_account_id UUID to Instagram credentials
 * @param {string} businessAccountId - UUID from instagram_business_accounts table
 * @returns {Promise<{igUserId: string, pageToken: string, userId: string}>}
 * @throws {Error} If account not found or token retrieval fails
 */
async function resolveAccountCredentials(businessAccountId) {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      throw new Error('Database not available');
    }

    // Query instagram_business_accounts table for account details
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

    // Retrieve and decrypt page token (handles token refresh internally)
    const pageToken = await retrievePageToken(userId, businessAccountId);

    if (!pageToken) {
      throw new Error('Failed to retrieve access token');
    }

    return { igUserId, pageToken, userId };
  } catch (error) {
    console.error('❌ Credential resolution failed:', error.message);
    throw error;
  }
}

// ============================================
// ENDPOINT 1: POST /search-hashtag (UGC Discovery)
// ============================================

/**
 * Searches for recent media posts by hashtag
 * Used by: UGC discovery scheduler (scheduler/ugc_discovery.py)
 */
router.post('/search-hashtag', async (req, res) => {
  const startTime = Date.now();
  const { business_account_id, hashtag, limit } = req.body;

  try {
    // Validation
    if (!business_account_id || !hashtag) {
      return res.status(400).json({
        error: 'Missing required fields: business_account_id, hashtag'
      });
    }

    const searchLimit = Math.min(limit || 25, 50); // Max 50
    const cleanHashtag = hashtag.replace(/^#/, ''); // Strip leading # if present

    // Resolve credentials
    const { igUserId, pageToken } = await resolveAccountCredentials(business_account_id);

    // Step 1: Search for hashtag ID
    const hashtagSearchUrl = `${GRAPH_API_BASE}/ig_hashtag_search`;
    const hashtagSearchRes = await axios.get(hashtagSearchUrl, {
      params: {
        user_id: igUserId,
        q: cleanHashtag,
        access_token: pageToken
      }
    });

    const hashtagId = hashtagSearchRes.data?.data?.[0]?.id;
    if (!hashtagId) {
      return res.status(404).json({
        error: `Hashtag not found: #${cleanHashtag}`
      });
    }

    // Step 2: Get recent media for hashtag
    const mediaUrl = `${GRAPH_API_BASE}/${hashtagId}/recent_media`;
    const mediaRes = await axios.get(mediaUrl, {
      params: {
        user_id: igUserId,
        fields: 'id,media_type,media_url,permalink,caption,timestamp,like_count,comments_count',
        limit: searchLimit,
        access_token: pageToken
      }
    });

    const latency = Date.now() - startTime;

    // Log API request
    await logApiRequest({
      endpoint: '/search-hashtag',
      method: 'POST',
      business_account_id,
      user_id: igUserId,
      success: true,
      latency
    });

    // Return both formats for compatibility
    res.json({
      recent_media: mediaRes.data.data || [],
      data: mediaRes.data.data || []
    });

  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error.response?.data?.error?.message || error.message;

    await logApiRequest({
      endpoint: '/search-hashtag',
      method: 'POST',
      business_account_id,
      success: false,
      error: errorMessage,
      latency
    });

    console.error('❌ Hashtag search failed:', errorMessage);
    res.status(error.response?.status || 500).json({
      error: errorMessage,
      code: error.response?.data?.error?.code
    });
  }
});

// ============================================
// ENDPOINT 2: GET /tags (UGC Discovery)
// ============================================

/**
 * Gets posts where the business account is tagged
 * Used by: UGC discovery scheduler (scheduler/ugc_discovery.py)
 */
router.get('/tags', async (req, res) => {
  const startTime = Date.now();
  const { business_account_id, limit } = req.query;

  try {
    // Validation
    if (!business_account_id) {
      return res.status(400).json({
        error: 'Missing required query parameter: business_account_id'
      });
    }

    const fetchLimit = Math.min(limit || 25, 50); // Max 50

    // Resolve credentials
    const { igUserId, pageToken } = await resolveAccountCredentials(business_account_id);

    // Get tagged posts
    const tagsUrl = `${GRAPH_API_BASE}/${igUserId}/tags`;
    const tagsRes = await axios.get(tagsUrl, {
      params: {
        fields: 'id,media_type,media_url,thumbnail_url,caption,permalink,timestamp,username,like_count,comments_count',
        limit: fetchLimit,
        access_token: pageToken
      }
    });

    const latency = Date.now() - startTime;

    // Log API request
    await logApiRequest({
      endpoint: '/tags',
      method: 'GET',
      business_account_id,
      user_id: igUserId,
      success: true,
      latency
    });

    // Return both formats for compatibility
    res.json({
      tagged_posts: tagsRes.data.data || [],
      data: tagsRes.data.data || []
    });

  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error.response?.data?.error?.message || error.message;

    await logApiRequest({
      endpoint: '/tags',
      method: 'GET',
      business_account_id,
      success: false,
      error: errorMessage,
      latency
    });

    console.error('❌ Tagged posts fetch failed:', errorMessage);
    res.status(error.response?.status || 500).json({
      error: errorMessage,
      code: error.response?.data?.error?.code
    });
  }
});

// ============================================
// ENDPOINT 3: POST /send-dm (UGC Permission Requests)
// ============================================

/**
 * Sends a direct message to a user
 * Used by: UGC discovery scheduler (scheduler/ugc_discovery.py)
 * Rate limited: Soft daily limit to protect account
 */
router.post('/send-dm', async (req, res) => {
  const startTime = Date.now();
  const { business_account_id, recipient_id, message_text } = req.body;

  try {
    // Validation
    if (!business_account_id || !recipient_id || !message_text) {
      return res.status(400).json({
        error: 'Missing required fields: business_account_id, recipient_id, message_text'
      });
    }

    // Validate recipient_id is numeric IGSID
    if (!/^\d+$/.test(recipient_id)) {
      return res.status(400).json({
        error: 'recipient_id must be a numeric Instagram Scoped ID (IGSID), not a username'
      });
    }

    // Resolve credentials
    const { igUserId, pageToken } = await resolveAccountCredentials(business_account_id);

    // Send DM via Graph API
    const dmUrl = `${GRAPH_API_BASE}/me/messages`;
    const dmRes = await axios.post(dmUrl, {
      recipient: { id: recipient_id },
      message: { text: message_text }
    }, {
      params: { access_token: pageToken }
    });

    const latency = Date.now() - startTime;

    // Log API request and audit trail
    await logApiRequest({
      endpoint: '/send-dm',
      method: 'POST',
      business_account_id,
      user_id: igUserId,
      success: true,
      latency
    });

    await logAudit({
      event_type: 'dm_sent',
      action: 'send',
      resource_type: 'instagram_dm',
      resource_id: dmRes.data.message_id || dmRes.data.id,
      details: { recipient_id, message_text },
      success: true
    });

    res.json({
      success: true,
      id: dmRes.data.message_id || dmRes.data.id
    });

  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error.response?.data?.error?.message || error.message;

    await logApiRequest({
      endpoint: '/send-dm',
      method: 'POST',
      business_account_id,
      success: false,
      error: errorMessage,
      latency
    });

    console.error('❌ DM send failed:', errorMessage);
    res.status(error.response?.status || 500).json({
      error: errorMessage,
      code: error.response?.data?.error?.code
    });
  }
});

// ============================================
// ENDPOINT 4: POST /publish-post (Content Scheduler)
// ============================================

/**
 * Publishes an Instagram post (2-step: create media container, then publish)
 * Used by: Content scheduler (scheduler/content_scheduler.py)
 * Rate limited: Soft daily limit to avoid spam flags
 */
router.post('/publish-post', async (req, res) => {
  const startTime = Date.now();
  const { business_account_id, image_url, caption, media_type, scheduled_post_id } = req.body;

  try {
    // Validation
    if (!business_account_id || !image_url || !caption) {
      return res.status(400).json({
        error: 'Missing required fields: business_account_id, image_url, caption'
      });
    }

    const type = (media_type || 'IMAGE').toUpperCase();

    // Resolve credentials
    const { igUserId, pageToken, userId } = await resolveAccountCredentials(business_account_id);

    // Step 1: Create media container
    const createUrl = `${GRAPH_API_BASE}/${igUserId}/media`;
    const createPayload = {
      caption,
      access_token: pageToken
    };

    // Add media URL based on type
    if (type === 'VIDEO' || type === 'REELS') {
      createPayload.video_url = image_url;
      createPayload.media_type = type;
    } else {
      createPayload.image_url = image_url;
    }

    const createRes = await axios.post(createUrl, null, { params: createPayload });
    const creationId = createRes.data.id;

    if (!creationId) {
      throw new Error('Failed to create media container');
    }

    // Step 2: Publish media container
    const publishUrl = `${GRAPH_API_BASE}/${igUserId}/media_publish`;
    const publishRes = await axios.post(publishUrl, null, {
      params: {
        creation_id: creationId,
        access_token: pageToken
      }
    });

    const mediaId = publishRes.data.id;
    const latency = Date.now() - startTime;

    // Update scheduled_posts table if scheduled_post_id provided
    if (scheduled_post_id) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        await supabase
          .from('scheduled_posts')
          .update({
            status: 'published',
            instagram_media_id: mediaId,
            published_at: new Date().toISOString()
          })
          .eq('id', scheduled_post_id);
      }
    }

    // Log API request and audit trail
    await logApiRequest({
      endpoint: '/publish-post',
      method: 'POST',
      business_account_id,
      user_id: userId,
      success: true,
      latency
    });

    await logAudit({
      event_type: 'post_published',
      action: 'publish',
      resource_type: 'instagram_post',
      resource_id: mediaId,
      details: { caption, image_url, media_type: type, scheduled_post_id },
      success: true
    });

    res.json({ id: mediaId });

  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error.response?.data?.error?.message || error.message;

    await logApiRequest({
      endpoint: '/publish-post',
      method: 'POST',
      business_account_id,
      success: false,
      error: errorMessage,
      latency
    });

    console.error('❌ Post publish failed:', errorMessage);
    res.status(error.response?.status || 500).json({
      error: errorMessage,
      code: error.response?.data?.error?.code
    });
  }
});

// ============================================
// ENDPOINT 5: GET /insights (Analytics Reports)
// ============================================

/**
 * Gets account or media insights for analytics reports
 * Used by: Analytics reports scheduler (scheduler/analytics_reports.py)
 */
router.get('/insights', async (req, res) => {
  const startTime = Date.now();
  const { business_account_id, since, until, metric_type } = req.query;

  try {
    // Validation
    if (!business_account_id) {
      return res.status(400).json({
        error: 'Missing required query parameter: business_account_id'
      });
    }

    const type = metric_type || 'account';

    // Resolve credentials
    const { igUserId, pageToken } = await resolveAccountCredentials(business_account_id);

    let insightsData = {};

    if (type === 'account') {
      // Get account insights using existing function (handles fallback for code 100)
      const accountInsights = await getAccountInsights(igUserId, pageToken, {
        period: '7d',
        until
      });

      insightsData = accountInsights;

    } else if (type === 'media') {
      // Get media insights - fetch recent media first
      const mediaUrl = `${GRAPH_API_BASE}/${igUserId}/media`;
      const mediaRes = await axios.get(mediaUrl, {
        params: {
          fields: 'id,media_type,timestamp,caption',
          limit: 25,
          access_token: pageToken
        }
      });

      const mediaList = mediaRes.data.data || [];

      // Fetch insights for each media item (parallel)
      const mediaInsightsPromises = mediaList.map(async (media) => {
        try {
          const insightsUrl = `${GRAPH_API_BASE}/${media.id}/insights`;
          const insightsRes = await axios.get(insightsUrl, {
            params: {
              metric: 'reach,impressions,saved',
              access_token: pageToken
            }
          });

          return {
            media_id: media.id,
            media_type: media.media_type,
            timestamp: media.timestamp,
            insights: insightsRes.data.data || []
          };
        } catch (err) {
          // Gracefully handle individual media insight failures
          console.warn(`⚠️ Failed to fetch insights for media ${media.id}:`, err.message);
          return {
            media_id: media.id,
            media_type: media.media_type,
            timestamp: media.timestamp,
            insights: [],
            error: err.message
          };
        }
      });

      const mediaInsights = await Promise.all(mediaInsightsPromises);
      insightsData = { media_insights: mediaInsights };

    } else {
      return res.status(400).json({
        error: 'Invalid metric_type. Must be "account" or "media"'
      });
    }

    const latency = Date.now() - startTime;

    // Log API request
    await logApiRequest({
      endpoint: '/insights',
      method: 'GET',
      business_account_id,
      user_id: igUserId,
      success: true,
      latency
    });

    res.json({
      success: true,
      data: insightsData
    });

  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error.response?.data?.error?.message || error.message;

    await logApiRequest({
      endpoint: '/insights',
      method: 'GET',
      business_account_id,
      success: false,
      error: errorMessage,
      latency
    });

    console.error('❌ Insights fetch failed:', errorMessage);
    res.status(error.response?.status || 500).json({
      error: errorMessage,
      code: error.response?.data?.error?.code
    });
  }
});

module.exports = router;
