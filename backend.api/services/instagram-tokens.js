// backend.api/services/instagram-tokens.js
// Token management service — modularised for PAT-first architecture.
// Layout: Configuration → Shared (detection/scope) → PAT ops → UAT ops → Insights → Exports
const axios = require('axios');
const { getSupabaseAdmin } = require('../config/supabase');
// NOTE: clearCredentialCache is required lazily inside functions to avoid
// circular dependency: instagram-tokens → agent-helpers → instagram-tokens

// ==========================================
// CONFIGURATION
// ==========================================

const GRAPH_API_VERSION = 'v23.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// Safe metrics - work for all Instagram Business/Creator accounts
// ✅ FIXED: Changed 'impressions' to 'accounts_engaged' (Meta API error 100 - impressions not valid)
const SAFE_METRICS = [
  'accounts_engaged',
  'reach',
  'profile_views'
];

// Default metrics - includes optional metrics that require specific account setup
// Note: website_clicks requires a website URL in Instagram profile
const DEFAULT_METRICS = [
  ...SAFE_METRICS,
  'website_clicks'
];

// Comprehensive PAT scope set — used as fallback when /debug_token is unavailable.
// Matches the full permission set granted via Facebook Login for Business.
const PAT_SCOPE_DEFAULTS = [
  'instagram_basic',
  'instagram_manage_comments',
  'instagram_manage_insights',
  'instagram_content_publish',
  'instagram_manage_messages',
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_metadata',
  'pages_read_user_content',
  'pages_manage_posts',
  'pages_manage_engagement'
];

// ==========================================
// SHARED: TOKEN DETECTION & SCOPE
// ==========================================

/**
 * Detect token type and metadata via Meta's /debug_token endpoint.
 * Used by exchange, import, and validation flows to differentiate UAT from PAT.
 *
 * @param {string} token - Any Meta access token (UAT or PAT)
 * @returns {Promise<{isValid: boolean, type: string, scopes: string[], expiresAt: number, issuedAt: number, userId: string, appId: string}|null>}
 */
async function detectTokenType(token) {
  try {
    const response = await axios.get(`${GRAPH_API_BASE}/debug_token`, {
      params: { input_token: token, access_token: token },
      timeout: 5000
    });
    const data = response.data.data;
    return {
      isValid: data.is_valid,
      type: data.type,               // 'USER' or 'PAGE'
      appId: data.app_id,
      scopes: data.scopes || [],
      expiresAt: data.expires_at,     // 0 = never expires
      issuedAt: data.issued_at,
      userId: data.user_id,
      dataAccessExpiresAt: data.data_access_expires_at || null  // unix timestamp, separate from token expiry
    };
  } catch (err) {
    console.warn('⚠️ Token type detection failed:', err.message);
    return null;
  }
}

/**
 * Fetches dynamic scope from Meta /debug_token API with 7-day caching.
 * Moved from routes/frontend/tokens.js to service layer for shared use.
 *
 * @param {string} token - Access token to inspect
 * @param {object} supabase - Supabase client
 * @param {string} credentialId - Credential record ID for caching (optional)
 * @returns {Promise<string[]>} Array of scope strings
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
      `${GRAPH_API_BASE}/debug_token`,
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
    console.warn('⚠️  Scope detection failed, using PAT defaults');
    return PAT_SCOPE_DEFAULTS;
  }
}

// ==========================================
// PAT: PAGE ACCESS TOKEN OPERATIONS
// ==========================================

/**
 * Exchange user access token for page token AND discover IG Business Account
 *
 * UPDATED: Now returns success object with consistent error handling
 * Required for instagram_manage_insights permission
 * Meta's architecture requires page-level tokens for analytics APIs
 *
 * Process:
 * 1. Query user's Facebook pages (/me/accounts)
 * 2. Extract page access token from first page
 * 3. Query Instagram Business account connected to page
 * 4. Return success object with page token + Instagram account mapping
 *
 * @param {string} userAccessToken - User's Instagram/Facebook access token
 * @returns {Promise<{success: boolean, pageAccessToken?: string, pageId?: string, pageName?: string, igBusinessAccountId?: string, error?: string}>}
 */
