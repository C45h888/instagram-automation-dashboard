// backend.api/routes/instagram-api.js (NEW FILE)
const express = require('express');
const router = express.Router();
const { instagramAPIRateLimiter, logAfterResponse } = require('../middleware/rate-limiter');
const {
  exchangeForPageToken,
  getAccountInsights,
  storePageToken,
  retrievePageToken
} = require('../services/instagram-tokens');

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
 * Get Instagram media
 *
 * Rate limited: 200 calls/hour per user
 * Logged: Every call tracked in api_usage table
 *
 * @route GET /api/instagram/media/:accountId
 * @param {string} accountId - Instagram business account ID
 * @query {number} limit - Number of media items (default 25)
 * @returns {Object} Media items with rate limit remaining
 */
router.get('/media/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    const { limit = 25 } = req.query;

    console.log(`🖼️  Fetching media for account: ${accountId} (limit: ${limit})`);

    // ===== YOUR INSTAGRAM API CALL HERE =====
    // Example placeholder response
    const media = {
      account_id: accountId,
      items: [
        {
          id: 'media_1',
          type: 'IMAGE',
          caption: 'Example post',
          timestamp: new Date().toISOString()
        }
        // ... more media items
      ],
      count: 1
    };

    // Include rate limit remaining in response
    res.json({
      success: true,
      data: media,
      rate_limit: {
        remaining: req.rateLimitRemaining || 'unknown',
        limit: 200,
        window: '1 hour'
      }
    });
  } catch (error) {
    console.error('❌ Media error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'MEDIA_ERROR'
    });
  }
});

/**
 * Get Instagram comments
 *
 * Rate limited: 200 calls/hour per user
 * Logged: Every call tracked in api_usage table
 *
 * @route GET /api/instagram/comments/:mediaId
 * @param {string} mediaId - Instagram media ID
 * @returns {Object} Comments with rate limit remaining
 */
router.get('/comments/:mediaId', async (req, res) => {
  try {
    const { mediaId } = req.params;

    console.log(`💬 Fetching comments for media: ${mediaId}`);

    // ===== YOUR INSTAGRAM API CALL HERE =====
    // Example placeholder response
    const comments = {
      media_id: mediaId,
      items: [
        {
          id: 'comment_1',
          text: 'Great post!',
          from: {
            id: 'user_1',
            username: 'john_doe'
          },
          timestamp: new Date().toISOString()
        }
        // ... more comments
      ],
      count: 1
    };

    // Include rate limit remaining in response
    res.json({
      success: true,
      data: comments,
      rate_limit: {
        remaining: req.rateLimitRemaining || 'unknown',
        limit: 200,
        window: '1 hour'
      }
    });
  } catch (error) {
    console.error('❌ Comments error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'COMMENTS_ERROR'
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
// EXPORTS
// ==========================================

module.exports = router;
