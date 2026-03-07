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
 *   - Supports CDN URLs (Supabase Storage, Cloudflare, S3, etc.)
 */
function validateImageUrl(url) {
  try {
    const parsedUrl = new URL(url);

    // Must use HTTPS
    if (parsedUrl.protocol !== 'https:') {
      return { valid: false, error: 'Media URL must use HTTPS protocol' };
    }

    // Check for localhost or private IPs (not allowed by Instagram)
    const hostname = parsedUrl.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.')) {
      return {
        valid: false,
        error: 'Media must be publicly accessible (not localhost or private IP)'
      };
    }

    // Check for valid image or video extension on pathname only (ignore query strings)
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.mov', '.avi'];
    const pathLower = parsedUrl.pathname.toLowerCase();
    const hasValidExtension = validExtensions.some(ext => pathLower.endsWith(ext));

    // Allow extensionless URLs from known CDN hostnames
    const isCdnHostname = /\.(supabase\.co|cloudflare\.com|amazonaws\.com|googleusercontent\.com|cdn\.|storage\.|digitaloceanspaces\.com|backblazeb2\.com|cloud\.apple\.com)$/.test(hostname);

    if (!hasValidExtension && !isCdnHostname) {
      return {
        valid: false,
        error: 'Media URL must have a valid image/video extension or be from a known CDN'
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
    const { userAccessToken, userId, selectedPage } = req.body;

    console.log('📥 Token exchange request received');
    console.log('   User ID (UUID):', userId || 'not provided');
    console.log('   Mode:', selectedPage ? 'page-selection' : 'full-exchange');

    // ===== STEP 1: Validate userId =====
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId (UUID) is required',
        code: 'MISSING_USER_ID'
      });
    }

    // ===== STEP 2: Resolve page token info =====
    // Either from a pre-selected page (multi-page picker) or by calling exchangeForPageToken
    let pageAccessToken, pageId, pageName, discoveredBusinessAccountId;

    if (selectedPage) {
      // Frontend sent back a selected page from the picker modal — use it directly
      ({ pageAccessToken, pageId, pageName, igBusinessAccountId: discoveredBusinessAccountId } = selectedPage);
      console.log('✅ Using selected page:', pageName, '/ IG:', discoveredBusinessAccountId);

    } else {
      // Normal flow — exchange user access token via Meta /me/accounts
      if (!userAccessToken) {
        return res.status(400).json({
          success: false,
          error: 'userAccessToken is required',
          code: 'MISSING_USER_TOKEN'
        });
      }

      console.log('🔄 Starting token exchange and IG account discovery...');
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

      // Multi-page: return list to frontend for picker modal — do NOT store yet
      if (exchangeResult.requiresSelection) {
        console.log('ℹ️  Multiple IG-linked pages found, returning list for picker');
        return res.status(200).json({
          success: true,
          requiresSelection: true,
          pages: exchangeResult.pages
        });
      }

      pageAccessToken = exchangeResult.pageAccessToken;
      pageId = exchangeResult.pageId;
      pageName = exchangeResult.pageName;
      discoveredBusinessAccountId = exchangeResult.igBusinessAccountId;
    }

    if (!discoveredBusinessAccountId) {
      return res.status(400).json({
        success: false,
        error: 'No Instagram Business Account found',
        code: 'NO_IG_BUSINESS_ACCOUNT'
      });
    }

    // ===== STEP 3: Collision check — is this IG account already owned by another user? =====
    const supabaseAdmin = getSupabaseAdmin();
    const { data: existingAccount } = await supabaseAdmin
      .from('instagram_business_accounts')
      .select('user_id, id')
      .eq('instagram_business_id', discoveredBusinessAccountId)
      .neq('user_id', userId)
      .maybeSingle();

    if (existingAccount) {
      console.warn(`⚠️  IG account ${discoveredBusinessAccountId} already owned by another user`);

      // Notify current owner via system_alerts (shows in their NotificationDropdown)
      await supabaseAdmin.from('system_alerts').insert({
        alert_type: 'account_transfer_request',
        business_account_id: existingAccount.id,
        message: 'Another user is requesting to connect your Instagram Business Account. Tap "Release" in this notification to transfer ownership.',
        details: {
          requesting_user_id: userId,
          instagram_business_id: discoveredBusinessAccountId,
          requested_at: new Date().toISOString()
        },
        resolved: false
      });

      // Record the request on the account row for easy cleanup
      await supabaseAdmin.from('instagram_business_accounts')
        .update({
          transfer_requested_by: userId,
          transfer_requested_at: new Date().toISOString()
        })
        .eq('id', existingAccount.id);

      return res.status(409).json({
        success: false,
        error: 'This Instagram account is already connected to another user. The current owner has been notified and can release it.',
        errorCode: 'ACCOUNT_ALREADY_CONNECTED'
      });
    }

    // ===== STEP 4: Store the page token =====
    console.log('💾 Storing token and creating business account record...');

    const storeResult = await storePageToken({
      userId,
      igBusinessAccountId: discoveredBusinessAccountId,
      pageAccessToken,
      pageId,
      pageName
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
    clearCredentialCache(storeResult.businessAccountId);

    // ===== STEP 5: Return success =====
    return res.status(200).json({
      success: true,
      message: 'Token exchange and storage successful',
      data: {
        businessAccountId: storeResult.businessAccountId,
        instagramBusinessId: discoveredBusinessAccountId,
        pageId,
        pageName
      }
    });

  } catch (error) {
    console.error('❌ Token exchange error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error during token exchange',
      message: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// ==========================================
// ACCOUNT TRANSFER / RELEASE
// ==========================================

/**
 * POST /api/instagram/release-account
 * Current owner releases their IG account so a requesting user can connect it.
 * Called when user clicks "Release Account" in the NotificationDropdown.
 */
router.post('/release-account', async (req, res) => {
  try {
    const { userId, instagramBusinessId } = req.body;

    if (!userId || !instagramBusinessId) {
      return res.status(400).json({ error: 'userId and instagramBusinessId are required' });
    }

    const supabase = getSupabaseAdmin();

    // Deactivate credentials for this user
    await supabase
      .from('instagram_credentials')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('token_type', 'page');

    // Delete the business account row so the requesting user can claim it
    const { error: deleteError } = await supabase
      .from('instagram_business_accounts')
      .delete()
      .eq('user_id', userId)
      .eq('instagram_business_id', instagramBusinessId);

    if (deleteError) {
      console.error('❌ release-account delete failed:', deleteError.message);
      return res.status(500).json({ error: 'Failed to release account', details: deleteError.message });
    }

    // Resolve the pending transfer alert so it disappears from owner's notification centre
    await supabase
      .from('system_alerts')
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq('alert_type', 'account_transfer_request')
      .filter('details->>instagram_business_id', 'eq', instagramBusinessId);

    console.log(`✅ Account ${instagramBusinessId} released by user ${userId}`);
    return res.json({ success: true, message: 'Account released. The requesting user can now reconnect.' });

  } catch (error) {
    console.error('❌ release-account error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// ==========================================
// INSTAGRAM API ROUTES
// ==========================================
// All routes automatically rate limited and logged

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
      .eq('token_type', 'page')
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

      // ===== STEP 6: Encrypt the refreshed token then update database =====
      const { data: newEncryptedToken, error: encryptErr } = await supabase
        .rpc('encrypt_instagram_token', { token: access_token });

      if (encryptErr || !newEncryptedToken) {
        console.error('[Token] ❌ Failed to encrypt refreshed token:', encryptErr?.message);
        throw new Error(`Failed to encrypt refreshed token: ${encryptErr?.message || 'null result'}`);
      }

      const { error: updateError } = await supabase
        .from('instagram_credentials')
        .update({
          access_token_encrypted: newEncryptedToken,
          expires_at: newExpiresAt.toISOString(),
          last_refreshed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('business_account_id', businessAccountId)
        .eq('token_type', 'page');

      if (updateError) {
        console.error('[Token] ❌ Database update failed:', updateError.message);
        throw updateError;
      }

      console.log('[Token] ✅ Database updated with encrypted token and new expiration');

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
 * 1. Retrieve and decrypt access_token_encrypted from instagram_credentials table
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

    // Page tokens are non-expiring per Meta documentation.
    // Token health is validated via the daily /debug_token cron (proactive-sync.js).
    // 190 errors from live Instagram API calls mark the token inactive immediately.

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

    // Get instagram_business_id and user_id from the business accounts table
    const { data: bizAccount, error: bizError } = await supabase
      .from('instagram_business_accounts')
      .select('user_id, instagram_business_id')
      .eq('id', businessAccountId)
      .single();

    if (bizError || !bizAccount) {
      return res.status(404).json({
        success: false,
        error: 'Business account not found'
      });
    }

    // Retrieve and decrypt the page token via the proper token service
    let pageToken;
    try {
      pageToken = await retrievePageToken(bizAccount.user_id, businessAccountId);
    } catch (tokenErr) {
      return res.status(401).json({
        success: false,
        error: tokenErr.message,
        code: tokenErr.code || 'TOKEN_ERROR'
      });
    }

    // Execute sync
    const result = await syncTaggedPosts(
      businessAccountId,
      bizAccount.instagram_business_id,
      pageToken
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

    // Get instagram_business_id and user_id from the business accounts table
    const { data: bizAccount, error: bizError } = await supabase
      .from('instagram_business_accounts')
      .select('user_id, instagram_business_id')
      .eq('id', businessAccountId)
      .single();

    if (bizError || !bizAccount) {
      return res.status(404).json({
        success: false,
        error: 'Business account not found'
      });
    }

    // Retrieve and decrypt the page token via the proper token service
    let pageToken;
    try {
      pageToken = await retrievePageToken(bizAccount.user_id, businessAccountId);
    } catch (tokenErr) {
      return res.status(401).json({
        success: false,
        error: tokenErr.message,
        code: tokenErr.code || 'TOKEN_ERROR'
      });
    }

    // Execute sync
    const result = await syncBusinessPosts(
      businessAccountId,
      bizAccount.instagram_business_id,
      pageToken
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