async function exchangeForPageToken(userAccessToken) {
  try {
    console.log('🔄 Starting page token exchange...');
    console.log('   User token length:', userAccessToken?.length || 0);

    // ===== STEP 1: Get user's Facebook pages =====
    // Users must have a Facebook page connected to their Instagram Business account
    console.log('📄 Step 1: Fetching user\'s Facebook pages...');

    const pagesResponse = await axios.get(
      `${GRAPH_API_BASE}/me/accounts`,
      {
        params: {
          fields: 'id,name,access_token,instagram_business_account',
          access_token: userAccessToken
        },
        timeout: 10000 // 10 second timeout
      }
    );

    const pages = pagesResponse.data.data;

    console.log(`   Found ${pages?.length || 0} Facebook page(s)`);

    // ===== STEP 2: Validate pages exist =====
    if (!pages || pages.length === 0) {
      console.error('❌ No Facebook pages found for user');
      return {
        success: false,
        error: 'No Facebook pages found. Please ensure you have a Facebook Page connected to your account.'
      };
    }

    // ===== STEP 3: Filter all pages with an Instagram Business account =====
    const pagesWithIG = pages.filter(
      page => page.instagram_business_account && page.instagram_business_account.id
    );

    if (pagesWithIG.length === 0) {
      console.error('❌ No Instagram Business account connected to any page');
      const pageNames = pages.map(p => p.name).join(', ');
      console.error(`   Pages found: ${pageNames}`);
      return {
        success: false,
        error: 'No Instagram Business Account connected. Please connect an Instagram Business Account to your Facebook Page.',
        errorCode: 'NO_IG_BUSINESS_ACCOUNT'
      };
    }

    // ===== STEP 4: Return — single page auto-selects, multiple pages require picker =====
    if (pagesWithIG.length === 1) {
      const page = pagesWithIG[0];
      console.log(`✅ Auto-selected Facebook page: "${page.name}" (ID: ${page.id})`);
      console.log(`✅ Instagram Business account: ${page.instagram_business_account.id}`);
      return {
        success: true,
        requiresSelection: false,
        pageAccessToken: page.access_token,
        pageId: page.id,
        pageName: page.name,
        igBusinessAccountId: page.instagram_business_account.id,
        tokenType: 'page'
      };
    }

    // Multiple pages — return full list for frontend page picker modal
    console.log(`⚠️  Multiple pages with IG accounts found (${pagesWithIG.length}), returning list for picker`);
    return {
      success: true,
      requiresSelection: true,
      pages: pagesWithIG.map(page => ({
        pageId: page.id,
        pageName: page.name,
        pageAccessToken: page.access_token,
        igBusinessAccountId: page.instagram_business_account.id
      }))
    };

  } catch (error) {
    console.error('❌ Page token exchange failed');
    console.error('   Error type:', error.constructor.name);
    console.error('   Error message:', error.message);

    // ===== Handle Graph API errors =====
    if (error.response) {
      const apiError = error.response.data?.error;
      console.error('   Facebook Graph API Error:', apiError);

      // Provide actionable error messages
      if (apiError?.code === 190) {
        return {
          success: false,
          error: 'Invalid or expired user access token. User must reconnect their Instagram account through OAuth.'
        };
      }

      if (apiError?.code === 100) {
        return {
          success: false,
          error: 'Invalid API request. Check that all required permissions (pages_show_list, instagram_basic) are granted.'
        };
      }

      if (apiError?.message) {
        return {
          success: false,
          error: `Facebook API Error: ${apiError.message}`
        };
      }
    }

    // ===== Handle network errors =====
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return {
        success: false,
        error: 'Unable to connect to Facebook Graph API. Check network connection and try again.'
      };
    }

    // ===== Return error response =====
    return {
      success: false,
      error: error.message || 'Page token exchange failed'
    };
  }
}

// ==========================================
// INSIGHTS API FUNCTIONS
// ==========================================

/**
 * Get account insights using page token
 *
 * Requires instagram_manage_insights permission and page-level token
 * User tokens will NOT work for this endpoint
 *
 * @param {string} igBusinessAccountId - Instagram Business account ID
 * @param {string} pageToken - Page access token (NOT user token)
 * @param {Object} options - Query options
 * @param {string} options.period - Time period (e.g., '7d', '30d', '90d')
 * @param {string[]} options.metrics - Array of metric names
 * @returns {Promise<{success: boolean, data: Object, period: Object, metrics: string[]}>}
 * @throws {Error} If API error or invalid token
 */
