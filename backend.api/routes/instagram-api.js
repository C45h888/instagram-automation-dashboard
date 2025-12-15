// backend.api/routes/instagram-api.js (NEW FILE)
const express = require('express');
const router = express.Router();
const axios = require('axios'); // ADDED: For Graph API calls
const { instagramAPIRateLimiter, logAfterResponse } = require('../middleware/rate-limiter');
const {
  exchangeForPageToken,
  getAccountInsights,
  storePageToken,
  retrievePageToken
} = require('../services/instagram-tokens');
const { logAudit, supabase } = require('../config/supabase'); // ADDED: Audit logging + DB client

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Validate image or video URL for Instagram posting
 * Requirements:
 *   - Must be HTTPS
 *   - Must be publicly accessible
 *   - Must be a valid image or video format
 */
function validateImageUrl(url) {
  try {
    const parsedUrl = new URL(url);

    // Must use HTTPS
    if (parsedUrl.protocol !== 'https:') {
      return { valid: false, error: 'Media URL must use HTTPS protocol' };
    }

    // Check for valid image or video extension
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.mov', '.avi'];
    const hasValidExtension = validExtensions.some(ext =>
      parsedUrl.pathname.toLowerCase().endsWith(ext)
    );

    if (!hasValidExtension) {
      return {
        valid: false,
        error: 'Media URL must end with .jpg, .jpeg, .png, .gif, .mp4, .mov, or .avi'
      };
    }

    // Check for localhost or private IPs (not allowed by Instagram)
    const hostname = parsedUrl.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.')) {
      return {
        valid: false,
        error: 'Media must be publicly accessible (not localhost or private IP)'
      };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Invalid URL format' };
  }
}

// ==========================================
// APPLY RATE LIMITING TO ALL ROUTES
// ==========================================
// These middleware apply to every route in this router
// Order matters: rate limit check → route handler → log after response

router.use(instagramAPIRateLimiter);  // Check rate limits before processing
router.use(logAfterResponse);          // Log after response is sent

// ==========================================
// TOKEN EXCHANGE ENDPOINTS
// ==========================================

/**
 * Exchange user access token for page access token
 *
 * This endpoint converts a user-level OAuth token into a page-level token
 * required for the instagram_manage_insights permission
 *
 * Process:
 * 1. Receive user access token from OAuth flow
 * 2. Query Facebook Graph API for user's pages
 * 3. Extract page token and Instagram Business account mapping
 * 4. Encrypt and store page token in database
 * 5. Return page metadata to client
 *
 * @route POST /api/instagram/exchange-token
 * @body {string} userAccessToken - User access token from OAuth
 * @body {string} userId - User UUID (for database storage)
 * @body {string} businessAccountId - Instagram Business account UUID
 * @returns {Object} Success response with page metadata
 */
router.post('/exchange-token', async (req, res) => {
  try {
    const { userAccessToken, userId, businessAccountId } = req.body;

    // ===== STEP 1: Validate required fields =====
    if (!userAccessToken) {
      console.error('❌ Missing userAccessToken in request body');
      return res.status(400).json({
        success: false,
        error: 'Missing required field: userAccessToken',
        code: 'MISSING_USER_TOKEN',
        message: 'Request body must include userAccessToken from OAuth flow'
      });
    }

    console.log('🔄 Token exchange request received');
    console.log('   User ID:', userId || 'not provided');
    console.log('   Business Account ID:', businessAccountId || 'not provided');

    // ===== STEP 2: Perform token exchange =====
    const pageTokenData = await exchangeForPageToken(userAccessToken);

    // ===== STEP 3: Store in database if IDs provided =====
    if (userId && businessAccountId) {
      console.log('💾 Storing page token in database...');
      await storePageToken(userId, businessAccountId, pageTokenData);
    } else {
      console.warn('⚠️  userId or businessAccountId not provided - token NOT stored in database');
      console.warn('   Token will only be returned in response (not recommended for production)');
    }

    // ===== STEP 4: Return success response =====
    // DO NOT return actual token in response for security
    res.json({
      success: true,
      message: 'Page token obtained and stored successfully',
      data: {
        pageId: pageTokenData.pageId,
        pageName: pageTokenData.pageName,
        igBusinessAccountId: pageTokenData.igBusinessAccountId,
        expiresIn: pageTokenData.expiresIn,
        tokenType: pageTokenData.tokenType,
        stored: !!(userId && businessAccountId)
      }
    });

    console.log('✅ Token exchange completed successfully');

  } catch (error) {
    console.error('❌ Token exchange error:', error);

    // Return user-friendly error message
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'TOKEN_EXCHANGE_FAILED',
      message: 'Failed to exchange token. See error for details.'
    });
  }
});

// ==========================================
// INSTAGRAM API ROUTES
// ==========================================
// All routes automatically rate limited and logged

/**
 * Get Instagram account insights using page token
 *
 * This endpoint has been UPDATED to use page tokens instead of user tokens
 * Rate limited to 200 calls/hour per user (enforced by instagramAPIRateLimiter)
 *
 * Flow:
 * 1. Extract user and business account IDs from query params
 * 2. Retrieve encrypted page token from database
 * 3. Decrypt page token
 * 4. Call Instagram Insights API with page token
 * 5. Return insights data with rate limit info
 *
 * @route GET /api/instagram/insights/:accountId
 * @param {string} accountId - Instagram Business account ID
 * @query {string} userId - User UUID (for token retrieval)
 * @query {string} businessAccountId - Business account UUID (for token retrieval)
 * @query {string} period - Time period (default: '7d', format: '7d', '30d', '90d')
 * @query {string} metrics - Comma-separated metrics (optional)
 * @returns {Object} Insights data with rate limit info
 */
router.get('/insights/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    const {
      period = '7d',
      userId,
      businessAccountId,
      metrics
    } = req.query;

    console.log('📊 Insights request received');
    console.log('   Account ID:', accountId);
    console.log('   Period:', period);
    console.log('   User ID:', userId || 'not provided');
    console.log('   Business Account ID:', businessAccountId || 'not provided');

    // ===== STEP 1: Validate required query parameters =====
    if (!userId || !businessAccountId) {
      console.error('❌ Missing required query parameters');
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
        code: 'MISSING_PARAMETERS',
        message: 'Query params must include userId and businessAccountId',
        required: ['userId', 'businessAccountId']
      });
    }

    // ===== STEP 2: Retrieve page token from database =====
    console.log('🔍 Retrieving page token from database...');
    const pageToken = await retrievePageToken(userId, businessAccountId);

    // ===== STEP 3: Parse metrics if provided =====
    const metricsArray = metrics ? metrics.split(',').map(m => m.trim()) : undefined;

    // ===== STEP 4: Get insights using page token =====
    console.log('📊 Fetching insights from Instagram API...');
    const insights = await getAccountInsights(accountId, pageToken, {
      period,
      metrics: metricsArray
    });

    // ===== STEP 5: Return insights with rate limit info =====
    res.json({
      success: true,
      data: insights.data,
      period: insights.period,
      metrics: insights.metrics,
      rate_limit: {
        remaining: req.rateLimitRemaining || 'unknown',
        limit: 200,
        window: '1 hour'
      }
    });

    console.log('✅ Insights returned successfully');

  } catch (error) {
    console.error('❌ Insights error:', error);

    // Return user-friendly error message
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'INSIGHTS_FETCH_FAILED',
      message: 'Failed to fetch insights. See error for details.'
    });
  }
});

/**
 * GET /api/instagram/media/:accountId
 * Fetches Instagram media for the authenticated business account
 *
 * Query Parameters:
 *   - userId: UUID of authenticated user
 *   - businessAccountId: Instagram business account ID
 *   - limit: Number of posts to fetch (default: 25, max: 100)
 *
 * Returns: Array of media objects with metadata
 */
