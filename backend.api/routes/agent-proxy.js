// backend/routes/agent-proxy.js - Agent Proxy Layer (Path C)
// Provides 13 REST endpoints for the Python/LangChain agent to execute IG API calls
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
// SHARED HELPERS: SUPABASE WRITE-THROUGH
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
        fields: 'id,media_type,media_url,thumbnail_url,permalink,caption,timestamp,username,like_count,comments_count,owner{id}',
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

    // Flatten owner{id} → owner_id for agent compatibility
    const media = (mediaRes.data.data || []).map(item => ({
      ...item,
      owner_id: item.owner?.id || null,
    }));

    // --- Supabase write-through: raw UGC for agent scoring pipeline ---
    if (media.length > 0) {
      try {
        const supabase = getSupabaseAdmin();
        if (supabase) {
          const ugcRecords = media
            .filter(m => m.id)
            .map(m => ({
              business_account_id,
              instagram_media_id: m.id,
              source: 'hashtag',
              source_hashtag: cleanHashtag,
              username: m.username || null,
              caption: (m.caption || '').slice(0, 2000),
              media_type: m.media_type || null,
              media_url: m.media_url || m.thumbnail_url || null,
              permalink: m.permalink || null,
              like_count: m.like_count || 0,
              comments_count: m.comments_count || 0,
              post_timestamp: m.timestamp || null,
              quality_score: null,
              quality_tier: null,
            }));
          const { error: upsertErr } = await supabase
            .from('ugc_discovered')
            .upsert(ugcRecords, { onConflict: 'instagram_media_id', ignoreDuplicates: false });
          if (upsertErr) console.warn('⚠️ UGC hashtag write-through failed:', upsertErr.message);
        }
      } catch (wtErr) {
        console.warn('⚠️ UGC hashtag write-through error:', wtErr.message);
      }
    }
    // --- End write-through ---

    // Return both formats for compatibility
    res.json({
      recent_media: media,
      data: media
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

    const taggedPosts = tagsRes.data.data || [];

    // --- Supabase write-through: raw tagged UGC for agent scoring pipeline ---
    if (taggedPosts.length > 0) {
      try {
        const supabase = getSupabaseAdmin();
        if (supabase) {
          const ugcRecords = taggedPosts
            .filter(p => p.id)
            .map(p => ({
              business_account_id,
              instagram_media_id: p.id,
              source: 'tagged',
              source_hashtag: null,
              username: p.username || null,
              caption: (p.caption || '').slice(0, 2000),
              media_type: p.media_type || null,
              media_url: p.media_url || p.thumbnail_url || null,
              permalink: p.permalink || null,
              like_count: p.like_count || 0,
              comments_count: p.comments_count || 0,
              post_timestamp: p.timestamp || null,
              quality_score: null,
              quality_tier: null,
            }));
          const { error: upsertErr } = await supabase
            .from('ugc_discovered')
            .upsert(ugcRecords, { onConflict: 'instagram_media_id', ignoreDuplicates: false });
          if (upsertErr) console.warn('⚠️ UGC tags write-through failed:', upsertErr.message);
        }
      } catch (wtErr) {
        console.warn('⚠️ UGC tags write-through error:', wtErr.message);
      }
    }
    // --- End write-through ---

    // Return both formats for compatibility
    res.json({
      tagged_posts: taggedPosts,
      data: taggedPosts
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
  let { business_account_id, recipient_id, recipient_username, message_text } = req.body;

  try {
    // Validation
    if (!business_account_id || !message_text) {
      return res.status(400).json({
        error: 'Missing required fields: business_account_id, message_text'
      });
    }

    if (!recipient_id && !recipient_username) {
      return res.status(400).json({
        error: 'Either recipient_id (numeric IGSID) or recipient_username must be provided'
      });
    }

    if (message_text.length > 1000) {
      return res.status(400).json({ error: 'message_text exceeds 1000 character limit' });
    }

    // Resolve credentials
    const { igUserId, pageToken } = await resolveAccountCredentials(business_account_id);

    // If only recipient_username provided, resolve to numeric IGSID via business_discovery
    if (!recipient_id && recipient_username) {
      const cleanUsername = recipient_username.replace(/^@/, '');
      try {
        const discoveryRes = await axios.get(`${GRAPH_API_BASE}/${igUserId}`, {
          params: {
            fields: `business_discovery.fields(ig_id).username(${cleanUsername})`,
            access_token: pageToken
          }
        });
        recipient_id = discoveryRes.data?.business_discovery?.ig_id;
      } catch (discoveryErr) {
        const discoveryError = discoveryErr.response?.data?.error?.message || discoveryErr.message;
        console.error(`❌ Username resolution failed for @${cleanUsername}:`, discoveryError);
        return res.status(404).json({
          error: `Could not resolve username '@${cleanUsername}' to an Instagram ID. The account must be a Business/Creator account.`,
          code: 'USERNAME_RESOLUTION_FAILED'
        });
      }

      if (!recipient_id) {
        return res.status(404).json({
          error: `Username '@${cleanUsername}' not found or is not a Business/Creator account`,
          code: 'USERNAME_NOT_FOUND'
        });
      }
    }

    // Validate resolved recipient_id is numeric IGSID
    if (!/^\d+$/.test(recipient_id)) {
      return res.status(400).json({
        error: 'recipient_id must be a numeric Instagram Scoped ID (IGSID)'
      });
    }

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

    // --- Supabase write-through: log outgoing DM (conversation_id null — not returned by Graph API) ---
    try {
      const supabase = getSupabaseAdmin();
      const messageId = dmRes.data.message_id || dmRes.data.id;
      if (supabase && messageId) {
        const { error: msgErr } = await supabase
          .from('instagram_dm_messages')
          .upsert({
            message_id: messageId,
            message_text,
            conversation_id: null,
            business_account_id,
            is_from_business: true,
            recipient_instagram_id: recipient_id,
            sent_at: new Date().toISOString(),
            send_status: 'sent',
          }, { onConflict: 'message_id', ignoreDuplicates: false });
        if (msgErr) console.warn('⚠️ Send-DM write-through failed:', msgErr.message);
      }
    } catch (wtErr) {
      console.warn('⚠️ Send-DM write-through error:', wtErr.message);
    }
    // --- End write-through ---

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

    // --- Supabase write-through: create instagram_media stub so agent can read post context immediately ---
    try {
      const supabase = getSupabaseAdmin();
      if (supabase && mediaId) {
        await supabase
          .from('instagram_media')
          .upsert({
            instagram_media_id: mediaId,
            business_account_id,
            media_type: type,
            caption,
            published_at: new Date().toISOString(),
          }, { onConflict: 'instagram_media_id', ignoreDuplicates: false });
      }
    } catch (wtErr) {
      console.warn('⚠️ instagram_media publish write-through error:', wtErr.message);
    }
    // --- End write-through ---

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
// SHARED HELPER: INSIGHTS REQUEST HANDLER
// ============================================
// Extracted so /insights, /account-insights, and /media-insights can share one implementation.
// metricTypeOverride: if provided, ignores the metric_type query param.

async function handleInsightsRequest(req, res, startTime, metricTypeOverride) {
  const { business_account_id, since, until, metric_type } = req.query;

  try {
    // Validation
    if (!business_account_id) {
      return res.status(400).json({
        error: 'Missing required query parameter: business_account_id'
      });
    }

    const type = metricTypeOverride || metric_type || 'account';

    // Resolve credentials
    const { igUserId, pageToken } = await resolveAccountCredentials(business_account_id);

    let insightsData = {};

    if (type === 'account') {
      // Get account insights using existing function (handles fallback for code 100)
      // Pass since/until from agent request — Graph API expects Unix timestamps or ISO strings
      const accountInsights = await getAccountInsights(igUserId, pageToken, {
        since,
        until
      });

      insightsData = accountInsights;

    } else if (type === 'media') {
      // Get media insights - fetch media filtered by date range
      // Graph API /{igUserId}/media accepts since/until as Unix timestamps
      const mediaUrl = `${GRAPH_API_BASE}/${igUserId}/media`;
      const mediaParams = {
        fields: 'id,media_type,timestamp,caption',
        limit: 50,
        access_token: pageToken
      };
      // Convert ISO date strings to Unix timestamps for Graph API (if provided)
      if (since) mediaParams.since = Math.floor(new Date(since).getTime() / 1000);
      if (until) mediaParams.until = Math.floor(new Date(until).getTime() / 1000);

      const mediaRes = await axios.get(mediaUrl, { params: mediaParams });

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

      // --- Supabase write-through: upsert instagram_media metrics + sync hashtags ---
      if (mediaInsights.length > 0) {
        try {
          const supabase = getSupabaseAdmin();
          if (supabase) {
            // A) Upsert engagement metrics into instagram_media
            const mediaRecords = mediaInsights.map(m => ({
              instagram_media_id: m.media_id,
              business_account_id,
              media_type: m.media_type || null,
              reach: m.insights.find(i => i.name === 'reach')?.values?.[0]?.value || 0,
              published_at: m.timestamp || null,
            }));
            const { error: mediaErr } = await supabase
              .from('instagram_media')
              .upsert(mediaRecords, { onConflict: 'instagram_media_id', ignoreDuplicates: false });
            if (mediaErr) console.warn('⚠️ instagram_media insights write-through failed:', mediaErr.message);

            // B) Auto-extract hashtags from captions → ugc_monitored_hashtags
            const captions = mediaList.map(m => m.caption).filter(Boolean);
            await syncHashtagsFromCaptions(supabase, business_account_id, captions);
          }
        } catch (wtErr) {
          console.warn('⚠️ Media insights write-through error:', wtErr.message);
        }
      }
      // --- End write-through ---

    } else {
      return res.status(400).json({
        error: 'Invalid metric_type. Must be "account" or "media"'
      });
    }

    const latency = Date.now() - startTime;
    const endpointName = metricTypeOverride === 'account' ? '/account-insights'
      : metricTypeOverride === 'media' ? '/media-insights'
      : '/insights';

    await logApiRequest({
      endpoint: endpointName,
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
      endpoint: metricTypeOverride ? `/${metricTypeOverride === 'account' ? 'account' : 'media'}-insights` : '/insights',
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
}

// ============================================
// ENDPOINT 5: GET /insights (Analytics Reports)
// ============================================

/**
 * Gets account or media insights for analytics reports
 * Used by: Analytics reports scheduler (scheduler/analytics_reports.py)
 * Also available via /account-insights and /media-insights aliases (agent naming convention)
 */
router.get('/insights', (req, res) => handleInsightsRequest(req, res, Date.now(), null));

// ============================================
// ENDPOINT 5A: GET /account-insights (Agent alias for /insights?metric_type=account)
// ============================================

/**
 * Account-level insights alias matching agent naming convention.
 * Agent calls: GET /account-insights?business_account_id=X&since=Y&until=Z
 * Used by: analytics_tools.py fetch_account_insights()
 */
router.get('/account-insights', (req, res) => handleInsightsRequest(req, res, Date.now(), 'account'));

// ============================================
// ENDPOINT 5B: GET /media-insights (Agent alias for /insights?metric_type=media)
// ============================================

/**
 * Media-level insights alias matching agent naming convention.
 * Agent calls: GET /media-insights?business_account_id=X&since=Y&until=Z
 * Used by: analytics_tools.py fetch_media_insights()
 */
router.get('/media-insights', (req, res) => handleInsightsRequest(req, res, Date.now(), 'media'));

// ============================================
// ENDPOINT 6: POST /reply-comment (Engagement Monitor)
// ============================================

/**
 * Replies to an Instagram comment.
 * Used by: Engagement monitor (scheduler/engagement_monitor.py via automation_tools.py)
 * Agent sends: { comment_id, reply_text, business_account_id, post_id }
 */
router.post('/reply-comment', async (req, res) => {
  const startTime = Date.now();
  const { business_account_id, comment_id, reply_text, post_id } = req.body;

  try {
    // Validation
    if (!business_account_id || !comment_id || !reply_text) {
      return res.status(400).json({
        error: 'Missing required fields: business_account_id, comment_id, reply_text'
      });
    }

    if (!/^\d+$/.test(String(comment_id))) {
      return res.status(400).json({ error: 'Invalid comment_id format' });
    }

    if (reply_text.length > 2200) {
      return res.status(400).json({
        error: 'reply_text exceeds 2200 character limit'
      });
    }

    // Resolve credentials
    const { pageToken, userId } = await resolveAccountCredentials(business_account_id);

    // POST /{comment_id}/replies — same Graph API pattern as instagram-api.js:882
    const replyRes = await axios.post(`${GRAPH_API_BASE}/${comment_id}/replies`, null, {
      params: {
        message: reply_text.trim(),
        access_token: pageToken
      },
      timeout: 10000
    });

    const latency = Date.now() - startTime;

    await logApiRequest({
      endpoint: '/reply-comment',
      method: 'POST',
      business_account_id,
      user_id: userId,
      success: true,
      latency
    });

    await logAudit({
      event_type: 'comment_reply_sent',
      action: 'reply',
      resource_type: 'instagram_comment',
      resource_id: replyRes.data.id,
      details: { comment_id, post_id, reply_text },
      success: true
    });

    res.json({ success: true, id: replyRes.data.id });

  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error.response?.data?.error?.message || error.message;

    await logApiRequest({
      endpoint: '/reply-comment',
      method: 'POST',
      business_account_id,
      success: false,
      error: errorMessage,
      latency
    });

    console.error('❌ Comment reply failed:', errorMessage);
    res.status(error.response?.status || 500).json({
      error: errorMessage,
      code: error.response?.data?.error?.code
    });
  }
});

// ============================================
// ENDPOINT 7: POST /reply-dm (Engagement Monitor)
// ============================================

/**
 * Sends a reply into an existing DM conversation.
 * Used by: Engagement monitor (scheduler/engagement_monitor.py via automation_tools.py)
 * Agent sends: { conversation_id, recipient_id, message_text, business_account_id }
 */
router.post('/reply-dm', async (req, res) => {
  const startTime = Date.now();
  const { business_account_id, conversation_id, recipient_id, message_text } = req.body;

  try {
    // Validation
    if (!business_account_id || !conversation_id || !message_text) {
      return res.status(400).json({
        error: 'Missing required fields: business_account_id, conversation_id, message_text'
      });
    }

    if (!/^[\w-]+$/.test(String(conversation_id))) {
      return res.status(400).json({ error: 'Invalid conversation_id format' });
    }

    if (message_text.length > 1000) {
      return res.status(400).json({ error: 'message_text exceeds 1000 character limit' });
    }

    // Resolve credentials
    const { pageToken, userId } = await resolveAccountCredentials(business_account_id);

    // POST /{conversation_id}/messages — same Graph API pattern as instagram-api.js:2013
    const dmRes = await axios.post(`${GRAPH_API_BASE}/${conversation_id}/messages`, null, {
      params: {
        message: message_text.trim(),
        access_token: pageToken
      },
      timeout: 10000
    });

    const latency = Date.now() - startTime;

    await logApiRequest({
      endpoint: '/reply-dm',
      method: 'POST',
      business_account_id,
      user_id: userId,
      success: true,
      latency
    });

    await logAudit({
      event_type: 'dm_reply_sent',
      action: 'reply',
      resource_type: 'instagram_dm',
      resource_id: dmRes.data.id,
      details: { conversation_id, recipient_id },
      success: true
    });

    // --- Supabase write-through: log outgoing DM reply for conversation history ---
    try {
      const supabase = getSupabaseAdmin();
      if (supabase && dmRes.data.id) {
        const { error: msgErr } = await supabase
          .from('instagram_dm_messages')
          .upsert({
            message_id: dmRes.data.id,
            message_text: message_text.trim(),
            conversation_id,
            business_account_id,
            is_from_business: true,
            recipient_instagram_id: recipient_id || null,
            sent_at: new Date().toISOString(),
            send_status: 'sent',
          }, { onConflict: 'message_id', ignoreDuplicates: false });
        if (msgErr) console.warn('⚠️ DM reply write-through failed:', msgErr.message);
      }
    } catch (wtErr) {
      console.warn('⚠️ DM reply write-through error:', wtErr.message);
    }
    // --- End write-through ---

    res.json({ success: true, id: dmRes.data.id });

  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error.response?.data?.error?.message || error.message;

    await logApiRequest({
      endpoint: '/reply-dm',
      method: 'POST',
      business_account_id,
      success: false,
      error: errorMessage,
      latency
    });

    console.error('❌ DM reply failed:', errorMessage);
    res.status(error.response?.status || 500).json({
      error: errorMessage,
      code: error.response?.data?.error?.code
    });
  }
});

// ============================================
// ENDPOINT 8: POST /oversight/chat (Oversight Agent SSE)
// ============================================
// Transparent proxy for the Python/LangChain Oversight Brain.
// Streams agent responses to the frontend via Server-Sent Events.
//
// Full path: POST /api/instagram/oversight/chat
// Body: { question: string, business_account_id: string, stream?: boolean, chat_history?: array, ...extra }
// Query: ?stream=true (alternative to body.stream)
//
// Matches the agent's ChatRequest shape exactly.
// No IG credentials needed - this proxies to the agent, not the Graph API.

router.post('/oversight/chat', async (req, res) => {
  const startTime = Date.now();
  const { question, business_account_id, stream = false, ...rest } = req.body;
  const isStreaming = stream === true || req.query.stream === 'true';
  const userIdHeader = req.headers['x-user-id'] || 'dashboard-user';

  // --- Validation (all before any SSE headers are set) ---
  if (!process.env.AGENT_URL) {
    return res.status(500).json({ error: 'AGENT_URL not configured', code: 'CONFIG_ERROR' });
  }

  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return res.status(400).json({ error: 'Missing required field: question', code: 'MISSING_QUESTION' });
  }

  if (question.length > 2000) {
    return res.status(400).json({ error: 'question exceeds 2000 characters', code: 'QUESTION_TOO_LONG' });
  }

  if (!business_account_id) {
    return res.status(400).json({ error: 'Missing required field: business_account_id', code: 'MISSING_BUSINESS_ACCOUNT_ID' });
  }

  const agentUrl = `${process.env.AGENT_URL}/oversight/chat${isStreaming ? '?stream=true' : ''}`;
  const agentPayload = { question: question.trim(), business_account_id, stream: isStreaming, ...rest };
  const agentHeaders = {
    'Content-Type': 'application/json',
    'X-API-Key': process.env.AGENT_API_KEY,
    'X-User-ID': userIdHeader
  };

  // --- NON-STREAMING: standard JSON proxy ---
  if (!isStreaming) {
    try {
      const agentRes = await axios.post(agentUrl, agentPayload, {
        headers: agentHeaders,
        timeout: 60000
      });

      const latency = Date.now() - startTime;

      await logApiRequest({
        endpoint: '/oversight/chat',
        method: 'POST',
        business_account_id,
        user_id: userIdHeader,
        success: true,
        latency
      });

      return res.json(agentRes.data);
    } catch (err) {
      const latency = Date.now() - startTime;
      const errorMsg = err.response?.data?.error || err.message;

      await logApiRequest({
        endpoint: '/oversight/chat',
        method: 'POST',
        business_account_id,
        success: false,
        error: errorMsg,
        latency
      });

      console.error('[Oversight] Non-streaming error:', errorMsg);
      return res.status(err.response?.status || 500).json({ error: errorMsg });
    }
  }

  // === STREAMING SSE PATH ===

  // Cleanup state (prevents double-cleanup when both req.close and stream.end fire)
  let cleanedUp = false;
  let agentStream = null;
  let pingInterval = null;

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    if (pingInterval) { clearInterval(pingInterval); pingInterval = null; }
    if (agentStream) { try { agentStream.destroy(); } catch (_) {} agentStream = null; }
  };

  // SSE headers - MUST be set before res.flushHeaders()
  // Override security middleware's Cache-Control: no-store (server.js:178)
  // SSE requires no-cache so proxies (Nginx/Cloudflare) don't buffer the stream
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Flush headers immediately to establish the SSE connection
  // Without this, the browser waits until first data chunk (up to 15s for the ping)
  res.flushHeaders();

  // Keep-alive ping every 15s (SSE comment lines are ignored by EventSource)
  // Prevents Cloudflare/Nginx from dropping idle connections
  pingInterval = setInterval(() => {
    if (!res.writableEnded) res.write(': ping\n\n');
  }, 15000);

  // Client disconnect handler (browser closes tab / EventSource.close())
  req.on('close', () => cleanup('client disconnected'));

  try {
    const agentRes = await axios.post(agentUrl, agentPayload, {
      headers: { ...agentHeaders, Accept: 'text/event-stream' },
      responseType: 'stream',
      timeout: 0   // no timeout on long-running streams
    });

    agentStream = agentRes.data;

    // Pipe agent SSE chunks to client verbatim
    agentStream.on('data', (chunk) => {
      if (!res.writableEnded) res.write(chunk);
    });

    agentStream.on('end', async () => {
      if (!res.writableEnded) res.end();

      const latency = Date.now() - startTime;
      await logApiRequest({
        endpoint: '/oversight/chat',
        method: 'POST',
        business_account_id,
        user_id: userIdHeader,
        success: true,
        latency,
        details: { stream: true }
      });

      cleanup('stream ended');
    });

    agentStream.on('error', async (streamErr) => {
      console.error('[Oversight SSE] Agent stream error:', streamErr.message);

      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ type: 'error', content: streamErr.message })}\n\n`);
        res.end();
      }

      const latency = Date.now() - startTime;
      await logApiRequest({
        endpoint: '/oversight/chat',
        method: 'POST',
        business_account_id,
        success: false,
        error: streamErr.message,
        latency,
        details: { stream: true }
      });

      cleanup('stream error');
    });

  } catch (err) {
    // Agent connection failure (unreachable, DNS, timeout on connect)
    // Headers are already flushed so we can't send HTTP status - use SSE error event
    const latency = Date.now() - startTime;
    const errorMsg = err.response?.data?.error || err.message;

    console.error('[Oversight SSE] Connection to agent failed:', errorMsg);

    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ type: 'error', content: errorMsg })}\n\n`);
      res.end();
    }

    await logApiRequest({
      endpoint: '/oversight/chat',
      method: 'POST',
      business_account_id,
      success: false,
      error: errorMsg,
      latency,
      details: { stream: true }
    });

    cleanup('agent connection failed');
  }
});

// ============================================
// ENDPOINT 9: GET /post-comments (Engagement Monitor)
// ============================================

/**
 * Fetches live comments for a specific Instagram media post.
 * Used by: Engagement monitor to read fresh comments before deciding to reply.
 * Agent sends: ?business_account_id=X&media_id=Y&limit=N
 * Wraps: instagram-api.js GET /comments/:mediaId
 */
router.get('/post-comments', async (req, res) => {
  const startTime = Date.now();
  const { business_account_id, media_id, limit } = req.query;

  try {
    if (!business_account_id || !media_id) {
      return res.status(400).json({
        error: 'Missing required query params: business_account_id, media_id'
      });
    }

    if (!/^\d+$/.test(String(media_id))) {
      return res.status(400).json({ error: 'Invalid media_id format' });
    }

    const fetchLimit = Math.min(parseInt(limit) || 50, 100);

    const { pageToken, userId } = await resolveAccountCredentials(business_account_id);

    // GET /{mediaId}/comments — same Graph API pattern as instagram-api.js:587
    const commentsRes = await axios.get(`${GRAPH_API_BASE}/${media_id}/comments`, {
      params: {
        fields: 'id,text,timestamp,username,like_count,replies_count',
        limit: fetchLimit,
        access_token: pageToken
      },
      timeout: 10000
    });

    const latency = Date.now() - startTime;

    await logApiRequest({
      endpoint: '/post-comments',
      method: 'GET',
      business_account_id,
      user_id: userId,
      success: true,
      latency
    });

    const comments = commentsRes.data.data || [];

    // --- Supabase write-through: upsert comments + ensure instagram_media record exists ---
    if (comments.length > 0) {
      try {
        const supabase = getSupabaseAdmin();
        if (supabase) {
          const mediaUUID = await ensureMediaRecord(supabase, media_id, business_account_id);
          if (mediaUUID) {
            const commentRecords = comments
              .filter(c => c.id)
              .map(c => ({
                instagram_comment_id: c.id,
                text: c.text || '',
                author_username: c.username || '',
                author_instagram_id: null,
                media_id: mediaUUID,
                business_account_id,
                created_at: c.timestamp,
                like_count: c.like_count || 0,
                processed_by_automation: false,
              }));
            const { error: upsertErr } = await supabase
              .from('instagram_comments')
              .upsert(commentRecords, { onConflict: 'instagram_comment_id', ignoreDuplicates: false });
            if (upsertErr) console.warn('⚠️ Comment write-through failed:', upsertErr.message);
          }
        }
      } catch (wtErr) {
        console.warn('⚠️ Comment write-through error:', wtErr.message);
      }
    }
    // --- End write-through ---

    res.json({
      success: true,
      data: comments,
      paging: commentsRes.data.paging || {},
      meta: { count: comments.length }
    });

  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error.response?.data?.error?.message || error.message;

    await logApiRequest({
      endpoint: '/post-comments',
      method: 'GET',
      business_account_id,
      success: false,
      error: errorMessage,
      latency
    });

    console.error('❌ Post comments fetch failed:', errorMessage);
    res.status(error.response?.status || 500).json({
      error: errorMessage,
      code: error.response?.data?.error?.code
    });
  }
});

// ============================================
// ENDPOINT 10: GET /conversations (Engagement Monitor)
// ============================================

/**
 * Lists active DM conversations with 24-hour messaging window status.
 * Used by: Engagement monitor to find conversations eligible for replies.
 * Agent sends: ?business_account_id=X&limit=N
 * Wraps: instagram-api.js GET /conversations/:id
 */
router.get('/conversations', async (req, res) => {
  const startTime = Date.now();
  const { business_account_id, limit } = req.query;

  try {
    if (!business_account_id) {
      return res.status(400).json({
        error: 'Missing required query param: business_account_id'
      });
    }

    const fetchLimit = Math.min(parseInt(limit) || 20, 50);

    const { igUserId, pageToken, userId } = await resolveAccountCredentials(business_account_id);

    // GET /{igUserId}/conversations — same Graph API pattern as instagram-api.js:1703
    const convRes = await axios.get(`${GRAPH_API_BASE}/${igUserId}/conversations`, {
      params: {
        fields: 'id,participants,updated_time,message_count,messages{created_time,from}',
        platform: 'instagram',
        limit: fetchLimit,
        access_token: pageToken
      },
      timeout: 10000
    });

    // Transform with 24-hour window calculation (same logic as instagram-api.js:1726-1759)
    const now = new Date();
    const conversations = (convRes.data.data || []).map(conv => {
      const lastMessage = conv.messages?.data?.[0];
      const lastMessageTime = lastMessage ? new Date(lastMessage.created_time) : null;
      const hoursSinceLastMessage = lastMessageTime
        ? (now - lastMessageTime) / (1000 * 60 * 60)
        : null;
      const isWithin24Hours = hoursSinceLastMessage !== null && hoursSinceLastMessage < 24;
      const hoursRemaining = hoursSinceLastMessage !== null
        ? Math.max(0, 24 - hoursSinceLastMessage)
        : null;

      return {
        id: conv.id,
        participants: conv.participants?.data || [],
        last_message_at: conv.updated_time,
        message_count: conv.message_count || 0,
        last_message: lastMessage || null,
        messaging_window: {
          is_open: isWithin24Hours,
          hours_remaining: hoursRemaining !== null ? parseFloat(hoursRemaining.toFixed(1)) : null,
          requires_template: hoursSinceLastMessage !== null && hoursSinceLastMessage >= 24,
          last_customer_message_at: lastMessageTime ? lastMessageTime.toISOString() : null
        },
        within_window: isWithin24Hours,
        can_send_messages: isWithin24Hours
      };
    });

    const latency = Date.now() - startTime;

    await logApiRequest({
      endpoint: '/conversations',
      method: 'GET',
      business_account_id,
      user_id: userId,
      success: true,
      latency
    });

    // --- Supabase write-through: upsert DM conversations with 24h window status ---
    if (conversations.length > 0) {
      try {
        const supabase = getSupabaseAdmin();
        if (supabase) {
          const convRecords = conversations
            .filter(conv => conv.participants?.length > 0 && conv.participants[0].id)
            .map(conv => {
              const mw = conv.messaging_window || {};
              const isOpen = mw.is_open || false;
              const hoursRemaining = mw.hours_remaining;
              const windowExpiresAt = isOpen && hoursRemaining != null
                ? new Date(Date.now() + hoursRemaining * 3600000).toISOString()
                : null;
              return {
                customer_instagram_id: conv.participants[0].id,
                business_account_id,
                conversation_id: conv.id,
                within_window: isOpen,
                window_expires_at: windowExpiresAt,
                last_message_at: conv.last_message_at,
                message_count: conv.message_count || 0,
                conversation_status: 'open',
              };
            });
          if (convRecords.length > 0) {
            const { error: upsertErr } = await supabase
              .from('instagram_dm_conversations')
              .upsert(convRecords, { onConflict: 'customer_instagram_id,business_account_id', ignoreDuplicates: false });
            if (upsertErr) console.warn('⚠️ Conversation write-through failed:', upsertErr.message);
          }
        }
      } catch (wtErr) {
        console.warn('⚠️ Conversation write-through error:', wtErr.message);
      }
    }
    // --- End write-through ---

    res.json({
      success: true,
      data: conversations,
      paging: convRes.data.paging || {},
      meta: { count: conversations.length }
    });

  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error.response?.data?.error?.message || error.message;

    await logApiRequest({
      endpoint: '/conversations',
      method: 'GET',
      business_account_id,
      success: false,
      error: errorMessage,
      latency
    });

    console.error('❌ Conversations fetch failed:', errorMessage);
    res.status(error.response?.status || 500).json({
      error: errorMessage,
      code: error.response?.data?.error?.code
    });
  }
});

// ============================================
// ENDPOINT 11: GET /conversation-messages (Engagement Monitor)
// ============================================

/**
 * Fetches messages for a specific DM conversation.
 * Used by: Engagement monitor to read thread history before crafting a reply.
 * Agent sends: ?business_account_id=X&conversation_id=Y&limit=N
 * Wraps: instagram-api.js GET /conversations/:conversationId/messages
 */
router.get('/conversation-messages', async (req, res) => {
  const startTime = Date.now();
  const { business_account_id, conversation_id, limit } = req.query;

  try {
    if (!business_account_id || !conversation_id) {
      return res.status(400).json({
        error: 'Missing required query params: business_account_id, conversation_id'
      });
    }

    if (!/^[\w-]+$/.test(String(conversation_id))) {
      return res.status(400).json({ error: 'Invalid conversation_id format' });
    }

    const fetchLimit = Math.min(parseInt(limit) || 20, 100);

    const { igUserId, pageToken, userId } = await resolveAccountCredentials(business_account_id);

    // GET /{conversationId}/messages — same Graph API pattern as instagram-api.js:1873
    const msgRes = await axios.get(`${GRAPH_API_BASE}/${conversation_id}/messages`, {
      params: {
        fields: 'id,message,from,created_time,attachments',
        limit: fetchLimit,
        access_token: pageToken
      },
      timeout: 10000
    });

    const latency = Date.now() - startTime;

    await logApiRequest({
      endpoint: '/conversation-messages',
      method: 'GET',
      business_account_id,
      user_id: userId,
      success: true,
      latency
    });

    const messages = msgRes.data.data || [];

    // --- Supabase write-through: upsert messages with is_from_business flag ---
    if (messages.length > 0) {
      try {
        const supabase = getSupabaseAdmin();
        if (supabase) {
          const msgRecords = messages
            .filter(m => m.id)
            .map(m => ({
              message_id: m.id,
              message_text: m.message || '',
              conversation_id,
              business_account_id,
              is_from_business: m.from?.id === igUserId,
              sent_at: m.created_time,
              send_status: 'received',
            }));
          const { error: upsertErr } = await supabase
            .from('instagram_dm_messages')
            .upsert(msgRecords, { onConflict: 'message_id', ignoreDuplicates: false });
          if (upsertErr) console.warn('⚠️ Message write-through failed:', upsertErr.message);
        }
      } catch (wtErr) {
        console.warn('⚠️ Message write-through error:', wtErr.message);
      }
    }
    // --- End write-through ---

    res.json({
      success: true,
      data: messages,
      paging: msgRes.data.paging || {},
      meta: { count: messages.length }
    });

  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error.response?.data?.error?.message || error.message;

    await logApiRequest({
      endpoint: '/conversation-messages',
      method: 'GET',
      business_account_id,
      success: false,
      error: errorMessage,
      latency
    });

    console.error('❌ Conversation messages fetch failed:', errorMessage);
    res.status(error.response?.status || 500).json({
      error: errorMessage,
      code: error.response?.data?.error?.code
    });
  }
});

// ============================================
// ENDPOINT 12: POST /repost-ugc (UGC Discovery)
// ============================================

/**
 * Reposts UGC content to the business Instagram account after verifying permission.
 * Used by: UGC discovery scheduler after creator grants permission.
 * Agent sends: { business_account_id, ugc_content_id }
 * Wraps: instagram-api.js POST /ugc/repost
 */
router.post('/repost-ugc', async (req, res) => {
  const startTime = Date.now();
  const { business_account_id, permission_id } = req.body;

  try {
    if (!business_account_id || !permission_id) {
      return res.status(400).json({
        error: 'Missing required fields: business_account_id, permission_id'
      });
    }

    const supabase = getSupabaseAdmin();

    // Step 1: Fetch permission record — must exist and be 'granted'
    const { data: permission, error: permError } = await supabase
      .from('ugc_permissions')
      .select('id, ugc_discovered_id, username, status, business_account_id')
      .eq('id', permission_id)
      .eq('business_account_id', business_account_id)
      .single();

    if (permError || !permission) {
      return res.status(404).json({
        error: 'Permission record not found',
        code: 'PERMISSION_NOT_FOUND'
      });
    }

    if (permission.status !== 'granted') {
      return res.status(403).json({
        error: 'Cannot repost: permission not granted by content creator',
        code: 'PERMISSION_DENIED',
        details: { current_status: permission.status }
      });
    }

    // Step 2: Fetch UGC media data from ugc_discovered
    const { data: ugcDiscovered, error: ugcError } = await supabase
      .from('ugc_discovered')
      .select('id, media_url, media_type, caption, username')
      .eq('id', permission.ugc_discovered_id)
      .single();

    if (ugcError || !ugcDiscovered) {
      return res.status(404).json({
        error: 'UGC content record not found',
        code: 'CONTENT_NOT_FOUND'
      });
    }

    const mediaUrl = ugcDiscovered.media_url;
    if (!mediaUrl) {
      return res.status(400).json({ error: 'UGC content has no media URL', code: 'NO_MEDIA_URL' });
    }

    // Step 3: Resolve credentials and publish (2-step: container → publish)
    const { igUserId, pageToken, userId } = await resolveAccountCredentials(business_account_id);

    const caption = ugcDiscovered.caption
      ? `📸 @${ugcDiscovered.username}: ${ugcDiscovered.caption}\n\n#repost`
      : `📸 @${ugcDiscovered.username}\n\n#repost`;

    // Create media container
    const createRes = await axios.post(`${GRAPH_API_BASE}/${igUserId}/media`, null, {
      params: { image_url: mediaUrl, caption, access_token: pageToken },
      timeout: 15000
    });

    const creationId = createRes.data.id;
    if (!creationId) throw new Error('Failed to create media container');

    // Publish container
    const publishRes = await axios.post(`${GRAPH_API_BASE}/${igUserId}/media_publish`, null, {
      params: { creation_id: creationId, access_token: pageToken },
      timeout: 15000
    });

    const mediaId = publishRes.data.id;
    const latency = Date.now() - startTime;

    // Update ugc_permissions record — mark as reposted
    await supabase
      .from('ugc_permissions')
      .update({
        status: 'reposted',
        reposted_at: new Date().toISOString(),
        instagram_media_id: mediaId
      })
      .eq('id', permission_id);

    await logApiRequest({
      endpoint: '/repost-ugc',
      method: 'POST',
      business_account_id,
      user_id: userId,
      success: true,
      latency
    });

    await logAudit({
      event_type: 'ugc_reposted',
      action: 'repost',
      resource_type: 'ugc_permissions',
      resource_id: mediaId,
      details: { permission_id, ugc_discovered_id: permission.ugc_discovered_id, author: ugcDiscovered.username },
      success: true
    });

    res.json({
      success: true,
      id: mediaId,
      original_author: ugcDiscovered.username
    });

  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error.response?.data?.error?.message || error.message;

    await logApiRequest({
      endpoint: '/repost-ugc',
      method: 'POST',
      business_account_id,
      success: false,
      error: errorMessage,
      latency
    });

    console.error('❌ UGC repost failed:', errorMessage);
    res.status(error.response?.status || 500).json({
      error: errorMessage,
      code: error.response?.data?.error?.code
    });
  }
});

// ============================================
// ENDPOINT 13: POST /sync-ugc (UGC / Analytics)
// ============================================

/**
 * Triggers a fresh sync of tagged/UGC posts from Instagram Graph API into Supabase.
 * Used by: UGC discovery scheduler after processing tags, to keep DB current.
 * Agent sends: { business_account_id }
 * Wraps: instagram-api.js POST /sync/ugc
 */
router.post('/sync-ugc', async (req, res) => {
  const startTime = Date.now();
  const { business_account_id } = req.body;

  try {
    if (!business_account_id) {
      return res.status(400).json({ error: 'Missing required field: business_account_id' });
    }

    const { igUserId, pageToken, userId } = await resolveAccountCredentials(business_account_id);

    // Fetch tagged posts from Graph API (same endpoint as /tags but stores to DB)
    const tagsRes = await axios.get(`${GRAPH_API_BASE}/${igUserId}/tags`, {
      params: {
        fields: 'id,media_type,media_url,thumbnail_url,caption,permalink,timestamp,username,like_count,comments_count',
        limit: 50,
        access_token: pageToken
      },
      timeout: 15000
    });

    const taggedPosts = tagsRes.data.data || [];

    // Upsert into ugc_discovered (canonical agent table)
    const supabase = getSupabaseAdmin();
    let syncedCount = 0;

    if (taggedPosts.length > 0) {
      const records = taggedPosts.map(post => ({
        business_account_id,
        instagram_media_id: post.id,
        username: post.username || null,
        media_type: post.media_type,
        media_url: post.media_url || post.thumbnail_url || null,
        caption: post.caption || null,
        permalink: post.permalink,
        post_timestamp: post.timestamp,
        like_count: post.like_count || 0,
        comments_count: post.comments_count || 0,
        source: 'tagged',
        quality_tier: null,
        quality_score: null
      }));

      const { error: upsertError } = await supabase
        .from('ugc_discovered')
        .upsert(records, { onConflict: 'instagram_media_id', ignoreDuplicates: false });

      if (!upsertError) syncedCount = records.length;
    }

    const latency = Date.now() - startTime;

    await logApiRequest({
      endpoint: '/sync-ugc',
      method: 'POST',
      business_account_id,
      user_id: userId,
      success: true,
      latency
    });

    res.json({ success: true, synced_count: syncedCount });

  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error.response?.data?.error?.message || error.message;

    await logApiRequest({
      endpoint: '/sync-ugc',
      method: 'POST',
      business_account_id,
      success: false,
      error: errorMessage,
      latency
    });

    console.error('❌ UGC sync failed:', errorMessage);
    res.status(error.response?.status || 500).json({
      error: errorMessage,
      code: error.response?.data?.error?.code
    });
  }
});

module.exports = router;