async function getAccountInsights(igBusinessAccountId, pageToken, options = {}) {
  try {
    const {
      period = '7d',
      metrics = DEFAULT_METRICS,
      until: untilParam  // ✅ FIXED: Accept until parameter for previous period queries
    } = options;

    // ===== STEP 1: Parse and validate period =====
    const periodMatch = period.match(/^(\d+)d$/);
    if (!periodMatch) {
      throw new Error(`Invalid period format: ${period}. Use format: '7d', '30d', '90d'`);
    }

    const periodDays = parseInt(periodMatch[1]);

    if (periodDays < 1 || periodDays > 90) {
      throw new Error(`Period must be between 1 and 90 days. Got: ${periodDays}`);
    }

    // ===== STEP 2: Calculate date range (Unix timestamps) =====
    // ✅ FIXED: Use provided until timestamp if available, otherwise use current time
    const until = untilParam || Math.floor(Date.now() / 1000);
    const since = until - (periodDays * 24 * 60 * 60);

    console.log(`📊 Fetching insights for account: ${igBusinessAccountId}`);
    console.log(`   Period: ${periodDays} days (${new Date(since * 1000).toISOString()} to ${new Date(until * 1000).toISOString()})`);
    console.log(`   Until param: ${untilParam ? 'provided' : 'using current time'}`);
    console.log(`   Metrics requested: ${metrics.join(', ')}`);

    // ===== STEP 3: Call Instagram Insights API with FALLBACK STRATEGY =====
    // ✅ REFACTORED: Try with all metrics first, fallback to safe metrics if error 100
    let response;
    let actualMetrics = metrics;
    let usedFallback = false;

    try {
      // First attempt: Try with requested metrics (may include website_clicks)
      response = await axios.get(
        `${GRAPH_API_BASE}/${igBusinessAccountId}/insights`,
        {
          params: {
            metric: metrics.join(','),
            period: 'day',
            since,
            until,
            access_token: pageToken
          },
          timeout: 15000
        }
      );
    } catch (firstAttemptError) {
      // Check if error is code 100 (invalid parameter/missing permission)
      const apiError = firstAttemptError.response?.data?.error;

      if (apiError?.code === 100 && metrics.includes('website_clicks')) {
        // ✅ FALLBACK: Retry with safe metrics only
        console.warn('⚠️  Error 100 detected - website_clicks likely unavailable');
        console.warn('   Retrying with safe metrics only (accounts_engaged, reach, profile_views)...');

        try {
          response = await axios.get(
            `${GRAPH_API_BASE}/${igBusinessAccountId}/insights`,
            {
              params: {
                metric: SAFE_METRICS.join(','),
                period: 'day',
                since,
                until,
                access_token: pageToken
              },
              timeout: 15000
            }
          );

          actualMetrics = SAFE_METRICS;
          usedFallback = true;
          console.log('✅ Fallback successful - using safe metrics');

        } catch (fallbackError) {
          // Fallback also failed - re-throw original error
          throw firstAttemptError;
        }
      } else {
        // Not a code 100 error or no website_clicks - re-throw
        throw firstAttemptError;
      }
    }

    // ===== STEP 4: Check for API errors in response =====
    if (response.data.error) {
      console.error('❌ Instagram API returned error:', response.data.error);
      throw new Error(`Instagram API Error: ${response.data.error.message}`);
    }

    // ===== STEP 5: Validate and format response =====
    const insightsData = response.data.data;

    if (!insightsData || !Array.isArray(insightsData)) {
      console.warn('⚠️  Unexpected insights response format');
      console.warn('   Response:', JSON.stringify(response.data, null, 2));
    }

    console.log('✅ Account insights retrieved successfully');
    console.log(`   Returned ${insightsData?.length || 0} metric(s)`);
    if (usedFallback) {
      console.log(`   ⚠️  Note: website_clicks unavailable (account may not have website URL configured)`);
    }

    return {
      success: true,
      data: insightsData,
      period: {
        since,
        until,
        days: periodDays,
        start_date: new Date(since * 1000).toISOString(),
        end_date: new Date(until * 1000).toISOString()
      },
      metrics: actualMetrics,  // ✅ Return actual metrics used (may be fallback)
      usedFallback  // ✅ Indicate if fallback was used
    };

  } catch (error) {
    console.error('❌ Failed to fetch account insights');
    console.error('   Error type:', error.constructor.name);
    console.error('   Error message:', error.message);

    // ===== Handle Graph API errors =====
    if (error.response?.data) {
      const apiError = error.response.data.error;
      console.error('   Instagram API Error:', apiError);

      // Provide actionable error messages
      if (apiError?.code === 190) {
        throw new Error(
          'Invalid or expired page token. User must reconnect their Instagram account.'
        );
      }

      if (apiError?.code === 100) {
        throw new Error(
          'Invalid parameter or missing permission. Ensure instagram_manage_insights permission is granted and user has a Business account.'
        );
      }

      if (apiError?.code === 17 || apiError?.code === 4 || apiError?.code === 32 || apiError?.code === 613) {
        throw new Error(
          'Instagram API rate limit exceeded. Please wait before retrying.'
        );
      }

      if (apiError?.message) {
        throw new Error(`Instagram API Error: ${apiError.message}`);
      }
    }

    // ===== Re-throw with context =====
    throw error;
  }
}

