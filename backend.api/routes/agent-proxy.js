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

// ============================================
// ENDPOINT 6: POST /oversight/chat (Oversight Agent SSE)
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

  const cleanup = (reason) => {
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

module.exports = router;
