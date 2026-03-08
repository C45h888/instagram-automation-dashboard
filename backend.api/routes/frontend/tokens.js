// backend.api/routes/frontend/tokens.js
// Token management routes: exchange, release, refresh, validate
const express = require('express');
const router = express.Router();
const axios = require('axios');
const {
  exchangeForPageToken,
  storePageToken,
  retrievePageToken,
  logAudit: logAuditService
} = require('../../services/instagram-tokens');
const { getSupabaseAdmin } = require('../../config/supabase');
const { clearCredentialCache } = require('../../helpers/agent-helpers');

const logAudit = logAuditService;
const GRAPH_API_VERSION = 'v23.0';

// ==========================================
// HELPER FUNCTIONS
// ==========================================

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
  // Check cache first
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

    // Update cache
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
// ROUTES
// ==========================================

/**
 * POST /api/instagram/exchange-token
 * Exchange user access token for page access token with AUTO-DISCOVERY
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
    let pageAccessToken, pageId, pageName, discoveredBusinessAccountId;

    if (selectedPage) {
      ({ pageAccessToken, pageId, pageName, igBusinessAccountId: discoveredBusinessAccountId } = selectedPage);
      console.log('✅ Using selected page:', pageName, '/ IG:', discoveredBusinessAccountId);

    } else {
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

      // Multi-page: return list to frontend for picker modal
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

    // ===== STEP 3: Collision check =====
    const supabaseAdmin = getSupabaseAdmin();
    const { data: existingAccount } = await supabaseAdmin
      .from('instagram_business_accounts')
      .select('user_id, id')
      .eq('instagram_business_id', discoveredBusinessAccountId)
      .neq('user_id', userId)
      .maybeSingle();

    if (existingAccount) {
      console.warn(`⚠️  IG account ${discoveredBusinessAccountId} already owned by another user`);

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

/**
 * POST /api/instagram/release-account
 * Current owner releases their IG account so a requesting user can connect it.
 */