// ==========================================
// DATABASE OPERATIONS
// ==========================================

/**
 * Store page token in database with encryption
 *
 * UPDATED: Now creates/updates business account record first, then stores token
 * Uses Supabase encryption functions to secure token at rest
 * Upserts to handle token refresh scenarios
 *
 * @param {Object} params - Parameters object
 * @param {string} params.userId - User's UUID from Supabase Auth
 * @param {string} params.igBusinessAccountId - Instagram Business account ID (numeric)
 * @param {string} params.pageAccessToken - Page access token to encrypt and store
 * @param {string} params.pageId - Facebook Page ID
 * @param {string} params.pageName - Facebook Page name
 * @returns {Promise<{success: boolean, businessAccountId?: string, expiresAt?: string, error?: string}>}
 */
async function storePageToken({ userId, igBusinessAccountId, pageAccessToken, pageId, pageName, scope }) {
  try {
    console.log('💾 Storing page token in database...');
    console.log('   User ID (UUID):', userId);
    console.log('   IG Business Account ID:', igBusinessAccountId);
    console.log('   Page ID:', pageId);
    console.log('   Page Name:', pageName);

    // ===== STEP 1: Get Supabase client =====
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return {
        success: false,
        error: 'Database not available - Supabase client not initialized'
      };
    }

    // ===== STEP 2: Validate required fields =====
    if (!pageName) {
      console.error('❌ Missing required field: pageName');
      return {
        success: false,
        error: 'pageName is required but was not provided'
      };
    }

    // ===== STEP 2.5: Provision or retrieve per-user Vault encryption key =====
    let encryptionKeyId = null;
    try {
      // Check if user already has a key from a previous store
      const { data: existingAccount } = await supabase
        .from('instagram_business_accounts')
        .select('encryption_key_id')
        .eq('user_id', userId)
        .eq('instagram_business_id', igBusinessAccountId)
        .maybeSingle();

      if (existingAccount?.encryption_key_id) {
        encryptionKeyId = existingAccount.encryption_key_id;
        console.log('🔑 Reusing existing per-user Vault key:', encryptionKeyId);
      } else {
        // Create a new Vault secret for this user
        const crypto = require('crypto');
        const userKey = crypto.randomBytes(32).toString('hex');
        const { data: vaultSecret, error: vaultError } = await supabase
          .schema('vault')
          .from('secrets')
          .insert({
            name: `instagram_token_key_${userId}`,
            secret: userKey,
            description: `Per-user Instagram token encryption key for user ${userId}`
          })
          .select('id')
          .single();

        if (vaultError) {
          console.warn('⚠️  Per-user Vault key creation failed, using shared key:', vaultError.message);
        } else {
          encryptionKeyId = vaultSecret.id;
          console.log('🔑 Created per-user Vault key:', encryptionKeyId);
        }
      }
    } catch (keyErr) {
      console.warn('⚠️  Key provisioning error, using shared key:', keyErr.message);
    }

    // ===== STEP 2.8: Resolve scope early — needed by both business account and credential upserts =====
    // Priority: 1) Passed scope, 2) PAT_SCOPE_DEFAULTS (comprehensive fallback)
    const finalScope = scope || PAT_SCOPE_DEFAULTS;
    console.log('📋 Using scope:', finalScope.length, 'permissions');

    // ===== STEP 3: Create/Update business account record FIRST =====
    console.log('📝 Creating/updating Instagram business account record...');

    const { data: businessAccount, error: accountError } = await supabase
      .from('instagram_business_accounts')
      .upsert({
        user_id: userId,
        instagram_business_id: igBusinessAccountId,
        name: pageName,
        username: pageName, // Use page name as username initially
        is_connected: true,
        connection_status: 'active',
        encryption_key_id: encryptionKeyId,
        granted_permissions: finalScope,
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,instagram_business_id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (accountError) {
      console.error('❌ Failed to create/update business account:', accountError);
      return {
        success: false,
        error: `Failed to create business account: ${accountError.message}`
      };
    }

    console.log('✅ Business account record created/updated');
    console.log('   Business Account UUID:', businessAccount.id);

    // ===== STEP 4: Encrypt page token using Supabase function =====
    console.log('🔐 Encrypting page token...');

    const { data: encryptedToken, error: encryptError } = await supabase
      .rpc('encrypt_instagram_token', { token: pageAccessToken, p_key_id: encryptionKeyId });

    if (encryptError) {
      console.error('❌ Token encryption failed:', encryptError);
      return {
        success: false,
        error: `Token encryption failed: ${encryptError.message}`
      };
    }

    if (!encryptedToken) {
      return {
        success: false,
        error: 'Encryption returned null - check Supabase encryption function'
      };
    }

    console.log('✅ Token encrypted successfully');

    // Page access tokens are non-expiring per Meta documentation.
    // We store NULL for expires_at. Token health is validated via daily /debug_token cron.
    const finalExpiresAt = null;
    console.log('📅 Token expiration: NULL (page tokens are non-expiring)');

    // ===== STEP 6: Upsert to instagram_credentials table =====
    // Now we have a valid business_account_id (UUID) to use
    const { data: credentialData, error: credentialError } = await supabase
      .from('instagram_credentials')
      .upsert({
        user_id: userId,
        business_account_id: businessAccount.id, // Use the UUID from business account
        access_token_encrypted: encryptedToken,
        token_type: 'page',
        page_id: pageId,  // ✅ v2: Add page_id
        scope: finalScope,  // ✅ v3: Use smart defaults
        issued_at: new Date().toISOString(),
        expires_at: finalExpiresAt,  // null — page tokens are non-expiring
        is_active: true,
        last_refreshed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,business_account_id,token_type'
      })
      .select();

    if (credentialError) {
      console.error('❌ Credential upsert failed:', credentialError);
      return {
        success: false,
        error: `Failed to store credentials: ${credentialError.message}`
      };
    }

    console.log('✅ Page token stored in database');
    console.log('   Credential Record ID:', credentialData?.[0]?.id);

    // ===== STEP 7: Resilient audit logging (v3 OPTIMIZATION) =====
    try {
      const { logAudit } = require('../config/supabase');
      await logAudit('token_stored', userId, {
        action: 'store_page_token',
        business_account_id: businessAccount.id,
        page_id: pageId,
        scope: finalScope,
        expires_at: finalExpiresAt,
        credential_id: credentialData?.[0]?.id,
        success: true
      });
    } catch (auditError) {
      console.warn('⚠️  Audit logging failed (non-blocking):', auditError.message);
      // Don't fail the operation if audit fails - follows Jan 19 pattern
    }

    // === BUST CACHE: Ensure fresh token on next read ===
    const { clearCredentialCache } = require('../helpers/agent-helpers');
    clearCredentialCache(businessAccount.id);

    return {
      success: true,
      businessAccountId: businessAccount.id, // Return the UUID for frontend
      expiresAt: null  // page tokens are non-expiring
    };

  } catch (error) {
    console.error('❌ Failed to store page token');
    console.error('   Error type:', error.constructor.name);
    console.error('   Error message:', error.message);
    return {
      success: false,
      error: error.message || 'Unknown error storing page token'
    };
  }
}

/**
 * Retrieve page token from database with decryption
 *
 * Fetches encrypted token and decrypts using Supabase function
 * Validates token hasn't expired before returning
 *
 * @param {string} userId - User's UUID
 * @param {string} businessAccountId - Instagram Business account UUID
 * @returns {Promise<string>} Decrypted page access token
 * @throws {Error} If token not found, expired, or decryption fails
 */
async function retrievePageToken(userId, businessAccountId) {
  try {
    console.log('🔍 Retrieving page token from database...');
    console.log('   User ID:', userId);
    console.log('   Business Account ID:', businessAccountId);

    // ===== STEP 1: Get Supabase client =====
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      throw new Error('Database not available - Supabase client not initialized');
    }

    // ===== STEP 2: Query instagram_credentials table =====
    const { data, error } = await supabase
      .from('instagram_credentials')
      .select('*')
      .eq('user_id', userId)
      .eq('business_account_id', businessAccountId)
      .eq('token_type', 'page')
      .eq('is_active', true)
      .single();

    if (error) {
      // Check if error is "no rows found"
      if (error.code === 'PGRST116') {
        console.error('❌ No page token found in database');
        throw new Error(
          'No page token found. User must complete OAuth flow and token exchange first.'
        );
      }

      console.error('❌ Database query failed:', error);
      throw new Error(`Database error: ${error.message}`);
    }

    if (!data) {
      throw new Error('No page token found. User must complete OAuth flow.');
    }

    console.log('✅ Token record found in database');
    console.log('   Issued at:', data.issued_at);

    // ===== STEP 3: expires_at check — warning only for legacy rows =====
    // Page tokens are non-expiring per Meta documentation. New rows store expires_at=NULL.
    // Legacy rows (stored before this fix) may have a 60-day expiry timestamp — we do NOT
    // deactivate based on it. Health is validated via the daily /debug_token cron.
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      console.warn(`[retrievePageToken] Legacy expires_at in past for user ${userId}. Ignoring — page tokens are non-expiring. Daily cron will validate via /debug_token.`);
    }

    // ===== STEP 3.5: Look up per-user encryption key =====
    let encryptionKeyId = null;
    try {
      const { data: bizAccount } = await supabase
        .from('instagram_business_accounts')
        .select('encryption_key_id')
        .eq('user_id', userId)
        .eq('id', businessAccountId)
        .maybeSingle();
      encryptionKeyId = bizAccount?.encryption_key_id || null;
    } catch (keyLookupErr) {
      console.warn('⚠️  Could not look up per-user encryption key, using shared key:', keyLookupErr.message);
    }

    // ===== STEP 4: Decrypt token using Supabase function =====
    console.log('🔓 Decrypting page token...');

    const { data: decryptedToken, error: decryptError } = await supabase
      .rpc('decrypt_instagram_token', {
        encrypted_token: data.access_token_encrypted,
        p_key_id: encryptionKeyId
      });

    if (decryptError) {
      console.error('❌ Token decryption failed:', decryptError);
      throw new Error(`Token decryption failed: ${decryptError.message}`);
    }

    if (!decryptedToken) {
      throw new Error('Decryption returned null - check Supabase decryption function');
    }

    console.log('✅ Page token retrieved and decrypted successfully');
    console.log('   Token length:', decryptedToken.length);

    return decryptedToken;

  } catch (error) {
    console.error('❌ Failed to retrieve page token');
    console.error('   Error type:', error.constructor.name);
    console.error('   Error message:', error.message);
    throw error;
  }
}

