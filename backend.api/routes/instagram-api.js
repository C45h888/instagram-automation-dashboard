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
 * Validate image URL for Instagram posting
 * Requirements:
 *   - Must be HTTPS
 *   - Must be publicly accessible
 *   - Must be a valid image format
 */
function validateImageUrl(url) {
  try {
    const parsedUrl = new URL(url);

    // Must use HTTPS
    if (parsedUrl.protocol !== 'https:') {
      return { valid: false, error: 'Image URL must use HTTPS protocol' };
    }

    // Check for valid image extension
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif'];
    const hasValidExtension = validExtensions.some(ext =>
      parsedUrl.pathname.toLowerCase().endsWith(ext)
    );

    if (!hasValidExtension) {
      return {
        valid: false,
        error: 'Image URL must end with .jpg, .jpeg, .png, or .gif'
      };
    }

    // Check for localhost or private IPs (not allowed by Instagram)
    const hostname = parsedUrl.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.')) {
      return {
        valid: false,
        error: 'Image must be publicly accessible (not localhost or private IP)'
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
    const graphApiUrl = `https://graph.facebook.com/v18.0/${igAccountId}/media`;

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
router.post('/create-post', async (req, res) => {
  const requestStartTime = Date.now();

  try {
    const { userId, businessAccountId, caption, image_url } = req.body;

    // ===== VALIDATION =====
    if (!userId || !businessAccountId || !caption || !image_url) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, businessAccountId, caption, image_url',
        code: 'MISSING_FIELDS'
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

    console.log('🚀 Starting 2-step post creation...');

    // ===== TOKEN RETRIEVAL =====
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
      const containerUrl = `https://graph.facebook.com/v18.0/${igUserId}/media`;
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
      const publishUrl = `https://graph.facebook.com/v18.0/${igUserId}/media_publish`;
      const publishResponse = await axios.post(publishUrl, null, {
        params: {
          creation_id: creationId,
          access_token: pageToken
        },
        timeout: 15000
      });

      mediaId = publishResponse.data.id;
      console.log(`   ✅ Step 2 Success: Post is live! media_id = ${mediaId}`);

      const responseTime = Date.now() - requestStartTime;

      await logAudit('instagram_post_published', userId, {
        action: 'create_post_step_2',
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
        permalink: `https://www.instagram.com/p/${mediaId}/` // Note: This format may not work for all IDs
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
// EXPORTS
// ==========================================

module.exports = router;