router.post('/release-account', async (req, res) => {
  try {
    const { userId, instagramBusinessId } = req.body;

    if (!userId || !instagramBusinessId) {
      return res.status(400).json({ error: 'userId and instagramBusinessId are required' });
    }

    const supabase = getSupabaseAdmin();

    await supabase
      .from('instagram_credentials')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('token_type', 'page');

    const { error: deleteError } = await supabase
      .from('instagram_business_accounts')
      .delete()
      .eq('user_id', userId)
      .eq('instagram_business_id', instagramBusinessId);

    if (deleteError) {
      console.error('❌ release-account delete failed:', deleteError.message);
      return res.status(500).json({ error: 'Failed to release account', details: deleteError.message });
    }

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

/**
 * POST /api/instagram/refresh-token
 * Manually refresh a user's Instagram access token
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

    // ===== STEP 2: SMART PRE-CHECK =====
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

    // Page tokens are non-expiring (expires_at = null). Only run the pre-check
    // for legacy rows that have an explicit expiry timestamp.
    if (credentials.expires_at !== null && credentials.expires_at !== undefined) {
      const expiresAt = new Date(credentials.expires_at);
      const now = new Date();

      if (expiresAt < now) {
        console.error('[Token] ❌ Token already expired');

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
    }

    console.log('[Token] ✅ Proceeding with refresh');

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
          client_id: process.env.INSTAGRAM_APP_ID || process.env.FACEBOOK_APP_ID,
          client_secret: process.env.INSTAGRAM_APP_SECRET || process.env.FACEBOOK_APP_SECRET,
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

      // ===== STEP 6: Encrypt and update database =====
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
      if (refreshError.response) {
        const { status, data } = refreshError.response;
        const errorCode = data?.error?.code;
        const errorMessage = data?.error?.message || 'Token refresh failed';

        console.error(`[Token] ❌ Meta API error (${status}):`, data);

        if (errorCode === 190) {
          console.error('[Token] ❌ Meta returned error 190 - Token invalid/expired');

          await logAudit('token_refresh_expired_by_meta', userId, {
            action: 'refresh_token',
            business_account_id: businessAccountId,
            error_code: errorCode,
            error_message: errorMessage,
            response_time_ms: Date.now() - requestStartTime
          });

          // Insert auth_failure system_alert so the notification bell lights up.
          try {
            const { data: existingAlert } = await supabase
              .from('system_alerts')
              .select('id')
              .eq('business_account_id', businessAccountId)
              .eq('alert_type', 'auth_failure')
              .eq('resolved', false)
              .maybeSingle();

            if (!existingAlert) {
              await supabase.from('system_alerts').insert({
                alert_type: 'auth_failure',
                business_account_id: businessAccountId,
                message: 'Instagram access token is no longer valid. Please reconnect your account.',
                details: { user_id: userId, source: 'refresh_token' },
                resolved: false
              });
            }
          } catch (alertErr) {
            console.warn('[Token] ⚠️  system_alert insert failed (non-blocking):', alertErr.message);
          }

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

/**
 * POST /api/instagram/validate-token
 * Validates if the stored Instagram access token is still active
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

      const { instagramBusinessId } = req.body;

      if (!userId || !pageAccessToken || !instagramBusinessId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields for import',
          required: ['userId', 'pageAccessToken', 'instagramBusinessId']
        });
      }

      const validation = await validateMetaToken(pageAccessToken, instagramBusinessId);

      if (!validation.success) {
        console.error('❌ Token validation failed:', validation.error);

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

      const detectedScope = await fetchDynamicScope(pageAccessToken, supabase, null);

      const storeResult = await storePageToken({
        userId,
        igBusinessAccountId: instagramBusinessId,
        pageAccessToken,
        pageId: pageId || instagramBusinessId,
        pageName: pageName || 'Imported Account',
        scope: detectedScope
      });

      if (!storeResult.success) {
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

    // ===== VALIDATION MODE =====
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

    // ===== STEP 2: Fetch instagram_business_id =====
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

    // ===== STEP 4: Use instagram_business_id =====
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

    // ===== STEP 5: Validate token by calling Meta API =====
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
          fields: 'id',
          access_token: decryptedToken
        },
        timeout: 5000
      });

      const responseTime = Date.now() - requestStartTime;

      console.log(`[Token Validation] ✅ Token is active (${responseTime}ms)`);

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

      if (validationError.response) {
        const { status, data } = validationError.response;
        const errorCode = data?.error?.code;
        const errorSubcode = data?.error?.error_subcode;
        const errorType = data?.error?.type;
        const errorMessage = data?.error?.message;

        console.error('[Token Validation] ❌ Meta API Error:', {
          status,
          code: errorCode,
          subcode: errorSubcode,
          type: errorType,
          message: errorMessage
        });

        if (errorCode === 190 || status === 401 || errorType === 'OAuthException') {
          let reason = 'Token expired or invalid';

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

          // Insert auth_failure system_alert so the notification bell lights up.
          // Only insert if no unresolved alert already exists (prevents duplicates).
          try {
            const { data: existingAlert } = await supabase
              .from('system_alerts')
              .select('id')
              .eq('business_account_id', businessAccountId)
              .eq('alert_type', 'auth_failure')
              .eq('resolved', false)
              .maybeSingle();

            if (!existingAlert) {
              await supabase.from('system_alerts').insert({
                alert_type: 'auth_failure',
                business_account_id: businessAccountId,
                message: 'Instagram access token is no longer valid. Please reconnect your account.',
                details: { user_id: userId, reason, source: 'validate_token' },
                resolved: false
              });
            }
          } catch (alertErr) {
            console.warn('[Token Validation] ⚠️  system_alert insert failed (non-blocking):', alertErr.message);
          }

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

module.exports = router;