// ==========================================
// UAT: USER ACCESS TOKEN OPERATIONS
// ==========================================

/**
 * Store a validated UAT in the split vault as token_type='user'.
 * Called by /exchange-token after UAT validation/extension, and by importMode.
 * Shares the same encryption infrastructure as storePageToken (per-user Vault key).
 *
 * @param {{ userId: string, businessAccountId: string, userAccessToken: string, scope: string[], expiresAt: string|null }} params
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function storeUserToken({ userId, businessAccountId, userAccessToken, scope, expiresAt, dataAccessExpiresAt }) {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return { success: false, error: 'Database not available' };

    // Look up per-user encryption key from business account (provisioned by storePageToken)
    let encryptionKeyId = null;
    try {
      const { data: bizAccount } = await supabase
        .from('instagram_business_accounts')
        .select('encryption_key_id')
        .eq('id', businessAccountId)
        .maybeSingle();
      encryptionKeyId = bizAccount?.encryption_key_id || null;
    } catch (keyErr) {
      console.warn('⚠️ UAT encryption key lookup failed, using shared key:', keyErr.message);
    }

    const { data: encryptedToken, error: encryptError } = await supabase
      .rpc('encrypt_instagram_token', { token: userAccessToken, p_key_id: encryptionKeyId });

    if (encryptError) {
      console.warn('⚠️ UAT encryption failed:', encryptError.message);
      return { success: false, error: encryptError.message };
    }

    const { error: credError } = await supabase
      .from('instagram_credentials')
      .upsert({
        user_id: userId,
        business_account_id: businessAccountId,
        access_token_encrypted: encryptedToken,
        token_type: 'user',
        scope: scope || [],
        issued_at: new Date().toISOString(),
        expires_at: expiresAt,
        data_access_expires_at: dataAccessExpiresAt || null,
        is_active: true,
        last_refreshed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,business_account_id,token_type' })
      .select();

    if (credError) {
      console.warn('⚠️ UAT store failed:', credError.message);
      return { success: false, error: credError.message };
    }

    console.log('✅ UAT stored in vault (token_type=user)');
    return { success: true };
  } catch (err) {
    console.warn('⚠️ storeUserToken error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Retrieve a stored UAT from the split vault with decryption.
 * Returns an object with token + expiry metadata (unlike retrievePageToken which returns just the token string).
 * Checks expires_at and throws if expired — UATs DO expire (~60 days), unlike PATs.
 *
 * @param {string} userId - User's UUID
 * @param {string} businessAccountId - Business account UUID
 * @returns {Promise<{token: string, expiresAt: string|null, dataAccessExpiresAt: string|null, scope: string[], issuedAt: string|null}>}
 * @throws {Error} If UAT not found, expired, or decryption fails
 */
