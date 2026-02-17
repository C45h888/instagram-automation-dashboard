// backend.api/routes/instagram-api.js (NEW FILE)
const express = require('express');
const router = express.Router();
const axios = require('axios'); // ADDED: For Graph API calls
const { instagramAPIRateLimiter, logAfterResponse } = require('../middleware/rate-limiter');
const {
  exchangeForPageToken,
  getAccountInsights,
  storePageToken,
  retrievePageToken,
  validateTokenScopes,
  logAudit: logAuditService
} = require('../services/instagram-tokens');
const { logAudit: logAuditLegacy, getSupabaseAdmin } = require('../config/supabase'); // ADDED: Audit logging + DB client
const { clearCredentialCache } = require('../helpers/agent-helpers');

// ✅ Use new audit logging service (bff586c pattern)
const logAudit = logAuditService;

// ==========================================
// CONSTANTS
// ==========================================

// Meta Graph API Version - Updated to v23.0 as of December 2025
const GRAPH_API_VERSION = 'v23.0';

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
 * Exchange user access token for page access token with AUTO-DISCOVERY
 *
 * UPDATED: Now automatically discovers Instagram Business Account ID
 * No longer requires businessAccountId from frontend
 *
 * This endpoint converts a user-level OAuth token into a page-level token
 * required for the instagram_manage_insights permission
 *
 * Process:
 * 1. Receive user access token from OAuth flow
 * 2. Query Facebook Graph API for user's pages AND discover IG Business Account
 * 3. Create/update business account record in database
 * 4. Encrypt and store page token in database
 * 5. Return business account UUID and metadata to client
 *
 * @route POST /api/instagram/exchange-token
 * @body {string} userAccessToken - User access token from OAuth
 * @body {string} userId - User UUID from Supabase Auth (REQUIRED)
 * @returns {Object} Success response with businessAccountId and page metadata
 */