router.get('/media/:accountId', async (req, res) => {
  const requestStartTime = Date.now();

  try {
    const { accountId } = req.params;
    const { limit = 25, userId, businessAccountId } = req.query;

    // ===== VALIDATION =====
    if (!userId || !businessAccountId) {
      console.error('❌ Missing required query parameters for media fetch');
      return res.status(400).json({
        success: false,
        error: 'userId and businessAccountId are required',
        code: 'MISSING_PARAMETERS'
      });
    }

    // Validate limit parameter
    const mediaLimit = Math.min(Math.max(parseInt(limit) || 25, 1), 100);

    console.log(`🖼️  Fetching media for account: ${accountId} (limit: ${mediaLimit})`);

    // ===== TOKEN RETRIEVAL =====
    let pageToken;
    try {
      pageToken = await retrievePageToken(userId, businessAccountId);
    } catch (tokenError) {
      console.error('❌ Token retrieval failed:', tokenError.message);

      // Log audit trail for failed token retrieval
      await logAudit('token_retrieval_failed', userId, {
        action: 'fetch_media',
        business_account_id: businessAccountId,
        error: tokenError.message
      });

      return res.status(401).json({
        success: false,
        error: 'Authentication failed. Please reconnect your Instagram account.',
        code: 'TOKEN_RETRIEVAL_FAILED'
      });
    }

    const igAccountId = accountId;

    // ===== GRAPH API CALL =====
    const fields = 'id,media_type,media_url,thumbnail_url,caption,permalink,timestamp,like_count,comments_count';
    const graphApiUrl = `https://graph.facebook.com/v23.0/${igAccountId}/media`;

    try {
      const response = await axios.get(graphApiUrl, {
        params: {
          fields,
          access_token: pageToken,
          limit: mediaLimit
        },
        timeout: 10000 // 10 second timeout
      });

      const responseTime = Date.now() - requestStartTime;

      // Log successful API call
      await logAudit('instagram_media_fetched', userId, {
        action: 'fetch_media',
        business_account_id: businessAccountId,
        media_count: response.data.data?.length || 0,
        response_time_ms: responseTime
      });

      // ===== SUCCESS RESPONSE =====
      res.json({
        success: true,
        data: response.data.data || [],
        paging: response.data.paging || {},
        rate_limit: {
          remaining: req.rateLimitRemaining || 'unknown',
          limit: 200,
          window: '1 hour'
        },
        meta: {
          count: response.data.data?.length || 0,
          response_time_ms: responseTime
        }
      });

    } catch (apiError) {
      // Handle Graph API errors specifically
      if (apiError.response) {
        const { status, data } = apiError.response;
        console.error(`❌ Graph API error (${status}):`, data);

        // Log specific error types
        await logAudit('instagram_api_error', userId, {
          action: 'fetch_media',
          business_account_id: businessAccountId,
          status_code: status,
          error_type: data.error?.type,
          error_message: data.error?.message
        });

        // Handle specific error codes
        if (status === 429) {
          return res.status(429).json({
            success: false,
            error: 'Rate limit exceeded. Please try again later.',
            code: 'RATE_LIMIT_EXCEEDED',
            retry_after: apiError.response.headers['retry-after'] || 3600
          });
        }

        if (status === 401 || status === 403) {
          return res.status(401).json({
            success: false,
            error: 'Instagram access token expired or revoked. Please reconnect your account.',
            code: 'TOKEN_INVALID'
          });
        }

        return res.status(status).json({
          success: false,
          error: data.error?.message || 'Instagram API error',
          code: data.error?.code || 'GRAPH_API_ERROR',
          details: data.error
        });
      }

      throw apiError; // Re-throw for general error handler
    }

  } catch (error) {
    const responseTime = Date.now() - requestStartTime;

    console.error('❌ Media fetch error:', error.message);

    // Log unexpected errors
    await logAudit('media_fetch_error', req.query.userId, {
      action: 'fetch_media',
      error: error.message,
      response_time_ms: responseTime
    });

    res.status(500).json({
      success: false,
      error: 'Failed to fetch Instagram media',
      code: 'INTERNAL_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/instagram/profile/:id
 * Fetches Instagram Business profile data
 *
 * Query Parameters:
 *   - userId: UUID of authenticated user
 *   - businessAccountId: Instagram business account UUID
 *
 * Returns: Profile data including username, followers, media count
 */
router.get('/profile/:id', async (req, res) => {
  const requestStartTime = Date.now();

  try {
    const { id } = req.params;
    const { userId, businessAccountId } = req.query;

    console.log(`👤 Fetching profile for IG account: ${id}`);

    // ===== VALIDATION =====
    if (!userId || !businessAccountId) {
      console.error('❌ Missing required query parameters for profile fetch');
      return res.status(400).json({
        success: false,
        error: 'userId and businessAccountId are required',
        code: 'MISSING_PARAMETERS'
      });
    }

    // ===== TOKEN RETRIEVAL =====
    let pageToken;
    try {
      pageToken = await retrievePageToken(userId, businessAccountId);
    } catch (tokenError) {
      console.error('❌ Token retrieval failed:', tokenError.message);

      await logAudit('token_retrieval_failed', userId, {
        action: 'fetch_profile',
        business_account_id: businessAccountId,
        error: tokenError.message
      });

      return res.status(401).json({
        success: false,
        error: 'Authentication failed. Please reconnect your Instagram account.',
        code: 'TOKEN_RETRIEVAL_FAILED'
      });
    }

    // ===== GRAPH API CALL =====
    const fields = 'id,username,name,profile_picture_url,followers_count,follows_count,media_count,biography,website';
    const graphApiUrl = `https://graph.facebook.com/v23.0/${id}`;

    try {
      const response = await axios.get(graphApiUrl, {
        params: {
          fields,
          access_token: pageToken
        },
        timeout: 10000
      });

      const responseTime = Date.now() - requestStartTime;

      await logAudit('instagram_profile_fetched', userId, {
        action: 'fetch_profile',
        business_account_id: businessAccountId,
        username: response.data.username,
        response_time_ms: responseTime
      });

      // ===== SUCCESS RESPONSE =====
      res.json({
        success: true,
        data: response.data,
        rate_limit: {
          remaining: req.rateLimitRemaining || 'unknown',
          limit: 200,
          window: '1 hour'
        },
        meta: {
          response_time_ms: responseTime
        }
      });

    } catch (apiError) {
      if (apiError.response) {
        const { status, data } = apiError.response;
        console.error(`❌ Graph API error (${status}):`, data);

        await logAudit('instagram_api_error', userId, {
          action: 'fetch_profile',
          business_account_id: businessAccountId,
          status_code: status,
          error_message: data.error?.message
        });

        return res.status(status).json({
          success: false,
          error: data.error?.message || 'Instagram API error',
          code: 'GRAPH_API_ERROR'
        });
      }

      throw apiError;
    }

  } catch (error) {
    const responseTime = Date.now() - requestStartTime;
    console.error('❌ Profile fetch error:', error.message);

    await logAudit('profile_fetch_error', req.query.userId, {
      action: 'fetch_profile',
      error: error.message,
      response_time_ms: responseTime
    });

    res.status(500).json({
      success: false,
      error: 'Failed to fetch Instagram profile',
      code: 'INTERNAL_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/instagram/comments/:mediaId
 * Fetches comments for a specific media item or all comments for account
 *
 * Query Parameters:
 *   - userId: UUID of authenticated user
 *   - businessAccountId: Instagram business account UUID
 *
 * Returns: Array of comments with metadata
 */
router.get('/comments/:mediaId', async (req, res) => {
  const requestStartTime = Date.now();

  try {
    const { mediaId } = req.params;
    const { userId, businessAccountId } = req.query;

    console.log(`💬 Fetching comments for media: ${mediaId}`);

    // ===== VALIDATION =====
    if (!userId || !businessAccountId) {
      console.error('❌ Missing required query parameters for comments fetch');
      return res.status(400).json({
        success: false,
        error: 'userId and businessAccountId are required',
        code: 'MISSING_PARAMETERS'
      });
    }

    // ===== TOKEN RETRIEVAL =====
    let pageToken;
    try {
      pageToken = await retrievePageToken(userId, businessAccountId);
    } catch (tokenError) {
      console.error('❌ Token retrieval failed:', tokenError.message);

      await logAudit('token_retrieval_failed', userId, {
        action: 'fetch_comments',
        business_account_id: businessAccountId,
        error: tokenError.message
      });

      return res.status(401).json({
        success: false,
        error: 'Authentication failed. Please reconnect your Instagram account.',
        code: 'TOKEN_RETRIEVAL_FAILED'
      });
    }

    // ===== GRAPH API CALL =====
    const fields = 'id,text,username,timestamp,like_count,replies{id,text,username,timestamp}';
    const graphApiUrl = `https://graph.facebook.com/v23.0/${mediaId}/comments`;

    try {
      const response = await axios.get(graphApiUrl, {
        params: {
          fields,
          access_token: pageToken
        },
        timeout: 10000
      });

      const responseTime = Date.now() - requestStartTime;

      await logAudit('instagram_comments_fetched', userId, {
        action: 'fetch_comments',
        business_account_id: businessAccountId,
        media_id: mediaId,
        comment_count: response.data.data?.length || 0,
        response_time_ms: responseTime
      });

      // ===== SUCCESS RESPONSE =====
      res.json({
        success: true,
        data: response.data.data || [],
        paging: response.data.paging || {},
        rate_limit: {
          remaining: req.rateLimitRemaining || 'unknown',
          limit: 200,
          window: '1 hour'
        },
        meta: {
          count: response.data.data?.length || 0,
          response_time_ms: responseTime
        }
      });

    } catch (apiError) {
      if (apiError.response) {
        const { status, data } = apiError.response;
        console.error(`❌ Graph API error (${status}):`, data);

        await logAudit('instagram_api_error', userId, {
          action: 'fetch_comments',
          business_account_id: businessAccountId,
          status_code: status,
          error_message: data.error?.message
        });

        return res.status(status).json({
          success: false,
          error: data.error?.message || 'Instagram API error',
          code: 'GRAPH_API_ERROR'
        });
      }

      throw apiError;
    }

  } catch (error) {
    const responseTime = Date.now() - requestStartTime;
    console.error('❌ Comments fetch error:', error.message);

    await logAudit('comments_fetch_error', req.query.userId, {
      action: 'fetch_comments',
      error: error.message,
      response_time_ms: responseTime
    });

    res.status(500).json({
      success: false,
      error: 'Failed to fetch comments',
      code: 'INTERNAL_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/instagram/comments/:commentId/reply
 * Reply to a specific comment
 *
 * Query Parameters:
 *   - userId: UUID of authenticated user
 *   - businessAccountId: Instagram business account UUID
 *
 * Body:
 *   - message: Reply text (max 2200 characters)
 *
 * Returns: Reply ID and success status
 */
router.post('/comments/:commentId/reply', async (req, res) => {
  const requestStartTime = Date.now();

  try {
    const { commentId } = req.params;
    const { userId, businessAccountId } = req.query;
    const { message } = req.body;

    console.log(`💬 Replying to comment: ${commentId}`);

    // ===== VALIDATION =====
    if (!userId || !businessAccountId) {
      return res.status(400).json({
        success: false,
        error: 'userId and businessAccountId are required',
        code: 'MISSING_PARAMETERS'
      });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Message is required',
        code: 'MISSING_MESSAGE'
      });
    }

    if (message.length > 2200) {
      return res.status(400).json({
        success: false,
        error: 'Message exceeds 2200 character limit',
        code: 'MESSAGE_TOO_LONG'
      });
    }

    // ===== TOKEN RETRIEVAL =====
    let pageToken;
    try {
      pageToken = await retrievePageToken(userId, businessAccountId);
    } catch (tokenError) {
      console.error('❌ Token retrieval failed:', tokenError.message);

      await logAudit('token_retrieval_failed', userId, {
        action: 'reply_to_comment',
        business_account_id: businessAccountId,
        error: tokenError.message
      });

      return res.status(401).json({
        success: false,
        error: 'Authentication failed. Please reconnect your Instagram account.',
        code: 'TOKEN_RETRIEVAL_FAILED'
      });
    }

    // ===== GRAPH API CALL =====
    const graphApiUrl = `https://graph.facebook.com/v23.0/${commentId}/replies`;

    try {
      const response = await axios.post(graphApiUrl, null, {
        params: {
          message: message.trim(),
          access_token: pageToken
        },
        timeout: 10000
      });

      const responseTime = Date.now() - requestStartTime;

      await logAudit('comment_reply_sent', userId, {
        action: 'reply_to_comment',
        business_account_id: businessAccountId,
        comment_id: commentId,
        reply_id: response.data.id,
        response_time_ms: responseTime
      });

      // ===== SUCCESS RESPONSE =====
      res.json({
        success: true,
        data: {
          replyId: response.data.id
        },
        message: 'Reply sent successfully',
        rate_limit: {
          remaining: req.rateLimitRemaining || 'unknown',
          limit: 200,
          window: '1 hour'
        },
        meta: {
          response_time_ms: responseTime
        }
      });

    } catch (apiError) {
      if (apiError.response) {
        const { status, data } = apiError.response;
        console.error(`❌ Graph API error (${status}):`, data);

        await logAudit('instagram_api_error', userId, {
          action: 'reply_to_comment',
          business_account_id: businessAccountId,
          status_code: status,
          error_message: data.error?.message
        });

        return res.status(status).json({
          success: false,
          error: data.error?.message || 'Failed to send reply',
          code: 'GRAPH_API_ERROR'
        });
      }

      throw apiError;
    }

  } catch (error) {
    const responseTime = Date.now() - requestStartTime;
    console.error('❌ Reply send error:', error.message);

    await logAudit('reply_send_error', req.query.userId, {
      action: 'reply_to_comment',
      error: error.message,
      response_time_ms: responseTime
    });

    res.status(500).json({
      success: false,
      error: 'Failed to send reply',
      code: 'INTERNAL_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/instagram/create-post
 * Creates and publishes a new Instagram post (2-step flow)
 *
 * Body:
 *   - userId: UUID of authenticated user
 *   - businessAccountId: Instagram business account ID
 *   - caption: Post caption (max 2200 characters)
 *   - image_url: Publicly accessible HTTPS image URL
 *
 * Returns: media_id and creation_id of published post
 */
/**
 * POST /api/instagram/create-post
 * Creates a draft OR publishes a post to Instagram
 *
 * NEW BEHAVIOR (v5.2):
 * - If status === 'draft': Save to instagram_media table only (no Instagram API calls)
 * - If status === 'publish': Execute existing 2-step publish flow + save to instagram_media
 *
 * Body:
 *   - userId: UUID of authenticated user
 *   - businessAccountId: Instagram business account ID
 *   - caption: Post caption (max 2200 characters)
 *   - image_url: Publicly accessible HTTPS image URL
 *   - status: 'draft' | 'publish' (default: 'draft')
 */
router.post('/create-post', async (req, res) => {
  const requestStartTime = Date.now();

  try {
    const {
      userId,
      businessAccountId,
      caption,
      image_url,
      status = 'draft' // ✅ NEW: Default to draft for safety
    } = req.body;

    // ===== VALIDATION =====
    if (!userId || !businessAccountId || !caption || !image_url) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, businessAccountId, caption, image_url',
        code: 'MISSING_FIELDS'
      });
    }

    // Validate status parameter
    if (!['draft', 'publish'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'status must be either "draft" or "publish"',
        code: 'INVALID_STATUS'
      });
    }

    // Validate caption length (Instagram limit: 2200 characters)
    if (caption.length > 2200) {
      return res.status(400).json({
        success: false,
        error: 'Caption exceeds maximum length of 2200 characters',
        code: 'CAPTION_TOO_LONG'
      });
    }

    // Validate image URL
    const urlValidation = validateImageUrl(image_url);
    if (!urlValidation.valid) {
      return res.status(400).json({
        success: false,
        error: urlValidation.error,
        code: 'INVALID_IMAGE_URL'
      });
    }

    // ===== BRANCH 1: SAVE AS DRAFT (No Instagram API calls) =====
    if (status === 'draft') {
      console.log('💾 Saving post as draft (not publishing to Instagram)...');

      const { data: draftRecord, error: draftError } = await supabase
        .from('instagram_media')
        .insert({
          business_account_id: businessAccountId,
          caption,
          media_url: image_url,
          status: 'draft',  // ✅ Set draft status
          media_type: 'IMAGE',
          instagram_media_id: `draft_${Date.now()}`, // Temporary ID
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (draftError) {
        console.error('❌ Draft save failed:', draftError);
        return res.status(500).json({
          success: false,
          error: 'Failed to save draft',
          code: 'DRAFT_SAVE_FAILED',
          details: draftError.message
        });
      }

      await logAudit('instagram_draft_saved', userId, {
        action: 'save_draft',
        business_account_id: businessAccountId,
        draft_id: draftRecord.id,
        caption_length: caption.length
      });

      return res.json({
        success: true,
        message: 'Post saved as draft',
        data: {
          draft_id: draftRecord.id,
          status: 'draft',
          can_publish: true
        },
        meta: {
          response_time_ms: Date.now() - requestStartTime
        }
      });
    }

    // ===== BRANCH 2: PUBLISH TO INSTAGRAM (Existing flow) =====
    console.log('🚀 Publishing post to Instagram (2-step flow)...');

    // Get page token
    let pageToken;
    try {
      pageToken = await retrievePageToken(userId, businessAccountId);
    } catch (tokenError) {
      console.error('❌ Token retrieval failed:', tokenError.message);

      await logAudit('token_retrieval_failed', userId, {
        action: 'create_post',
        business_account_id: businessAccountId,
        error: tokenError.message
      });

      return res.status(401).json({
        success: false,
        error: 'Authentication failed. Please reconnect your Instagram account.',
        code: 'TOKEN_RETRIEVAL_FAILED'
      });
    }

    const igUserId = businessAccountId;

    // ===== STEP 1: Create Media Container =====
    console.log('   Step 1: Creating media container...');
    let creationId;

    try {
      const containerUrl = `https://graph.facebook.com/v23.0/${igUserId}/media`;
      const containerResponse = await axios.post(containerUrl, null, {
        params: {
          image_url: image_url,
          caption: caption,
          access_token: pageToken
        },
        timeout: 15000 // 15 second timeout for image processing
      });

      creationId = containerResponse.data.id;
      console.log(`   ✅ Step 1 Success: creation_id = ${creationId}`);

      await logAudit('instagram_container_created', userId, {
        action: 'create_post_step_1',
        business_account_id: businessAccountId,
        creation_id: creationId
      });

    } catch (containerError) {
      console.error('❌ Container creation failed:', containerError.response?.data || containerError.message);

      await logAudit('instagram_container_error', userId, {
        action: 'create_post_step_1',
        business_account_id: businessAccountId,
        error: containerError.response?.data?.error?.message || containerError.message
      });

      if (containerError.response) {
        const { status, data } = containerError.response;
        return res.status(status).json({
          success: false,
          error: data.error?.message || 'Failed to create media container',
          code: 'CONTAINER_CREATION_FAILED',
          details: data.error
        });
      }

      throw containerError;
    }

    // ===== STEP 2: Publish Media Container =====
    console.log('   Step 2: Publishing container...');
    let mediaId;

    try {
      const publishUrl = `https://graph.facebook.com/v23.0/${igUserId}/media_publish`;
      const publishResponse = await axios.post(publishUrl, null, {
        params: {
          creation_id: creationId,
          access_token: pageToken
        },
        timeout: 15000
      });

      mediaId = publishResponse.data.id;
      console.log(`   ✅ Step 2 Success: Post is live! media_id = ${mediaId}`);

      // STEP 3: Store in database with 'published' status
      const { data: publishedRecord, error: dbError } = await supabase
        .from('instagram_media')
        .insert({
          business_account_id: businessAccountId,
          instagram_media_id: mediaId,
          caption,
          media_url: image_url,
          status: 'published',  // ✅ Published status
          media_type: 'IMAGE',
          published_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (dbError) {
        console.warn('⚠️  Post published to Instagram but failed to save to database:', dbError);
      }

      const responseTime = Date.now() - requestStartTime;

      await logAudit('instagram_post_published', userId, {
        action: 'publish_post',
        business_account_id: businessAccountId,
        media_id: mediaId,
        creation_id: creationId,
        response_time_ms: responseTime,
        caption_length: caption.length
      });

    } catch (publishError) {
      console.error('❌ Publishing failed:', publishError.response?.data || publishError.message);

      await logAudit('instagram_publish_error', userId, {
        action: 'create_post_step_2',
        business_account_id: businessAccountId,
        creation_id: creationId,
        error: publishError.response?.data?.error?.message || publishError.message
      });

      if (publishError.response) {
        const { status, data } = publishError.response;
        return res.status(status).json({
          success: false,
          error: data.error?.message || 'Failed to publish post',
          code: 'PUBLISH_FAILED',
          details: data.error,
          partial_success: {
            creation_id: creationId,
            status: 'Container created but not published'
          }
        });
      }

      throw publishError;
    }

    // ===== SUCCESS RESPONSE =====
    const totalTime = Date.now() - requestStartTime;

    res.json({
      success: true,
      message: 'Post published successfully!',
      data: {
        media_id: mediaId,
        creation_id: creationId,
        status: 'published',
        permalink: `https://www.instagram.com/p/${mediaId}/`
      },
      rate_limit: {
        remaining: req.rateLimitRemaining || 'unknown',
        limit: 200,
        window: '1 hour'
      },
      meta: {
        response_time_ms: totalTime
      }
    });

  } catch (error) {
    const responseTime = Date.now() - requestStartTime;

    console.error('❌ Post creation error:', error.message);

    await logAudit('post_creation_error', req.body.userId, {
      action: 'create_post',
      error: error.message,
      response_time_ms: responseTime
    });

    res.status(500).json({
      success: false,
      error: 'Failed to publish post.',
      code: 'INTERNAL_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Health check endpoint (no rate limiting)
 *
 * @route GET /api/instagram/health
 * @returns {Object} Health status
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'operational',
    service: 'Instagram API Proxy',
    rate_limiting: 'enabled',
    timestamp: new Date().toISOString()
  });
});

// ==========================================
// UGC MANAGEMENT ENDPOINTS
// ==========================================
// Permission Required: pages_read_user_content
// Purpose: Monitor visitor posts (brand mentions) and manage permissions

/**
 * GET /api/instagram/visitor-posts
 * Fetches visitor posts (UGC) for the business account
 *
 * Query Parameters:
 *   - businessAccountId: Instagram business account UUID (required)
 *   - limit: Number of posts to fetch (default: 20, max: 100)
 *   - after: Pagination cursor (optional)
 *
 * Returns: Array of visitor posts with stats
 */
router.get('/visitor-posts', async (req, res) => {
  const requestStartTime = Date.now();

  try {
    const { businessAccountId, limit = 20, after } = req.query;

    console.log('[UGC] Fetching visitor posts for account:', businessAccountId);

    // ===== VALIDATION =====
    if (!businessAccountId) {
      console.error('❌ Missing businessAccountId parameter');
      return res.status(400).json({
        success: false,
        error: 'businessAccountId is required',
        code: 'MISSING_PARAMETERS'
      });
    }

    // Validate limit parameter
    const postsLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);

    // ===== STEP 1: Get credentials from database =====
    const { data: credentials, error: credError } = await supabase
      .from('instagram_credentials')
      .select('page_access_token, facebook_page_id')
      .eq('business_account_id', businessAccountId)
      .single();

    if (credError || !credentials) {
      console.error('[UGC] Credentials not found:', credError?.message);
      return res.status(404).json({
        success: false,
        error: 'Credentials not found for this business account',
        code: 'CREDENTIALS_NOT_FOUND'
      });
    }

    // ===== STEP 2: Call Meta Graph API =====
    const pageId = credentials.facebook_page_id;
    const accessToken = credentials.page_access_token;

    const metaUrl = new URL(`https://graph.facebook.com/v20.0/${pageId}/visitor_posts`);
    metaUrl.searchParams.append('access_token', accessToken);
    metaUrl.searchParams.append('fields', 'id,message,from,created_time,permalink_url,attachments,likes.summary(true),comments.summary(true)');
    metaUrl.searchParams.append('limit', postsLimit.toString());
    if (after) {
      metaUrl.searchParams.append('after', after);
    }

    const metaResponse = await fetch(metaUrl.toString());

    if (!metaResponse.ok) {
      const errorData = await metaResponse.json();
      console.error('[UGC] Meta API error:', errorData);

      await logAudit('instagram_visitor_posts_error', null, {
        action: 'fetch_visitor_posts',
        business_account_id: businessAccountId,
        status_code: metaResponse.status,
        error: errorData.error?.message
      });

      return res.status(metaResponse.status).json({
        success: false,
        error: errorData.error?.message || 'Failed to fetch visitor posts',
        code: 'META_API_ERROR'
      });
    }

    const metaData = await metaResponse.json();

    // ===== STEP 3: Transform and store in database =====
    const visitorPosts = await Promise.all(
      (metaData.data || []).map(async (post) => {
        // Extract media info
        let mediaType = 'TEXT';
        let mediaUrl = null;
        let thumbnailUrl = null;

        if (post.attachments?.data?.[0]) {
          const attachment = post.attachments.data[0];
          mediaType = attachment.type === 'photo' ? 'IMAGE' :
                      attachment.type === 'video' ? 'VIDEO' :
                      attachment.type === 'album' ? 'CAROUSEL_ALBUM' : 'TEXT';

          if (attachment.media?.image?.src) {
            mediaUrl = attachment.media.image.src;
            thumbnailUrl = attachment.media.image.src;
          } else if (attachment.media?.source) {
            mediaUrl = attachment.media.source;
          }
        }

        const likeCount = post.likes?.summary?.total_count || 0;
        const commentCount = post.comments?.summary?.total_count || 0;

        // Upsert into database
        const { data: ugcRecord, error: upsertError } = await supabase
          .from('ugc_content')
          .upsert({
            business_account_id: businessAccountId,
            visitor_post_id: post.id,
            message: post.message || null,
            author_id: post.from?.id || 'unknown',
            author_name: post.from?.name || null,
            author_username: post.from?.username || null,
            author_profile_picture_url: post.from?.picture?.data?.url || null,
            created_time: post.created_time,
            permalink_url: post.permalink_url,
            media_type: mediaType,
            media_url: mediaUrl,
            thumbnail_url: thumbnailUrl,
            like_count: likeCount,
            comment_count: commentCount,
            share_count: 0,
            sentiment: 'unknown',
            priority: 'medium',
            fetched_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'business_account_id,visitor_post_id'
          })
          .select()
          .single();

        if (upsertError) {
          console.error('[UGC] Error upserting post:', upsertError);
        }

        return ugcRecord;
      })
    );

    // ===== STEP 4: Calculate stats =====
    const { data: statsData } = await supabase
      .from('ugc_content')
      .select('sentiment, featured, created_time')
      .eq('business_account_id', businessAccountId);

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const stats = {
      totalPosts: statsData?.length || 0,
      postsThisWeek: statsData?.filter(p => {
        return new Date(p.created_time) > weekAgo;
      }).length || 0,
      sentimentBreakdown: {
        positive: statsData?.filter(p => p.sentiment === 'positive').length || 0,
        neutral: statsData?.filter(p => p.sentiment === 'neutral').length || 0,
        negative: statsData?.filter(p => p.sentiment === 'negative').length || 0,
      },
      featuredCount: statsData?.filter(p => p.featured).length || 0,
    };

    const responseTime = Date.now() - requestStartTime;

    await logAudit('instagram_visitor_posts_fetched', null, {
      action: 'fetch_visitor_posts',
      business_account_id: businessAccountId,
      posts_count: visitorPosts.filter(p => p !== null).length,
      response_time_ms: responseTime
    });

    // ===== SUCCESS RESPONSE =====
    res.json({
      success: true,
      data: visitorPosts.filter(p => p !== null),
      paging: metaData.paging || {},
      stats,
      rate_limit: {
        remaining: req.rateLimitRemaining || 'unknown',
        limit: 200,
        window: '1 hour'
      },
      meta: {
        response_time_ms: responseTime
      }
    });

  } catch (error) {
    const responseTime = Date.now() - requestStartTime;
    console.error('[UGC] Error fetching visitor posts:', error);

    await logAudit('visitor_posts_error', null, {
      action: 'fetch_visitor_posts',
      error: error.message,
      response_time_ms: responseTime
    });

    res.status(500).json({
      success: false,
      error: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * PATCH /api/instagram/ugc/:postId/feature
 * Toggle featured status of a visitor post
 *
 * Body:
 *   - featured: boolean (true to feature, false to unfeature)
 *
 * Returns: Updated UGC content record
 */
router.patch('/ugc/:postId/feature', async (req, res) => {
  try {
    const { postId } = req.params;
    const { featured } = req.body;

    console.log(`[UGC] Updating featured status for post ${postId}: ${featured}`);

    // ===== VALIDATION =====
    if (typeof featured !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'featured must be a boolean',
        code: 'INVALID_PARAMETER'
      });
    }

    // ===== UPDATE DATABASE =====
    const { data, error } = await supabase
      .from('ugc_content')
      .update({
        featured,
        featured_at: featured ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', postId)
      .select()
      .single();

    if (error) {
      console.error('[UGC] Error updating featured status:', error);
      return res.status(400).json({
        success: false,
        error: error.message,
        code: 'UPDATE_FAILED'
      });
    }

    await logAudit('ugc_featured_updated', null, {
      action: 'update_featured_status',
      post_id: postId,
      featured
    });

    // ===== SUCCESS RESPONSE =====
    res.json({
      success: true,
      data,
      rate_limit: {
        remaining: req.rateLimitRemaining || 'unknown',
        limit: 200,
        window: '1 hour'
      }
    });

  } catch (error) {
    console.error('[UGC] Error in feature toggle:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/instagram/ugc/request-permission
 * Create a permission request record
 *
 * Body:
 *   - ugcContentId: UUID of UGC content
 *   - requestedVia: 'dm' | 'comment' | 'email' | 'manual'
 *   - requestMessage: Permission request message text
 *   - permissionType: 'one_time' | 'perpetual' | 'campaign_specific'
 *
 * Returns: Created permission request record
 */
router.post('/ugc/request-permission', async (req, res) => {
  try {
    const { ugcContentId, requestedVia, requestMessage, permissionType } = req.body;

    console.log('[UGC] Creating permission request for content:', ugcContentId);

    // ===== VALIDATION =====
    if (!ugcContentId || !requestedVia || !requestMessage || !permissionType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: ugcContentId, requestedVia, requestMessage, permissionType',
        code: 'MISSING_FIELDS'
      });
    }

    // ===== STEP 1: Get the UGC content =====
    const { data: ugcContent, error: ugcError } = await supabase
      .from('ugc_content')
      .select('*')
      .eq('id', ugcContentId)
      .single();

    if (ugcError || !ugcContent) {
      console.error('[UGC] UGC content not found:', ugcError?.message);
      return res.status(404).json({
        success: false,
        error: 'UGC content not found',
        code: 'UGC_NOT_FOUND'
      });
    }

    // ===== STEP 2: Create permission request =====
    const { data: permission, error: permError } = await supabase
      .from('ugc_permissions')
      .insert({
        ugc_content_id: ugcContentId,
        business_account_id: ugcContent.business_account_id,
        requested_via: requestedVia,
        request_message: requestMessage,
        permission_type: permissionType,
        status: 'pending',
        requested_at: new Date().toISOString()
      })
      .select()
      .single();

    if (permError) {
      console.error('[UGC] Error creating permission request:', permError);
      return res.status(400).json({
        success: false,
        error: permError.message,
        code: 'PERMISSION_CREATE_FAILED'
      });
    }

    // ===== STEP 3: Update UGC content flag =====
    await supabase
      .from('ugc_content')
      .update({
        repost_permission_requested: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', ugcContentId);

    await logAudit('ugc_permission_requested', null, {
      action: 'request_permission',
      ugc_content_id: ugcContentId,
      permission_type: permissionType,
      requested_via: requestedVia
    });

    // ===== SUCCESS RESPONSE =====
    res.json({
      success: true,
      permission,
      message: 'Permission request created successfully',
      rate_limit: {
        remaining: req.rateLimitRemaining || 'unknown',
        limit: 200,
        window: '1 hour'
      }
    });

  } catch (error) {
    console.error('[UGC] Error requesting permission:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// ==========================================
// DM CONVERSATION ENDPOINTS
// ==========================================
// Permission Required: instagram_business_manage_messages
// Purpose: Fetch and manage Instagram DM conversations

/**
 * GET /api/instagram/conversations/:id
 * Fetches DM conversations for the Instagram Business account
 *
 * Query Parameters:
 *   - userId: UUID of authenticated user
 *   - businessAccountId: Instagram business account UUID
 *   - limit: Number of conversations to fetch (default: 20, max: 50)
 *
 * Returns: Array of conversations with metadata
 */
router.get('/conversations/:id', async (req, res) => {
  const requestStartTime = Date.now();

  try {
    const { id } = req.params;
    const { userId, businessAccountId, limit = 20 } = req.query;

    console.log(`💬 Fetching conversations for IG account: ${id}`);

    // ===== VALIDATION =====
    if (!userId || !businessAccountId) {
      console.error('❌ Missing required query parameters for conversations fetch');
      return res.status(400).json({
        success: false,
        error: 'userId and businessAccountId are required',
        code: 'MISSING_PARAMETERS'
      });
    }

    const conversationsLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 50);

    // ===== TOKEN RETRIEVAL =====
    let pageToken;
    try {
      pageToken = await retrievePageToken(userId, businessAccountId);
    } catch (tokenError) {
      console.error('❌ Token retrieval failed:', tokenError.message);

      await logAudit('token_retrieval_failed', userId, {
        action: 'fetch_conversations',
        business_account_id: businessAccountId,
        error: tokenError.message
      });

      return res.status(401).json({
        success: false,
        error: 'Authentication failed. Please reconnect your Instagram account.',
        code: 'TOKEN_RETRIEVAL_FAILED'
      });
    }

    // ===== GRAPH API CALL =====
    // Include messages in conversation data to check 24-hour window
    const fields = 'id,participants,updated_time,message_count,messages{created_time,from}';
    const graphApiUrl = `https://graph.facebook.com/v23.0/${id}/conversations`;

    try {
      const response = await axios.get(graphApiUrl, {
        params: {
          fields,
          access_token: pageToken,
          limit: conversationsLimit,
          platform: 'instagram'
        },
        timeout: 10000
      });

      const responseTime = Date.now() - requestStartTime;

      await logAudit('instagram_conversations_fetched', userId, {
        action: 'fetch_conversations',
        business_account_id: businessAccountId,
        conversation_count: response.data.data?.length || 0,
        response_time_ms: responseTime
      });

      // Transform conversations with 24-hour window calculation
      const conversations = (response.data.data || []).map(conv => {
        const lastMessage = conv.messages?.data?.[0];
        const lastMessageTime = lastMessage ? new Date(lastMessage.created_time) : null;
        const now = new Date();

        // Calculate hours since last message
        const hoursSinceLastMessage = lastMessageTime
          ? (now - lastMessageTime) / (1000 * 60 * 60)
          : null;

        // 24-hour window status
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
          // ✅ 24-hour window calculation (Instagram Platform Policy 4.2)
          messaging_window: {
            is_open: isWithin24Hours,
            hours_remaining: hoursRemaining !== null ? parseFloat(hoursRemaining.toFixed(1)) : null,
            minutes_remaining: hoursRemaining !== null ? Math.floor((hoursRemaining % 1) * 60) : null,
            requires_template: hoursSinceLastMessage !== null && hoursSinceLastMessage >= 24,
            last_customer_message_at: lastMessageTime ? lastMessageTime.toISOString() : null
          },
          // Deprecated fields (kept for backward compatibility)
          within_window: isWithin24Hours,
          can_send_messages: isWithin24Hours
        };
      });

      // ===== SUCCESS RESPONSE =====
      res.json({
        success: true,
        data: conversations,
        paging: response.data.paging || {},
        rate_limit: {
          remaining: req.rateLimitRemaining || 'unknown',
          limit: 200,
          window: '1 hour'
        },
        meta: {
          count: conversations.length,
          response_time_ms: responseTime
        }
      });

    } catch (apiError) {
      if (apiError.response) {
        const { status, data } = apiError.response;
        console.error(`❌ Graph API error (${status}):`, data);

        await logAudit('instagram_api_error', userId, {
          action: 'fetch_conversations',
          business_account_id: businessAccountId,
          status_code: status,
          error_message: data.error?.message
        });

        return res.status(status).json({
          success: false,
          error: data.error?.message || 'Instagram API error',
          code: 'GRAPH_API_ERROR'
        });
      }

      throw apiError;
    }

  } catch (error) {
    const responseTime = Date.now() - requestStartTime;
    console.error('❌ Conversations fetch error:', error.message);

    await logAudit('conversations_fetch_error', req.query.userId, {
      action: 'fetch_conversations',
      error: error.message,
      response_time_ms: responseTime
    });

    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversations',
      code: 'INTERNAL_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/instagram/conversations/:conversationId/messages
 * Fetches messages for a specific conversation
 *
 * Query Parameters:
 *   - userId: UUID of authenticated user
 *   - businessAccountId: Instagram business account UUID
 *   - limit: Number of messages to fetch (default: 20, max: 100)
 *
 * Returns: Array of messages in the conversation
 */
router.get('/conversations/:conversationId/messages', async (req, res) => {
  const requestStartTime = Date.now();

  try {
    const { conversationId } = req.params;
    const { userId, businessAccountId, limit = 20 } = req.query;

    console.log(`💬 Fetching messages for conversation: ${conversationId}`);

    // ===== VALIDATION =====
    if (!userId || !businessAccountId) {
      console.error('❌ Missing required query parameters for messages fetch');
      return res.status(400).json({
        success: false,
        error: 'userId and businessAccountId are required',
        code: 'MISSING_PARAMETERS'
      });
    }

    const messagesLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);

    // ===== TOKEN RETRIEVAL =====
    let pageToken;
    try {
      pageToken = await retrievePageToken(userId, businessAccountId);
    } catch (tokenError) {
      console.error('❌ Token retrieval failed:', tokenError.message);

      await logAudit('token_retrieval_failed', userId, {
        action: 'fetch_messages',
        business_account_id: businessAccountId,
        error: tokenError.message
      });

      return res.status(401).json({
        success: false,
        error: 'Authentication failed. Please reconnect your Instagram account.',
        code: 'TOKEN_RETRIEVAL_FAILED'
      });
    }

    // ===== GRAPH API CALL =====
    const fields = 'id,message,from,created_time,attachments';
    const graphApiUrl = `https://graph.facebook.com/v23.0/${conversationId}/messages`;

    try {
      const response = await axios.get(graphApiUrl, {
        params: {
          fields,
          access_token: pageToken,
          limit: messagesLimit
        },
        timeout: 10000
      });

      const responseTime = Date.now() - requestStartTime;

      await logAudit('instagram_messages_fetched', userId, {
        action: 'fetch_messages',
        business_account_id: businessAccountId,
        conversation_id: conversationId,
        message_count: response.data.data?.length || 0,
        response_time_ms: responseTime
      });

      // ===== SUCCESS RESPONSE =====
      res.json({
        success: true,
        data: response.data.data || [],
        paging: response.data.paging || {},
        rate_limit: {
          remaining: req.rateLimitRemaining || 'unknown',
          limit: 200,
          window: '1 hour'
        },
        meta: {
          count: response.data.data?.length || 0,
          response_time_ms: responseTime
        }
      });

    } catch (apiError) {
      if (apiError.response) {
        const { status, data } = apiError.response;
        console.error(`❌ Graph API error (${status}):`, data);

        await logAudit('instagram_api_error', userId, {
          action: 'fetch_messages',
          business_account_id: businessAccountId,
          status_code: status,
          error_message: data.error?.message
        });

        return res.status(status).json({
          success: false,
          error: data.error?.message || 'Instagram API error',
          code: 'GRAPH_API_ERROR'
        });
      }

      throw apiError;
    }

  } catch (error) {
    const responseTime = Date.now() - requestStartTime;
    console.error('❌ Messages fetch error:', error.message);

    await logAudit('messages_fetch_error', req.query.userId, {
      action: 'fetch_messages',
      error: error.message,
      response_time_ms: responseTime
    });

    res.status(500).json({
      success: false,
      error: 'Failed to fetch messages',
      code: 'INTERNAL_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/instagram/conversations/:conversationId/send
 * Send a message in a conversation
 *
 * Query Parameters:
 *   - userId: UUID of authenticated user
 *   - businessAccountId: Instagram business account UUID
 *
 * Body:
 *   - message: Message text to send
 *
 * Returns: Sent message ID and success status
 */
router.post('/conversations/:conversationId/send', async (req, res) => {
  const requestStartTime = Date.now();

  try {
    const { conversationId } = req.params;
    const { userId, businessAccountId } = req.query;
    const { message } = req.body;

    console.log(`💬 Sending message to conversation: ${conversationId}`);

    // ===== VALIDATION =====
    if (!userId || !businessAccountId) {
      return res.status(400).json({
        success: false,
        error: 'userId and businessAccountId are required',
        code: 'MISSING_PARAMETERS'
      });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Message is required',
        code: 'MISSING_MESSAGE'
      });
    }

    // ===== TOKEN RETRIEVAL =====
    let pageToken;
    try {
      pageToken = await retrievePageToken(userId, businessAccountId);
    } catch (tokenError) {
      console.error('❌ Token retrieval failed:', tokenError.message);

      await logAudit('token_retrieval_failed', userId, {
        action: 'send_message',
        business_account_id: businessAccountId,
        error: tokenError.message
      });

      return res.status(401).json({
        success: false,
        error: 'Authentication failed. Please reconnect your Instagram account.',
        code: 'TOKEN_RETRIEVAL_FAILED'
      });
    }

    // ===== GRAPH API CALL =====
    const graphApiUrl = `https://graph.facebook.com/v23.0/${conversationId}/messages`;

    try {
      const response = await axios.post(graphApiUrl, null, {
        params: {
          message: message.trim(),
          access_token: pageToken
        },
        timeout: 10000
      });

      const responseTime = Date.now() - requestStartTime;

      await logAudit('instagram_message_sent', userId, {
        action: 'send_message',
        business_account_id: businessAccountId,
        conversation_id: conversationId,
        message_id: response.data.id,
        response_time_ms: responseTime
      });

      // ===== SUCCESS RESPONSE =====
      res.json({
        success: true,
        data: {
          messageId: response.data.id
        },
        message: 'Message sent successfully',
        rate_limit: {
          remaining: req.rateLimitRemaining || 'unknown',
          limit: 200,
          window: '1 hour'
        },
        meta: {
          response_time_ms: responseTime
        }
      });

    } catch (apiError) {
      if (apiError.response) {
        const { status, data } = apiError.response;
        console.error(`❌ Graph API error (${status}):`, data);

        await logAudit('instagram_api_error', userId, {
          action: 'send_message',
          business_account_id: businessAccountId,
          status_code: status,
          error_message: data.error?.message
        });

        return res.status(status).json({
          success: false,
          error: data.error?.message || 'Failed to send message',
          code: 'GRAPH_API_ERROR'
        });
      }

      throw apiError;
    }

  } catch (error) {
    const responseTime = Date.now() - requestStartTime;
    console.error('❌ Message send error:', error.message);

    await logAudit('message_send_error', req.query.userId, {
      action: 'send_message',
      error: error.message,
      response_time_ms: responseTime
    });

    res.status(500).json({
      success: false,
      error: 'Failed to send message',
      code: 'INTERNAL_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ==========================================
// UGC REPOST ENDPOINT
// ==========================================

/**
 * POST /api/instagram/ugc/repost
 * Repost user-generated content to business Instagram account
 *
 * CRITICAL SECURITY:
 * - Enforces permission_granted === true check
 * - Validates media URL is publicly accessible (not temporary token URL)
 * - Adds credit caption to original creator
 * - Updates audit trail with repost timestamps
 *
 * Meta Compliance: Instagram Platform Policy 4.2 - UGC Rights Management
 * Demonstrates "Human Oversight" for App Review
 *
 * Query Parameters:
 *   - userId: UUID of authenticated user
 *   - businessAccountId: Instagram business account UUID
 *
 * Body:
 *   - ugcContentId: UUID of ugc_content record to repost
 *
 * Returns: Reposted media ID, permalink, and audit data
 */
router.post('/ugc/repost', async (req, res) => {
  const requestStartTime = Date.now();

  try {
    const { userId, businessAccountId, ugcContentId } = req.body;

    console.log(`🔄 [UGC Repost] Request initiated for content: ${ugcContentId}`);

    // ===== VALIDATION: Required Fields =====
    if (!userId || !businessAccountId || !ugcContentId) {
      console.error('❌ [UGC Repost] Missing required fields');
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, businessAccountId, ugcContentId',
        code: 'MISSING_FIELDS'
      });
    }

    // ===== STEP 1: Fetch UGC Content from Database =====
    console.log(`📋 [UGC Repost] Fetching UGC content from database...`);

    const { data: ugcContent, error: ugcError } = await supabase
      .from('ugc_content')
      .select('*')
      .eq('id', ugcContentId)
      .single();

    if (ugcError || !ugcContent) {
      console.error('❌ [UGC Repost] Content not found:', ugcError?.message);

      await logAudit('ugc_repost_failed', userId, {
        action: 'repost_ugc',
        ugc_content_id: ugcContentId,
        error: 'content_not_found'
      });

      return res.status(404).json({
        success: false,
        error: 'UGC content not found in database',
        code: 'CONTENT_NOT_FOUND'
      });
    }

    console.log(`✅ [UGC Repost] Content found: @${ugcContent.author_username}`);

    // ===== STEP 2: CRITICAL PERMISSION CHECK =====
    // SECURITY: This check prevents unauthorized reposting
    // The frontend is NOT trusted - backend independently verifies permission
    if (ugcContent.repost_permission_granted !== true) {
      console.error(`🚫 [UGC Repost] PERMISSION DENIED`);
      console.error(`   - Permission Requested: ${ugcContent.repost_permission_requested}`);
      console.error(`   - Permission Granted: ${ugcContent.repost_permission_granted}`);

      await logAudit('ugc_repost_permission_denied', userId, {
        action: 'repost_ugc',
        ugc_content_id: ugcContentId,
        author: ugcContent.author_username,
        permission_requested: ugcContent.repost_permission_requested,
        permission_granted: ugcContent.repost_permission_granted,
        reason: 'permission_not_granted'
      });

      return res.status(403).json({
        success: false,
        error: 'Cannot repost: Permission not granted by content creator',
        code: 'PERMISSION_DENIED',
        details: {
          permission_requested: ugcContent.repost_permission_requested,
          permission_granted: ugcContent.repost_permission_granted,
          message: 'The content creator must explicitly grant permission before reposting'
        }
      });
    }

    console.log(`✅ [UGC Repost] Permission check passed`);

    // ===== STEP 3: Validate Media URL =====
    // CRITICAL: Ensure URL is publicly accessible, not a temporary token URL
    const mediaUrl = ugcContent.media_url;

    if (!mediaUrl) {
      console.error('❌ [UGC Repost] No media URL found');
      return res.status(400).json({
        success: false,
        error: 'UGC content has no media URL',
        code: 'MISSING_MEDIA_URL'
      });
    }

    // Check if URL is publicly accessible (not a temporary token URL)
    // Temporary URLs often contain tokens like ?access_token= or expire parameters
    if (mediaUrl.includes('?ig_cache_key=') || mediaUrl.includes('?access_token=') || mediaUrl.includes('&oh=') || mediaUrl.includes('&oe=')) {
      console.warn(`⚠️  [UGC Repost] Media URL appears to be temporary/signed`);
      console.warn(`   URL: ${mediaUrl.substring(0, 100)}...`);

      // Still allow, but log warning
      // Instagram CDN URLs with oh= and oe= parameters are stable
    }

    // Validate URL format
    if (!mediaUrl.startsWith('http://') && !mediaUrl.startsWith('https://')) {
      console.error('❌ [UGC Repost] Invalid media URL format');
      return res.status(400).json({
        success: false,
        error: 'Invalid media URL format (must be HTTP/HTTPS)',
        code: 'INVALID_MEDIA_URL'
      });
    }

    console.log(`✅ [UGC Repost] Media URL validated: ${mediaUrl.substring(0, 50)}...`);

    // ===== STEP 4: Check if Already Reposted =====
    if (ugcContent.reposted_at && ugcContent.reposted_media_id) {
      console.warn(`⚠️  [UGC Repost] Content already reposted on ${ugcContent.reposted_at}`);
      console.warn(`   Media ID: ${ugcContent.reposted_media_id}`);

      // Allow re-reposting, but log it
      await logAudit('ugc_repost_duplicate', userId, {
        action: 'repost_ugc',
        ugc_content_id: ugcContentId,
        previous_repost_at: ugcContent.reposted_at,
        previous_media_id: ugcContent.reposted_media_id
      });
    }

    // ===== STEP 5: Retrieve Access Token =====
    console.log(`🔑 [UGC Repost] Retrieving access token...`);

    let pageToken;
    try {
      pageToken = await retrievePageToken(userId, businessAccountId);
      console.log(`✅ [UGC Repost] Access token retrieved`);
    } catch (tokenError) {
      console.error('❌ [UGC Repost] Token retrieval failed:', tokenError.message);

      await logAudit('ugc_repost_token_failed', userId, {
        action: 'repost_ugc',
        business_account_id: businessAccountId,
        error: tokenError.message
      });

      return res.status(401).json({
        success: false,
        error: 'Authentication failed. Please reconnect your Instagram account.',
        code: 'TOKEN_RETRIEVAL_FAILED'
      });
    }

    // ===== STEP 6: Create Credit Caption =====
    const originalCaption = ugcContent.message || '';
    const authorUsername = ugcContent.author_username || 'creator';

    // Build credit caption with original content + attribution
    const creditCaption = originalCaption
      ? `${originalCaption}\n\n📸 Credit: @${authorUsername}\n\n#UGC #UserGeneratedContent`
      : `📸 Credit: @${authorUsername}\n\n#UGC #UserGeneratedContent`;

    console.log(`📝 [UGC Repost] Credit caption created (${creditCaption.length} chars)`);

    // ===== STEP 7: Repost to Instagram (2-Step Flow) =====
    const igUserId = businessAccountId;

    // Step 7a: Create Media Container
    console.log(`📦 [UGC Repost] Step 1/2: Creating media container...`);

    let creationId;
    try {
      const containerUrl = `https://graph.facebook.com/v23.0/${igUserId}/media`;

      const containerResponse = await axios.post(containerUrl, null, {
        params: {
          image_url: mediaUrl,
          caption: creditCaption,
          access_token: pageToken
        },
        timeout: 15000
      });

      creationId = containerResponse.data.id;
      console.log(`✅ [UGC Repost] Container created: ${creationId}`);

      await logAudit('ugc_container_created', userId, {
        action: 'repost_ugc_step_1',
        ugc_content_id: ugcContentId,
        creation_id: creationId
      });

    } catch (containerError) {
      console.error('❌ [UGC Repost] Container creation failed:', containerError.response?.data || containerError.message);

      await logAudit('ugc_container_error', userId, {
        action: 'repost_ugc_step_1',
        ugc_content_id: ugcContentId,
        error: containerError.response?.data?.error?.message || containerError.message
      });

      if (containerError.response) {
        const { status, data } = containerError.response;
        return res.status(status).json({
          success: false,
          error: data.error?.message || 'Failed to create media container',
          code: 'CONTAINER_CREATION_FAILED',
          details: data.error
        });
      }

      throw containerError;
    }

    // Step 7b: Publish Media Container
    console.log(`🚀 [UGC Repost] Step 2/2: Publishing container...`);

    let mediaId;
    try {
      const publishUrl = `https://graph.facebook.com/v23.0/${igUserId}/media_publish`;

      const publishResponse = await axios.post(publishUrl, null, {
        params: {
          creation_id: creationId,
          access_token: pageToken
        },
        timeout: 15000
      });

      mediaId = publishResponse.data.id;
      console.log(`🎉 [UGC Repost] ✅ SUCCESS! Published to Instagram`);
      console.log(`   Media ID: ${mediaId}`);
      console.log(`   Permalink: https://www.instagram.com/p/${mediaId}/`);

    } catch (publishError) {
      console.error('❌ [UGC Repost] Publishing failed:', publishError.response?.data || publishError.message);

      await logAudit('ugc_publish_error', userId, {
        action: 'repost_ugc_step_2',
        ugc_content_id: ugcContentId,
        creation_id: creationId,
        error: publishError.response?.data?.error?.message || publishError.message
      });

      if (publishError.response) {
        const { status, data } = publishError.response;
        return res.status(status).json({
          success: false,
          error: data.error?.message || 'Failed to publish post',
          code: 'PUBLISH_FAILED',
          details: data.error,
          partial_success: {
            creation_id: creationId,
            status: 'Container created but not published'
          }
        });
      }

      throw publishError;
    }

    // ===== STEP 8: Update Database with Repost Audit Trail =====
    console.log(`💾 [UGC Repost] Updating database with repost audit trail...`);

    const { error: updateError } = await supabase
      .from('ugc_content')
      .update({
        reposted_at: new Date().toISOString(),
        reposted_media_id: mediaId
      })
      .eq('id', ugcContentId);

    if (updateError) {
      console.error('⚠️  [UGC Repost] Database update failed:', updateError.message);
      console.error('   Note: Content was successfully posted to Instagram, but audit trail not saved');

      // Don't fail the request - content is already posted
      // Just log the warning
    } else {
      console.log(`✅ [UGC Repost] Audit trail saved to database`);
    }

    // ===== STEP 9: Final Audit Log =====
    const responseTime = Date.now() - requestStartTime;

    await logAudit('ugc_reposted_success', userId, {
      action: 'repost_ugc',
      ugc_content_id: ugcContentId,
      original_author: ugcContent.author_username,
      original_media_url: mediaUrl,
      reposted_media_id: mediaId,
      creation_id: creationId,
      caption_length: creditCaption.length,
      response_time_ms: responseTime
    });

    // ===== SUCCESS RESPONSE =====
    res.json({
      success: true,
      message: `Content successfully reposted from @${authorUsername}!`,
      data: {
        media_id: mediaId,
        creation_id: creationId,
        permalink: `https://www.instagram.com/p/${mediaId}/`,
        original_author: authorUsername,
        reposted_at: new Date().toISOString(),
        caption_preview: creditCaption.substring(0, 100) + (creditCaption.length > 100 ? '...' : '')
      },
      meta: {
        response_time_ms: responseTime
      }
    });

    console.log(`🎉 [UGC Repost] Request completed successfully in ${responseTime}ms`);

  } catch (error) {
    const responseTime = Date.now() - requestStartTime;

    console.error('❌ [UGC Repost] Unexpected error:', error);

    await logAudit('ugc_repost_error', req.body.userId, {
      action: 'repost_ugc',
      ugc_content_id: req.body.ugcContentId,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      response_time_ms: responseTime
    });

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to repost content',
      code: 'REPOST_FAILED',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ==========================================
// TOKEN VALIDATION ENDPOINT
// ==========================================

/**
 * POST /api/instagram/validate-token
 * Validates if the stored Instagram access token is still active
 *
 * Strategy: "Lazy Validation" - Check token validity on-demand when user loads dashboard
 * instead of using background cron jobs or auto-refresh mechanisms.
 *
 * Flow:
 * 1. Retrieve page_access_token from instagram_credentials table
 * 2. Call Meta's /me endpoint as a lightweight "ping" to validate the token
 * 3. Return status: 'active' if successful, 'expired' if authentication fails
 *
 * Error Handling:
 * - Error Code 190: OAuthException - Token is expired, invalid, or malformed
 *   - Subcode 460: Password changed
 *   - Subcode 463: Token expired
 *   - Subcode 467: User logged out, deauthorized app, or changed password
 * - Error Code 401: Unauthorized - Token is invalid
 *
 * @route POST /api/instagram/validate-token
 * @body {string} userId - User UUID
 * @body {string} businessAccountId - Instagram Business account UUID
 * @returns {Object} { success: true, status: 'active'|'expired' }
 */
router.post('/validate-token', async (req, res) => {
  const requestStartTime = Date.now();

  try {
    const { userId, businessAccountId } = req.body;

    console.log('[Token Validation] Validating token for user:', userId);

    // ===== VALIDATION =====
    if (!userId || !businessAccountId) {
      return res.status(400).json({
        success: false,
        status: 'error',
        error: 'Missing required fields: userId and businessAccountId',
        code: 'MISSING_PARAMETERS'
      });
    }

    // ===== STEP 1: Fetch credentials from database =====
    const { data: credentials, error: fetchError } = await supabase
      .from('instagram_credentials')
      .select('page_access_token, instagram_business_id')
      .eq('user_id', userId)
      .eq('business_account_id', businessAccountId)
      .single();

    if (fetchError || !credentials) {
      console.error('[Token Validation] ❌ Credentials not found:', fetchError?.message);
      return res.status(404).json({
        success: false,
        status: 'not_found',
        error: 'Credentials not found for this user',
        code: 'CREDENTIALS_NOT_FOUND'
      });
    }

    // ===== STEP 2: Validate token by calling Meta's /me endpoint =====
    // This is a lightweight "ping" to check if the token is still valid
    const graphUrl = `https://graph.facebook.com/v23.0/${credentials.instagram_business_id}`;

    try {
      const response = await axios.get(graphUrl, {
        params: {
          fields: 'id', // Minimal fields - we just need to confirm the token works
          access_token: credentials.page_access_token
        },
        timeout: 5000 // Fast timeout for quick validation
      });

      const responseTime = Date.now() - requestStartTime;

      console.log(`[Token Validation] ✅ Token is active (${responseTime}ms)`);

      // ===== SUCCESS: Token is valid =====
      return res.json({
        success: true,
        status: 'active',
        data: {
          instagram_business_id: response.data.id,
          validated_at: new Date().toISOString()
        },
        meta: {
          response_time_ms: responseTime
        }
      });

    } catch (validationError) {
      const responseTime = Date.now() - requestStartTime;

      // ===== STEP 3: Analyze the error to distinguish between temporary issues and auth failures =====

      if (validationError.response) {
        const { status, data } = validationError.response;
        const errorCode = data?.error?.code;
        const errorSubcode = data?.error?.error_subcode;
        const errorType = data?.error?.type;
        const errorMessage = data?.error?.message;

        // Log the specific error details for debugging
        console.error('[Token Validation] ❌ Meta API Error:', {
          status,
          code: errorCode,
          subcode: errorSubcode,
          type: errorType,
          message: errorMessage
        });

        /**
         * Error Code 190: OAuthException - Hard authentication failure
         * This is the primary indicator that the token is expired or invalid.
         *
         * Common subcodes:
         * - 460: Password Changed - User changed their Instagram/Facebook password
         * - 463: Token Expired - Token has exceeded its 60-day lifetime
         * - 467: User Deauthorized - User logged out, revoked app access, or changed password
         * - 490: User Not Confirmed - User hasn't confirmed their account
         */
        if (errorCode === 190 || status === 401 || errorType === 'OAuthException') {
          let reason = 'Token expired or invalid';

          // Provide more specific reason based on subcode
          if (errorSubcode === 460) {
            reason = 'Password changed - user must reconnect';
          } else if (errorSubcode === 463) {
            reason = 'Token expired (60-day limit exceeded)';
          } else if (errorSubcode === 467) {
            reason = 'User deauthorized app or logged out';
          } else if (errorSubcode === 490) {
            reason = 'User account not confirmed';
          }

          console.log(`[Token Validation] ⚠️  Token expired (Code: ${errorCode}, Subcode: ${errorSubcode}) - ${reason}`);

          // Log audit event for token expiration
          await logAudit('token_validation_expired', userId, {
            action: 'validate_token',
            business_account_id: businessAccountId,
            error_code: errorCode,
            error_subcode: errorSubcode,
            reason: reason,
            response_time_ms: responseTime
          });

          // ===== RETURN: Token is expired - User must reconnect =====
          return res.json({
            success: true,
            status: 'expired',
            error: errorMessage || reason,
            details: {
              error_code: errorCode,
              error_subcode: errorSubcode,
              reason: reason,
              requires_reconnect: true
            },
            meta: {
              response_time_ms: responseTime
            }
          });
        }

        /**
         * Error Code 4: API Too Many Calls
         * This is a temporary rate limit issue, NOT an auth failure.
         * We should return this as an 'error' status, not 'expired'.
         */
        if (errorCode === 4) {
          console.warn('[Token Validation] ⚠️  Rate limit hit during validation');

          return res.status(429).json({
            success: false,
            status: 'rate_limited',
            error: 'Rate limit exceeded during token validation',
            code: 'RATE_LIMIT_EXCEEDED',
            details: {
              retry_after: validationError.response.headers['retry-after'] || 60
            }
          });
        }

        /**
         * Other API Errors (e.g., network issues, temporary Meta outages)
         * These are system errors, not auth failures.
         */
        console.error('[Token Validation] ❌ Unexpected Meta API error:', errorMessage);

        return res.status(status || 500).json({
          success: false,
          status: 'error',
          error: errorMessage || 'Failed to validate token',
          code: 'VALIDATION_FAILED',
          details: {
            error_code: errorCode,
            error_type: errorType
          }
        });
      }

      // ===== Network error or timeout (no response from Meta) =====
      console.error('[Token Validation] ❌ Network error:', validationError.message);

      return res.status(500).json({
        success: false,
        status: 'error',
        error: 'Network error during token validation',
        code: 'NETWORK_ERROR',
        details: validationError.message
      });
    }

  } catch (error) {
    const responseTime = Date.now() - requestStartTime;

    console.error('[Token Validation] ❌ Unexpected error:', error.message);

    await logAudit('token_validation_error', req.body.userId, {
      action: 'validate_token',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      response_time_ms: responseTime
    });

    res.status(500).json({
      success: false,
      status: 'error',
      error: 'Internal server error during token validation',
      code: 'INTERNAL_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ==========================================
// EXPORTS
// ==========================================

module.exports = router;