async function retrieveUserToken(userId, businessAccountId) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error('Database not available');

  const { data, error } = await supabase
    .from('instagram_credentials')
    .select('*')
    .eq('user_id', userId)
    .eq('business_account_id', businessAccountId)
    .eq('token_type', 'user')
    .eq('is_active', true)
    .single();

  if (error || !data) {
    if (error?.code === 'PGRST116') {
      throw new Error('No UAT found. User must complete OAuth flow.');
    }
    throw new Error(`UAT retrieval failed: ${error?.message || 'not found'}`);
  }

  // UATs expire (~60 days) — reject if past expiry
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    throw new Error('UAT has expired. User must reconnect via OAuth.');
  }

  // Look up per-user Vault encryption key
  let encryptionKeyId = null;
  try {
    const { data: bizAccount } = await supabase
      .from('instagram_business_accounts')
      .select('encryption_key_id')
      .eq('id', businessAccountId)
      .maybeSingle();
    encryptionKeyId = bizAccount?.encryption_key_id || null;
  } catch (keyErr) {
    console.warn('⚠️ UAT key lookup failed, using shared key:', keyErr.message);
  }

  const { data: decryptedToken, error: decryptError } = await supabase
    .rpc('decrypt_instagram_token', {
      encrypted_token: data.access_token_encrypted,
      p_key_id: encryptionKeyId
    });

  if (decryptError || !decryptedToken) {
    throw new Error(`UAT decryption failed: ${decryptError?.message || 'null result'}`);
  }

  return {
    token: decryptedToken,
    expiresAt: data.expires_at,
    dataAccessExpiresAt: data.data_access_expires_at,
    scope: data.scope,
    issuedAt: data.issued_at
  };
}