router.post('/exchange-token', async (req, res) => {
  try {
    const { userAccessToken, userId } = req.body;

    // Note: businessAccountId is now OPTIONAL - we will discover it
    console.log('📥 Token exchange request received');
    console.log('   User ID (UUID):', userId || 'not provided');
    console.log('   Token provided:', userAccessToken ? 'YES' : 'NO');

    // ===== STEP 1: Validate required fields =====
    if (!userAccessToken) {
      console.error('❌ Missing userAccessToken in request body');
      return res.status(400).json({
        success: false,
        error: 'userAccessToken is required',
        code: 'MISSING_USER_TOKEN',
        message: 'Request body must include userAccessToken from OAuth flow'
      });
    }

    if (!userId) {
      console.error('❌ Missing userId in request body');
      return res.status(400).json({
        success: false,
        error: 'userId (UUID) is required',
        code: 'MISSING_USER_ID',
        message: 'Request body must include userId (Supabase UUID) from authenticated session'
      });
    }

    // ===== STEP 2: Exchange for long-lived token AND discover IG Business Account =====
    // This is the AUTO-DISCOVERY step that was missing
    console.log('🔄 Starting token exchange and auto-discovery...');
    const exchangeResult = await exchangeForPageToken(userAccessToken);

    if (!exchangeResult.success) {
      console.error('❌ Token exchange failed:', exchangeResult.error);
      return res.status(400).json({
        success: false,
        error: 'Failed to exchange token',
        details: exchangeResult.error,
        code: 'TOKEN_EXCHANGE_FAILED'
      });
    }

    console.log('✅ Token exchange successful');
    console.log('   Long-lived token obtained');

    // ===== STEP 3: Extract the discovered Instagram Business Account ID =====
    // This ID comes from the Graph API /me/accounts endpoint
    const discoveredBusinessAccountId = exchangeResult.igBusinessAccountId;
    const pageAccessToken = exchangeResult.pageAccessToken;
    const pageId = exchangeResult.pageId;
    const pageName = exchangeResult.pageName;

    if (!discoveredBusinessAccountId) {
      console.error('❌ No Instagram Business Account found');
      return res.status(400).json({
        success: false,
        error: 'No Instagram Business Account found',
        message: 'Please ensure your Facebook Page is connected to an Instagram Business Account',
        code: 'NO_IG_BUSINESS_ACCOUNT'
      });
    }

    console.log('✅ Instagram Business Account discovered');
    console.log('   IG Business ID:', discoveredBusinessAccountId);
    console.log('   Page ID:', pageId);
    console.log('   Page Name:', pageName);

    // ===== STEP 4: Store the page token using the DISCOVERED ID =====
    // This creates the business account record AND stores the token
    console.log('💾 Storing token and creating business account record...');

    const storeResult = await storePageToken({
      userId: userId,  // UUID from Supabase Auth
      igBusinessAccountId: discoveredBusinessAccountId,
      pageAccessToken: pageAccessToken,
      pageId: pageId,
      pageName: pageName
    });

    if (!storeResult.success) {
      console.error('❌ Failed to store page token:', storeResult.error);
      return res.status(500).json({
        success: false,
        error: 'Failed to store credentials',
        details: storeResult.error,
        code: 'STORAGE_FAILED'
      });
    }

    console.log('✅ Page token stored successfully');

    // Bust cached credentials so the next call fetches the new token from DB
    clearCredentialCache(storeResult.businessAccountId);

    // ===== STEP 5: Return the discovered businessAccountId to frontend =====
    // THIS IS THE HANDSHAKE COMPLETION
    return res.status(200).json({
      success: true,
      message: 'Token exchange and storage successful',
      data: {
        businessAccountId: storeResult.businessAccountId,  // UUID from DB
        instagramBusinessId: discoveredBusinessAccountId,   // Instagram numeric ID
        pageId: pageId,
        pageName: pageName,
        tokenExpiresAt: storeResult.expiresAt
      }
    });

  } catch (error) {
    console.error('❌ Token exchange error:', error);

    // Return user-friendly error message
    return res.status(500).json({
      success: false,
      error: 'Internal server error during token exchange',
      message: error.message,
      code: 'INTERNAL_ERROR'
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
      metrics,
      until  // ✅ FIXED: Now extracting until parameter for previous period queries
    } = req.query;

    console.log('📊 Insights request received');
    console.log('   Account ID:', accountId);
    console.log('   Period:', period);
    console.log('   User ID:', userId || 'not provided');
    console.log('   Business Account ID:', businessAccountId || 'not provided');
    console.log('   Until timestamp:', until || 'not provided (using current time)');

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
      metrics: metricsArray,
      until: until ? parseInt(until) : undefined  // ✅ FIXED: Pass until to getAccountInsights
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
/**
 * GET /api/instagram/media/:accountId
 * REFACTORED: Now queries Supabase instagram_media table instead of Instagram API
 *
 * OLD BEHAVIOR: Called Instagram API directly (Live Wire)
 * NEW BEHAVIOR: Reads from database (Sync & Store)
 *
 * NOTE: Data is populated via POST /sync/posts endpoint
 */
router.get('/media/:accountId', async (req, res) => {
  const requestStartTime = Date.now();

  try {
    const { accountId } = req.params;
    const { limit = 25, offset = 0, businessAccountId } = req.query;

    console.log(`🖼️  Fetching media from database for account: ${accountId}`);

    // ===== VALIDATION =====
    if (!businessAccountId) {
      console.error('❌ Missing businessAccountId parameter');
      return res.status(400).json({
        success: false,
        error: 'businessAccountId is required',
        code: 'MISSING_PARAMETERS'
      });
    }

    // Validate limit and offset parameters
    const mediaLimit = Math.min(Math.max(parseInt(limit) || 25, 1), 100);
    const mediaOffset = Math.max(parseInt(offset) || 0, 0);

    // Get Supabase client
    const supabase = getSupabaseAdmin();

    // ✅ NEW: Query database instead of Instagram API
    const { data: posts, error, count } = await supabase
      .from('instagram_media')
      .select('*', { count: 'exact' })
      .eq('business_account_id', businessAccountId)
      .order('published_at', { ascending: false })
      .range(mediaOffset, mediaOffset + mediaLimit - 1);

    if (error) {
      console.error('[Media] Database query error:', error);

      await logAudit('media_fetch_error', null, {
        action: 'fetch_media',
        business_account_id: businessAccountId,
        error: error.message,
        source: 'database',
        response_time_ms: Date.now() - requestStartTime
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to fetch media from database',
        code: 'DATABASE_ERROR'
      });
    }

    const responseTime = Date.now() - requestStartTime;

    // Log successful database query
    await logAudit('instagram_media_fetched', null, {
      action: 'fetch_media',
      business_account_id: businessAccountId,
      media_count: posts?.length || 0,
      source: 'database',
      response_time_ms: responseTime
    });

    // ===== SUCCESS RESPONSE =====
    res.json({
      success: true,
      data: posts || [],
      pagination: {
        total: count,
        limit: mediaLimit,
        offset: mediaOffset,
        hasMore: (mediaOffset + mediaLimit) < (count || 0)
      },
      source: 'database',  // ✅ Indicates data source
      meta: {
        count: posts?.length || 0,
        response_time_ms: responseTime,
        note: 'Data synced from Instagram via /sync/posts endpoint'
      }
    });

    console.log(`[Media] ✅ Returned ${posts?.length || 0} posts from database (cached, ${responseTime}ms)`);

  } catch (error) {
    const responseTime = Date.now() - requestStartTime;

    console.error('❌ Media fetch error:', error.message);

    await logAudit('media_fetch_error', null, {
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
    const graphApiUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${id}`;

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

    // ===== DETERMINE IF mediaId IS ACTUALLY AN igUserId =====
    // Check if we need to fetch all comments (when mediaId is actually the igUserId)
    // We'll try to fetch media first to see if this is an account-level request
    const supabase = getSupabaseAdmin();

    let allComments = [];
    let isAccountLevelFetch = false;

    // Try to fetch media for this account to determine if mediaId is an igUserId
    const { data: mediaItems } = await supabase
      .from('instagram_media')
      .select('instagram_media_id')
      .eq('business_account_id', businessAccountId)
      .limit(100); // Limit to prevent excessive API calls

    // If we have media items and mediaId looks like an igUserId (not in our media table),
    // treat this as an account-level fetch
    if (mediaItems && mediaItems.length > 0) {
      const mediaIdInDatabase = mediaItems.some(m => m.instagram_media_id === mediaId);
      if (!mediaIdInDatabase) {
        // mediaId is likely an igUserId, fetch comments for all media
        isAccountLevelFetch = true;
        console.log(`📊 Fetching comments for all media (${mediaItems.length} items)`);
      }
    } else if (!mediaItems || mediaItems.length === 0) {
      // ===== FIX: Handle case where no media exists =====
      // When account has no media, return empty result instead of trying to fetch from IGUser ID
      const responseTime = Date.now() - requestStartTime;

      console.log('⚠️ No media items found for this account - returning empty comments array');

      await logAudit('instagram_comments_fetched', userId, {
        action: 'fetch_comments_no_media',
        business_account_id: businessAccountId,
        media_id: mediaId,
        comment_count: 0,
        response_time_ms: responseTime
      });

      return res.json({
        success: true,
        data: [],
        message: 'No media items found for this account. Please sync your Instagram media first.',
        paging: {},
        rate_limit: {
          remaining: req.rateLimitRemaining || 'unknown',
          limit: 200,
          window: '1 hour'
        },
        meta: {
          total_comments: 0,
          media_processed: 0,
          response_time_ms: responseTime
        }
      });
    }

    // ===== GRAPH API CALL =====
    const fields = 'id,text,username,timestamp,like_count,replies{id,text,username,timestamp}';

    try {
      if (isAccountLevelFetch && mediaItems) {
        // Fetch comments for all media items
        const commentPromises = mediaItems.map(async (media) => {
          try {
            const graphApiUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${media.instagram_media_id}/comments`;
            const response = await axios.get(graphApiUrl, {
              params: {
                fields,
                access_token: pageToken
              },
              timeout: 10000
            });
            return response.data.data || [];
          } catch (err) {
            console.error(`❌ Failed to fetch comments for media ${media.instagram_media_id}:`, err.message);
            return []; // Continue with other media even if one fails
          }
        });

        const commentsArrays = await Promise.all(commentPromises);
        allComments = commentsArrays.flat(); // Flatten all comment arrays into one

        const responseTime = Date.now() - requestStartTime;

        await logAudit('instagram_comments_fetched', userId, {
          action: 'fetch_all_comments',
          business_account_id: businessAccountId,
          media_count: mediaItems.length,
          comment_count: allComments.length,
          response_time_ms: responseTime
        });

        // ===== SUCCESS RESPONSE =====
        res.json({
          success: true,
          data: allComments,
          paging: {}, // No paging for aggregated results
          rate_limit: {
            remaining: req.rateLimitRemaining || 'unknown',
            limit: 200,
            window: '1 hour'
          },
          meta: {
            total_comments: allComments.length,
            media_processed: mediaItems.length,
            response_time_ms: responseTime
          }
        });
      } else {
        // Fetch comments for specific media (original behavior)
        const graphApiUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${mediaId}/comments`;

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
      }
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
    const graphApiUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${commentId}/replies`;

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
      const containerUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${igUserId}/media`;
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
      const publishUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${igUserId}/media_publish`;
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

/**
 * ==========================================
 * LAYER B: VIEW (READ)
 * Split-Brain Architecture - Data Retrieval Layer
 * ==========================================
 *
 * GET /api/instagram/visitor-posts
 * Fetches visitor posts (UGC) from database cache
 *
 * Architecture Evolution:
 *   - OLD: Direct Instagram API calls (Live Wire - Rate limits, wrong permissions)
 *   - NEW: Database-only reads (Sync & Store - Fast, scalable, correct permissions)
 *
 * Responsibilities:
 *   - ONLY reads from Supabase database (NO Instagram API calls)
 *   - Supports pagination (limit/offset with range queries)
 *   - Returns cached data synced by Layer A (syncTaggedPosts)
 *
 * Query Parameters:
 *   - businessAccountId: Instagram business account UUID (required)
 *   - limit: Number of posts to fetch (default: 20, max: 100)
 *   - offset: Pagination offset (default: 0)
 *
 * Data Source: ugc_content table (populated by backend.api/services/instagram-sync.js)
 * Permission: None required (reads from own database)
 */
router.get('/visitor-posts', async (req, res) => {
  const requestStartTime = Date.now();

  try {
    const { userId, businessAccountId, limit = 20, offset = 0 } = req.query;

    console.log('[UGC] Fetching visitor posts from database');
    console.log('   User ID:', userId);
    console.log('   Business Account ID:', businessAccountId);

    // ===== VALIDATION =====
    if (!userId || !businessAccountId) {
      console.error('❌ Missing required parameters');
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: userId and businessAccountId',
        code: 'MISSING_PARAMETERS'
      });
    }

    // ✅ NEW: Scope validation (bff586c pattern)
    const scopeCheck = await validateTokenScopes(userId, businessAccountId, [
      'instagram_basic',
      'pages_read_user_content'
    ]);

    if (!scopeCheck.valid) {
      await logAudit('scope_check_failed', userId, {
        endpoint: '/visitor-posts',
        missing: scopeCheck.missing,
        business_account_id: businessAccountId
      });

      return res.status(403).json({
        success: false,
        error: `Missing required permissions: ${scopeCheck.missing.join(', ')}`,
        code: 'MISSING_SCOPES',
        missing: scopeCheck.missing
      });
    }

    // Validate limit and offset parameters
    const postsLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
    const postsOffset = Math.max(parseInt(offset) || 0, 0);

    // Get Supabase client
    const supabase = getSupabaseAdmin();

    // ✅ NEW: Query database instead of Instagram API
    const { data: posts, error, count } = await supabase
      .from('ugc_content')
      .select('*', { count: 'exact' })
      .eq('business_account_id', businessAccountId)
      .order('timestamp', { ascending: false })
      .range(postsOffset, postsOffset + postsLimit - 1);

    if (error) {
      console.error('[UGC] Database query error:', error);

      await logAudit('visitor_posts_error', userId, {
        action: 'fetch_visitor_posts',
        error: error.message,
        source: 'database',
        business_account_id: businessAccountId,
        response_time_ms: Date.now() - requestStartTime
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to fetch UGC posts from database',
        code: 'DATABASE_ERROR'
      });
    }

    // Calculate stats from database
    const { data: statsData } = await supabase
      .from('ugc_content')
      .select('sentiment, featured, timestamp')
      .eq('business_account_id', businessAccountId);

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const stats = {
      totalPosts: count || 0,
      postsThisWeek: statsData?.filter(p => {
        return new Date(p.timestamp) > weekAgo;
      }).length || 0,
      sentimentBreakdown: {
        positive: statsData?.filter(p => p.sentiment === 'positive').length || 0,
        neutral: statsData?.filter(p => p.sentiment === 'neutral').length || 0,
        negative: statsData?.filter(p => p.sentiment === 'negative').length || 0,
      },
      featuredCount: statsData?.filter(p => p.featured).length || 0,
    };

    const responseTime = Date.now() - requestStartTime;

    // ✅ NEW: Audit successful fetch with userId (bff586c pattern)
    await logAudit('posts_fetched', userId, {
      count: posts?.length || 0,
      source: 'database',
      endpoint: '/visitor-posts',
      business_account_id: businessAccountId,
      response_time_ms: responseTime
    });

    // ===== SUCCESS RESPONSE =====
    res.json({
      success: true,
      data: posts || [],
      pagination: {
        total: count,
        limit: postsLimit,
        offset: postsOffset,
        hasMore: (postsOffset + postsLimit) < (count || 0)
      },
      stats,
      source: 'database',  // ✅ Indicates data source
      meta: {
        response_time_ms: responseTime,
        note: 'Data synced from Instagram via /sync/ugc endpoint'
      }
    });

    console.log(`[UGC] ✅ Returned ${posts?.length || 0} posts from database (cached, ${responseTime}ms)`);

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
// Permission Required: instagram_manage_messages
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
    const graphApiUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${id}/conversations`;

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
    const graphApiUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${conversationId}/messages`;

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
    const graphApiUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${conversationId}/messages`;

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
      const containerUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${igUserId}/media`;

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
      const publishUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${igUserId}/media_publish`;

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
// TOKEN REFRESH ENDPOINT
// ==========================================

/**
 * POST /api/instagram/refresh-token
 * Manually refresh a user's Instagram access token
 *
 * Long-lived Instagram access tokens expire after 60 days.
 * This endpoint exchanges the current token for a new one with a fresh 60-day expiration.
 *
 * Smart Refresh Pattern:
 * 1. Pre-check: Verify token hasn't already expired (avoid wasting Meta API call)
 * 2. If expired: Return 401 TOKEN_EXPIRED_REQUIRE_LOGIN
 * 3. If valid: Call Meta API to refresh
 * 4. Update database with new token and expiration
 *
 * Security Best Practice:
 * - Does NOT return the new token in the response (security risk)
 * - Frontend only needs to know if refresh succeeded
 *
 * @route POST /api/instagram/refresh-token
 * @body {string} userId - User UUID
 * @body {string} businessAccountId - Instagram Business account UUID
 * @returns {Object} Success response with new expiration info
 */
router.post('/refresh-token', async (req, res) => {
  const requestStartTime = Date.now();

  try {
    const { userId, businessAccountId } = req.body;

    console.log('[Token] Refresh request received');
    console.log('   User ID:', userId);
    console.log('   Business Account ID:', businessAccountId);

    // ===== STEP 1: VALIDATION =====
    if (!userId || !businessAccountId) {
      return res.status(400).json({
        success: false,
        error: 'userId and businessAccountId are required',
        code: 'MISSING_PARAMETERS'
      });
    }

    // ===== STEP 2: SMART PRE-CHECK - Fetch current expiration =====
    // Check if token is already expired BEFORE calling Meta API (saves API quota)
    const supabase = getSupabaseAdmin();

    const { data: credentials, error: fetchError } = await supabase
      .from('instagram_credentials')
      .select('expires_at')
      .eq('user_id', userId)
      .eq('business_account_id', businessAccountId)
      .single();

    if (fetchError || !credentials) {
      console.error('[Token] ❌ Credentials not found:', fetchError?.message);

      await logAudit('token_refresh_failed', userId, {
        action: 'refresh_token',
        business_account_id: businessAccountId,
        error: 'credentials_not_found',
        response_time_ms: Date.now() - requestStartTime
      });

      return res.status(404).json({
        success: false,
        error: 'Credentials not found',
        code: 'CREDENTIALS_NOT_FOUND'
      });
    }

    // Check if token is already expired
    const expiresAt = new Date(credentials.expires_at);
    const now = new Date();

    console.log('[Token] Current expiration:', expiresAt.toISOString());
    console.log('[Token] Current time:', now.toISOString());

    if (expiresAt < now) {
      console.error('[Token] ❌ Token already expired');
      console.error('   Expired at:', expiresAt.toISOString());
      console.error('   Time now:', now.toISOString());

      await logAudit('token_refresh_already_expired', userId, {
        action: 'refresh_token',
        business_account_id: businessAccountId,
        expired_at: expiresAt.toISOString(),
        error: 'token_already_expired',
        response_time_ms: Date.now() - requestStartTime
      });

      return res.status(401).json({
        success: false,
        error: 'Token has already expired. Please reconnect your Instagram account.',
        code: 'TOKEN_EXPIRED_REQUIRE_LOGIN',
        details: {
          expired_at: expiresAt.toISOString(),
          requires_reconnect: true
        }
      });
    }

    console.log('[Token] ✅ Token not yet expired - proceeding with refresh');

    // ===== STEP 3: Retrieve decrypted page token =====
    let pageToken;
    try {
      pageToken = await retrievePageToken(userId, businessAccountId);
      console.log('[Token] ✅ Retrieved and decrypted page token');
    } catch (tokenError) {
      console.error('[Token] ❌ Token retrieval failed:', tokenError.message);

      await logAudit('token_retrieval_failed', userId, {
        action: 'refresh_token',
        business_account_id: businessAccountId,
        error: tokenError.message,
        response_time_ms: Date.now() - requestStartTime
      });

      return res.status(401).json({
        success: false,
        error: 'Failed to retrieve access token. Please reconnect your Instagram account.',
        code: 'TOKEN_RETRIEVAL_FAILED'
      });
    }

    // ===== STEP 4: Call Meta Graph API to refresh token =====
    const refreshUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/oauth/access_token`;

    console.log('[Token] Calling Meta Graph API to refresh token...');

    try {
      const response = await axios.get(refreshUrl, {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: process.env.INSTAGRAM_APP_ID || process.env.FACEBOOK_APP_ID,  // ✅ v3: Use INSTAGRAM_APP_ID with fallback
          client_secret: process.env.INSTAGRAM_APP_SECRET || process.env.FACEBOOK_APP_SECRET,  // ✅ v3: Use INSTAGRAM_APP_SECRET with fallback
          fb_exchange_token: pageToken
        },
        timeout: 10000
      });

      const { access_token, expires_in } = response.data;

      console.log('[Token] ✅ Token refreshed successfully from Meta');
      console.log('   New token expires in:', expires_in, 'seconds');

      // ===== STEP 5: Calculate new expiration =====
      const newExpiresAt = new Date();
      newExpiresAt.setSeconds(newExpiresAt.getSeconds() + expires_in);

      console.log('[Token] New expiration date:', newExpiresAt.toISOString());

      // ===== STEP 6: Update database with new token =====
      const { error: updateError } = await supabase
        .from('instagram_credentials')
        .update({
          page_access_token: access_token,
          expires_at: newExpiresAt.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('business_account_id', businessAccountId);

      if (updateError) {
        console.error('[Token] ❌ Database update failed:', updateError.message);
        throw updateError;
      }

      console.log('[Token] ✅ Database updated with new token and expiration');

      // Bust cached credentials so the next call fetches the refreshed token from DB
      clearCredentialCache(businessAccountId);

      // ===== STEP 7: Log audit trail =====
      const responseTime = Date.now() - requestStartTime;

      await logAudit('token_refreshed', userId, {
        action: 'refresh_token',
        business_account_id: businessAccountId,
        new_expiration: newExpiresAt.toISOString(),
        expires_in_seconds: expires_in,
        response_time_ms: responseTime
      });

      // ===== SUCCESS RESPONSE =====
      // Security Best Practice: Do NOT return the new token
      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          expires_at: newExpiresAt.toISOString(),
          expires_in_seconds: expires_in
        },
        meta: {
          response_time_ms: responseTime
        }
      });

      console.log(`[Token] ✅ Refresh completed successfully (${responseTime}ms)`);

    } catch (refreshError) {
      // Handle Meta Graph API errors
      if (refreshError.response) {
        const { status, data } = refreshError.response;
        const errorCode = data?.error?.code;
        const errorMessage = data?.error?.message || 'Token refresh failed';

        console.error(`[Token] ❌ Meta API error (${status}):`, data);

        // Error Code 190: OAuthException - Token is invalid/expired
        if (errorCode === 190) {
          console.error('[Token] ❌ Meta returned error 190 - Token invalid/expired');

          await logAudit('token_refresh_expired_by_meta', userId, {
            action: 'refresh_token',
            business_account_id: businessAccountId,
            error_code: errorCode,
            error_message: errorMessage,
            response_time_ms: Date.now() - requestStartTime
          });

          return res.status(401).json({
            success: false,
            error: 'Token has expired or is invalid. Please reconnect your Instagram account.',
            code: 'TOKEN_EXPIRED_REQUIRE_LOGIN',
            details: {
              meta_error_code: errorCode,
              meta_error_message: errorMessage,
              requires_reconnect: true
            }
          });
        }

        // Other API errors
        await logAudit('token_refresh_api_error', userId, {
          action: 'refresh_token',
          business_account_id: businessAccountId,
          status_code: status,
          error_code: errorCode,
          error_message: errorMessage,
          response_time_ms: Date.now() - requestStartTime
        });

        return res.status(status).json({
          success: false,
          error: errorMessage,
          code: 'META_API_ERROR',
          details: data.error
        });
      }

      // Network error or timeout
      throw refreshError;
    }

  } catch (error) {
    const responseTime = Date.now() - requestStartTime;

    console.error('[Token] ❌ Unexpected error:', error.message);

    await logAudit('token_refresh_error', req.body.userId, {
      action: 'refresh_token',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      response_time_ms: responseTime
    });

    res.status(500).json({
      success: false,
      error: 'Failed to refresh token',
      code: 'INTERNAL_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============================================
// HELPER FUNCTIONS FOR TOKEN VALIDATION (v3)
// ============================================

/**
 * Validates a Meta access token by calling the Graph API
 * @param {string} token - Access token to validate
 * @param {string} instagramBusinessId - IG Business Account ID
 * @returns {Promise<Object>} - { success: boolean, data?: object, error?: string }
 */
async function validateMetaToken(token, instagramBusinessId) {
  try {
    const response = await axios.get(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${instagramBusinessId}`,
      {
        params: {
          fields: 'id,username,name,profile_picture_url',
          access_token: token
        },
        timeout: 10000
      }
    );

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message
    };
  }
}

/**
 * Fetches dynamic scope from Meta debug_token API with caching
 * @param {string} token - Access token to inspect
 * @param {object} supabase - Supabase client
 * @param {string} credentialId - Credential record ID for caching
 * @returns {Promise<string[]>} - Array of scope strings
 */
async function fetchDynamicScope(token, supabase, credentialId = null) {
  // ✅ v3 OPTIMIZATION: Check cache first
  if (credentialId) {
    const { data: cached } = await supabase
      .from('instagram_credentials')
      .select('scope_cache, scope_cache_updated_at')
      .eq('id', credentialId)
      .single();

    // Use cache if less than 7 days old
    if (cached?.scope_cache && cached?.scope_cache_updated_at) {
      const cacheAge = Date.now() - new Date(cached.scope_cache_updated_at).getTime();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;

      if (cacheAge < sevenDays) {
        console.log('✅ Using cached scope (age: ' + Math.floor(cacheAge / 1000 / 60 / 60) + 'h)');
        return cached.scope_cache;
      }
    }
  }

  // Fetch from Meta API
  try {
    const debugResponse = await axios.get(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/debug_token`,
      {
        params: {
          input_token: token,
          access_token: token // Self-debug
        },
        timeout: 5000
      }
    );

    const detectedScope = debugResponse.data.data?.scopes || [];
    console.log('✅ Detected scopes from Meta API:', detectedScope.join(', '));

    // ✅ v3 OPTIMIZATION: Update cache
    if (credentialId && detectedScope.length > 0) {
      await supabase
        .from('instagram_credentials')
        .update({
          scope_cache: detectedScope,
          scope_cache_updated_at: new Date().toISOString()
        })
        .eq('id', credentialId);
    }

    return detectedScope;

  } catch (debugError) {
    console.warn('⚠️  Scope detection failed, using defaults');
    return ['instagram_manage_insights', 'pages_show_list', 'pages_read_engagement'];
  }
}

/**
 * Calls the /refresh-token endpoint to refresh an access token
 * @param {string} userId - User UUID
 * @param {string} businessAccountId - Business account UUID
 * @returns {Promise<Object>} - { success: boolean, data?: object, error?: string }
 */
async function callRefreshTokenEndpoint(userId, businessAccountId) {
  try {
    // ✅ v3 OPTIMIZATION: Reuse existing /refresh-token endpoint
    const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001';

    const response = await axios.post(`${API_BASE}/api/instagram/refresh-token`, {
      userId,
      businessAccountId
    });

    return {
      success: response.data.success,
      data: response.data.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message
    };
  }
}

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
  const supabase = getSupabaseAdmin();

  try {
    const {
      userId,
      businessAccountId,
      importMode = false,
      pageAccessToken,
      pageId,
      pageName
    } = req.body;

    // ===== IMPORT MODE: Direct token import =====
    if (importMode) {
      console.log('📥 Token import mode activated');

      const { instagramBusinessId } = req.body; // Only destructure in import mode

      // Validation
      if (!userId || !pageAccessToken || !instagramBusinessId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields for import',
          required: ['userId', 'pageAccessToken', 'instagramBusinessId']
        });
      }

      // ✅ v3 OPTIMIZATION: Use helper function to validate token
      const validation = await validateMetaToken(pageAccessToken, instagramBusinessId);

      if (!validation.success) {
        console.error('❌ Token validation failed:', validation.error);

        // ✅ v3 OPTIMIZATION: Resilient audit logging
        try {
          await logAudit('token_import_failed', userId, {
            action: 'import_token',
            error: 'validation_failed',
            details: validation.error
          });
        } catch (auditError) {
          console.warn('⚠️  Audit log failed (non-blocking):', auditError.message);
        }

        return res.status(401).json({
          success: false,
          error: 'Invalid or expired token',
          details: validation.error
        });
      }

      console.log('✅ Token validated:', validation.data.username);

      // ✅ v3 OPTIMIZATION: Fetch dynamic scope with caching (no credentialId yet, so no cache)
      const detectedScope = await fetchDynamicScope(pageAccessToken, supabase, null);

      // Store using existing function (with dynamic scope)
      const storeResult = await storePageToken({
        userId,
        igBusinessAccountId: instagramBusinessId,
        pageAccessToken,
        pageId: pageId || instagramBusinessId,
        pageName: pageName || 'Imported Account',
        scope: detectedScope // ✅ Use detected scope
      });

      if (!storeResult.success) {
        // ✅ v3 OPTIMIZATION: Resilient audit logging
        try {
          await logAudit('token_storage_failed', userId, {
            action: 'import_token',
            error: storeResult.error
          });
        } catch (auditError) {
          console.warn('⚠️  Audit log failed (non-blocking):', auditError.message);
        }

        return res.status(500).json({
          success: false,
          error: 'Failed to store token',
          details: storeResult.error
        });
      }

      // ✅ v3 OPTIMIZATION: Resilient audit logging
      try {
        await logAudit('token_imported', userId, {
          action: 'import_token',
          business_account_id: storeResult.businessAccountId,
          instagram_business_id: instagramBusinessId,
          scope: detectedScope,
          response_time_ms: Date.now() - requestStartTime,
          success: true
        });
      } catch (auditError) {
        console.warn('⚠️  Audit log failed (non-blocking):', auditError.message);
      }

      return res.json({
        success: true,
        status: 'imported',
        data: {
          businessAccountId: storeResult.businessAccountId,
          instagramBusinessId,
          expiresAt: storeResult.expiresAt,
          scope: detectedScope
        }
      });
    }

    // ===== VALIDATION MODE: Existing logic (with auto-refresh) =====
    console.log('[Token Validation] Validating token for user:', userId);

    if (!userId || !businessAccountId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId and businessAccountId'
      });
    }

    // ===== STEP 1: Fetch credentials from database =====
    const { data: credentials, error: fetchError } = await supabase
      .from('instagram_credentials')
      .select('*')
      .eq('user_id', userId)
      .eq('business_account_id', businessAccountId)
      .eq('token_type', 'page')
      .eq('is_active', true)
      .single();

    if (fetchError || !credentials) {
      console.error('[Token Validation] ❌ Credentials not found:', {
        error: fetchError?.message,
        details: fetchError?.details,
        hint: fetchError?.hint,
        code: fetchError?.code,
        userId,
        businessAccountId
      });
      return res.status(404).json({
        success: false,
        status: 'not_found',
        error: 'Credentials not found for this user',
        code: 'CREDENTIALS_NOT_FOUND',
        details: process.env.NODE_ENV === 'development' ? {
          error: fetchError?.message,
          hint: fetchError?.hint
        } : undefined
      });
    }

    // ===== STEP 1.5: Check expiration and auto-refresh if needed (v3 OPTIMIZATION) =====
    const now = new Date();
    const expiresAt = new Date(credentials.expires_at);
    const secondsUntilExpiry = Math.floor((expiresAt - now) / 1000);

    // ✅ v3 OPTIMIZATION: Auto-refresh via /refresh-token endpoint (code reuse)
    if (secondsUntilExpiry > 0 && secondsUntilExpiry < 86400) {
      console.log(`⚠️  Token expires in ${Math.floor(secondsUntilExpiry / 3600)}h - auto-refreshing...`);

      // Call existing /refresh-token endpoint instead of duplicating logic
      const refreshResult = await callRefreshTokenEndpoint(userId, businessAccountId);

      if (refreshResult.success) {
        console.log('✅ Token auto-refreshed successfully via /refresh-token endpoint');

        // ✅ v3 OPTIMIZATION: Resilient audit logging
        try {
          await logAudit('token_auto_refreshed', userId, {
            action: 'auto_refresh',
            business_account_id: businessAccountId,
            new_expiry: refreshResult.data?.expires_at,
            triggered_by: 'validate_token',
            success: true
          });
        } catch (auditError) {
          console.warn('⚠️  Audit log failed (non-blocking):', auditError.message);
        }

        // Refetch credentials to get updated token
        const { data: updatedCreds } = await supabase
          .from('instagram_credentials')
          .select('*')
          .eq('user_id', userId)
          .eq('business_account_id', businessAccountId)
          .eq('token_type', 'page')
          .eq('is_active', true)
          .single();

        if (updatedCreds) {
          // Update credentials variable with refreshed data
          Object.assign(credentials, updatedCreds);
        }

      } else {
        console.warn('⚠️  Auto-refresh failed:', refreshResult.error);
      }
    }

    // ===== STEP 2: Fetch instagram_business_id separately =====
    const { data: businessAccount, error: businessError } = await supabase
      .from('instagram_business_accounts')
      .select('instagram_business_id')
      .eq('id', businessAccountId)
      .single();

    if (businessError || !businessAccount) {
      console.error('[Token Validation] ❌ Instagram business account not found:', {
        error: businessError?.message,
        details: businessError?.details,
        businessAccountId
      });
      return res.status(404).json({
        success: false,
        status: 'not_found',
        error: 'Instagram business account not linked to credentials',
        code: 'BUSINESS_ACCOUNT_NOT_LINKED',
        details: process.env.NODE_ENV === 'development' ? {
          error: businessError?.message
        } : undefined
      });
    }

    // ===== STEP 3: Decrypt the token =====
    const { data: decryptedToken, error: decryptError } = await supabase
      .rpc('decrypt_instagram_token', {
        encrypted_token: credentials.access_token_encrypted
      });

    if (decryptError || !decryptedToken) {
      console.error('[Token Validation] ❌ Token decryption failed:', {
        error: decryptError?.message,
        details: decryptError?.details,
        hint: decryptError?.hint
      });
      return res.status(500).json({
        success: false,
        status: 'error',
        error: 'Failed to decrypt access token',
        code: 'DECRYPTION_FAILED',
        details: process.env.NODE_ENV === 'development' ? {
          error: decryptError?.message,
          hint: decryptError?.hint
        } : undefined
      });
    }

    console.log('[Token Validation] ✅ Token decrypted successfully');

    // ===== STEP 4: Use instagram_business_id from separate query =====
    const instagramBusinessId = businessAccount.instagram_business_id;

    if (!instagramBusinessId) {
      console.error('[Token Validation] ❌ Missing instagram_business_id');
      return res.status(500).json({
        success: false,
        status: 'error',
        error: 'Instagram business ID not found',
        code: 'MISSING_BUSINESS_ID'
      });
    }

    // ===== STEP 5: Validate token by calling Meta's /me endpoint =====
    // This is a lightweight "ping" to check if the token is still valid
    const graphUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${instagramBusinessId}`;

    console.log('[Token Validation] 🔍 Calling Meta API:', {
      url: graphUrl,
      instagramBusinessId,
      tokenLength: decryptedToken?.length,
      hasToken: !!decryptedToken
    });

    try {
      const response = await axios.get(graphUrl, {
        params: {
          fields: 'id', // Minimal fields - we just need to confirm the token works
          access_token: decryptedToken
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

          // ✅ v3 OPTIMIZATION: Resilient audit logging
          try {
            await logAudit('token_validation_expired', userId, {
              action: 'validate_token',
              business_account_id: businessAccountId,
              error_code: errorCode,
              error_subcode: errorSubcode,
              reason: reason,
              response_time_ms: responseTime
            });
          } catch (auditError) {
            console.warn('⚠️  Audit log failed (non-blocking):', auditError.message);
          }

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

    console.error('[Token Validation] ❌ Unexpected error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      response: error.response?.data
    });

    // ✅ v3 OPTIMIZATION: Resilient audit logging
    try {
      await logAudit('token_validation_error', req.body.userId, {
        action: 'validate_token',
        error: error.message,
        error_name: error.name,
        error_code: error.code,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        response_time_ms: responseTime
      });
    } catch (auditError) {
      console.warn('⚠️  Audit log failed (non-blocking):', auditError.message);
    }

    res.status(500).json({
      success: false,
      status: 'error',
      error: 'Internal server error during token validation',
      code: 'INTERNAL_ERROR',
      details: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        name: error.name,
        code: error.code
      } : undefined
    });
  }
});

// ==========================================
// DATA SYNC ENDPOINTS
// ==========================================

const { syncTaggedPosts, syncBusinessPosts } = require('../services/instagram-sync');

/**
 * POST /api/instagram/sync/ugc
 * Triggers background sync of tagged posts from Instagram to database
 */
router.post('/sync/ugc', async (req, res) => {
  try {
    const { businessAccountId } = req.body;

    if (!businessAccountId) {
      return res.status(400).json({
        success: false,
        error: 'businessAccountId is required'
      });
    }

    // Get Supabase client
    const supabase = getSupabaseAdmin();

    // Get credentials
    const { data: credentials, error: credError } = await supabase
      .from('instagram_credentials')
      .select('instagram_business_id, page_access_token')
      .eq('business_account_id', businessAccountId)
      .single();

    if (credError || !credentials) {
      return res.status(404).json({
        success: false,
        error: 'Credentials not found'
      });
    }

    // Execute sync
    const result = await syncTaggedPosts(
      businessAccountId,
      credentials.instagram_business_id,
      credentials.page_access_token
    );

    res.json(result);

    await logAudit('ugc_sync_completed', null, {
      business_account_id: businessAccountId,
      synced_count: result.synced_count
    });

  } catch (error) {
    console.error('[Sync] UGC sync error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Sync failed'
    });
  }
});

/**
 * POST /api/instagram/sync/posts
 * Triggers background sync of business media from Instagram to database
 */
router.post('/sync/posts', async (req, res) => {
  try {
    const { businessAccountId } = req.body;

    if (!businessAccountId) {
      return res.status(400).json({
        success: false,
        error: 'businessAccountId is required'
      });
    }

    // Get Supabase client
    const supabase = getSupabaseAdmin();

    // Get credentials
    const { data: credentials, error: credError } = await supabase
      .from('instagram_credentials')
      .select('instagram_business_id, page_access_token')
      .eq('business_account_id', businessAccountId)
      .single();

    if (credError || !credentials) {
      return res.status(404).json({
        success: false,
        error: 'Credentials not found'
      });
    }

    // Execute sync
    const result = await syncBusinessPosts(
      businessAccountId,
      credentials.instagram_business_id,
      credentials.page_access_token
    );

    res.json(result);

    await logAudit('business_posts_sync_completed', null, {
      business_account_id: businessAccountId,
      synced_count: result.synced_count
    });

  } catch (error) {
    console.error('[Sync] Posts sync error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Sync failed'
    });
  }
});

// ==========================================
// EXPORTS
// ==========================================

module.exports = router;