/**
 * Refresh a stored UAT via Meta's fb_exchange_token grant.
 * Retrieves the current UAT, extends it, validates the new token via /debug_token,
 * stores the refreshed token, and busts the credential cache.
 *
 * Important: Cannot refresh an expired UAT — user must re-login via OAuth.
 *
 * @param {string} userId - User's UUID
 * @param {string} businessAccountId - Business account UUID
 * @returns {Promise<{success: boolean, expiresAt: string|null, scopes: string[]}>}
 * @throws {Error} If current UAT expired, extension fails, or validation fails
 */
async function refreshUserToken(userId, businessAccountId) {
  // 1. Retrieve current UAT (throws if expired or missing)
  const current = await retrieveUserToken(userId, businessAccountId);

  // 2. Call fb_exchange_token to extend
  const extendRes = await axios.get(`${GRAPH_API_BASE}/oauth/access_token`, {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: process.env.INSTAGRAM_APP_ID,
      client_secret: process.env.INSTAGRAM_APP_SECRET,
      fb_exchange_token: current.token
    },
    timeout: 10000
  });

  const newToken = extendRes.data.access_token;
  const expiresIn = extendRes.data.expires_in; // seconds

  // 3. Validate new token via /debug_token
  const tokenInfo = await detectTokenType(newToken);
  if (!tokenInfo || !tokenInfo.isValid) {
    throw new Error('Refreshed UAT failed /debug_token validation');
  }

  // 4. Compute expiry timestamps
  const newExpiresAt = expiresIn
    ? new Date(Date.now() + expiresIn * 1000).toISOString()
    : null;

  const dataAccessExpiresAt = tokenInfo.dataAccessExpiresAt
    ? new Date(tokenInfo.dataAccessExpiresAt * 1000).toISOString()
    : null;

  // 5. Store refreshed UAT (upserts on conflict)
  const storeResult = await storeUserToken({
    userId,
    businessAccountId,
    userAccessToken: newToken,
    scope: tokenInfo.scopes,
    expiresAt: newExpiresAt,
    dataAccessExpiresAt
  });

  if (!storeResult.success) {
    throw new Error(`Failed to store refreshed UAT: ${storeResult.error}`);
  }

  // 6. Bust credential cache
  const { clearCredentialCache } = require('../helpers/agent-helpers');
  clearCredentialCache(businessAccountId);

  return {
    success: true,
    expiresAt: newExpiresAt,
    scopes: tokenInfo.scopes
  };
}

// ==========================================
// SCOPE VALIDATION & AUDIT LOGGING
// ==========================================

/**
 * Validate token has required scopes.
 * Uses cached scopes from instagram_credentials.scope_cache
 * @param {string} userId - User UUID
 * @param {string} businessAccountId - Business account UUID
 * @param {string[]} requiredScopes - Required permissions (e.g., ['instagram_basic', 'pages_read_user_content'])
 * @returns {Promise<{valid: boolean, missing: string[]}>}
 */
async function validateTokenScopes(userId, businessAccountId, requiredScopes = []) {
  try {
    const supabase = getSupabaseAdmin();

    console.log('🔍 Validating token scopes...');
    console.log('   User ID:', userId);
    console.log('   Business Account ID:', businessAccountId);
    console.log('   Required scopes:', requiredScopes);

    // Fetch scopes — prefer scope_cache (live-validated) but fall back to scope (set at token store time)
    const { data: credentials, error } = await supabase
      .from('instagram_credentials')
      .select('scope, scope_cache, scope_cache_updated_at')
      .eq('user_id', userId)
      .eq('business_account_id', businessAccountId)
      .eq('token_type', 'page')
      .eq('is_active', true)
      .single();

    if (error || !credentials) {
      console.error('❌ Failed to fetch credentials for scope validation');
      if (error) console.error('   Error:', error.message);
      return { valid: false, missing: requiredScopes };
    }

    const grantedScopes = credentials.scope_cache || credentials.scope || [];
    const missingScopes = requiredScopes.filter(req => !grantedScopes.includes(req));

    if (missingScopes.length === 0) {
      console.log('✅ All required scopes granted');
      return { valid: true, missing: [] };
    } else {
      console.warn('⚠️  Missing scopes:', missingScopes);
      return { valid: false, missing: missingScopes };
    }
  } catch (err) {
    console.error('❌ Scope validation error:', err);
    return { valid: false, missing: requiredScopes };
  }
}

/**
 * ✅ NEW (bff586c pattern): Resilient audit logging
 * Non-blocking - failures don't affect main flow
 * @param {string} action - Action name (e.g., 'posts_fetched', 'permission_requested')
 * @param {string} userId - User UUID
 * @param {object} metadata - Additional context (e.g., { count: 10, source: 'api' })
 */
async function logAudit(action, userId, metadata = {}) {
  try {
    const supabase = getSupabaseAdmin();

    await supabase.from('audit_log').insert({
      user_id: userId,
      action,
      metadata,
      created_at: new Date().toISOString()
    });

    console.log(`✅ Audit logged: ${action}`, metadata);
  } catch (err) {
    // ✅ Non-blocking: Warn but don't throw (bff586c pattern)
    console.warn('⚠️  Audit log failed (non-critical):', err.message);
  }
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  // Shared: token detection & scope
  detectTokenType,
  fetchDynamicScope,
  validateTokenScopes,

  // PAT: page access token operations
  exchangeForPageToken,
  storePageToken,
  retrievePageToken,

  // UAT: user access token operations
  storeUserToken,
  retrieveUserToken,
  refreshUserToken,

  // Insights API
  getAccountInsights,

  // Audit logging
  logAudit,

  // Constants
  GRAPH_API_VERSION,
  GRAPH_API_BASE,
  DEFAULT_METRICS,
  SAFE_METRICS,
  PAT_SCOPE_DEFAULTS,
};
