// backend.api/services/instagram-tokens.js
const axios = require('axios');
const { getSupabaseAdmin } = require('../config/supabase');

// ==========================================
// CONFIGURATION
// ==========================================

const GRAPH_API_VERSION = 'v23.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// ✅ REFACTORED: Separate safe metrics from optional metrics
// Safe metrics - work for all Instagram Business/Creator accounts
const SAFE_METRICS = [
  'impressions',
  'reach',
  'profile_views'
];

// Default metrics - includes optional metrics that require specific account setup
// Note: website_clicks requires a website URL in Instagram profile
const DEFAULT_METRICS = [
  ...SAFE_METRICS,
  'website_clicks'
];

// ==========================================
// TOKEN EXCHANGE FUNCTIONS
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

    // ===== STEP 3: Find page with Instagram Business account =====
    const pageWithIG = pages.find(
      page => page.instagram_business_account && page.instagram_business_account.id
    );

    if (!pageWithIG) {
      console.error('❌ No Instagram Business account connected to any page');

      // Log page names for debugging
      const pageNames = pages.map(p => p.name).join(', ');
      console.error(`   Pages found: ${pageNames}`);

      return {
        success: false,
        error: 'No Instagram Business Account connected. Please connect an Instagram Business Account to your Facebook Page.'
      };
    }

    if (pages.length > 1) {
      console.warn('⚠️  User has multiple Facebook pages');
      console.warn(`   Using page with IG: ${pageWithIG.name} (ID: ${pageWithIG.id})`);
    }

    console.log(`✅ Selected Facebook page: "${pageWithIG.name}" (ID: ${pageWithIG.id})`);
    console.log(`   Page token length: ${pageWithIG.access_token?.length || 0}`);
    console.log(`✅ Found Instagram Business account: ${pageWithIG.instagram_business_account.id}`);

    // ===== STEP 4: Return success response =====
    const result = {
      success: true,
      pageAccessToken: pageWithIG.access_token,
      pageId: pageWithIG.id,
      pageName: pageWithIG.name,
      igBusinessAccountId: pageWithIG.instagram_business_account.id,
      expiresIn: 5184000, // 60 days (standard for page tokens)
      tokenType: 'page'
    };

    console.log('✅ Page token exchange successful');
    console.log('   Page ID:', result.pageId);
    console.log('   Page Name:', result.pageName);
    console.log('   IG Business Account:', result.igBusinessAccountId);
    console.log('   Expires In:', result.expiresIn, 'seconds (60 days)');

    return result;

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
        console.warn('   Retrying with safe metrics only (impressions, reach, profile_views)...');

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
async function storePageToken({ userId, igBusinessAccountId, pageAccessToken, pageId, pageName, scope, expiresAt }) {
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

    // ===== STEP 3: Create/Update business account record FIRST =====
    console.log('📝 Creating/updating Instagram business account record...');

    const { data: businessAccount, error: accountError } = await supabase
      .from('instagram_business_accounts')
      .upsert({
        user_id: userId,
        instagram_business_id: igBusinessAccountId,
        name: pageName, // FIXED: Added required 'name' field
        username: pageName, // Use page name as username initially
        is_connected: true,
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'instagram_business_id', // FIXED: Only instagram_business_id has unique constraint
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
      .rpc('encrypt_instagram_token', { token: pageAccessToken });

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

    // ===== STEP 5: Smart defaults for scope and expiration (v3 OPTIMIZATION) =====
    // Priority: 1) Passed scope, 2) Detected from debug_token, 3) Fallback defaults
    const finalScope = scope || ['instagram_manage_insights', 'pages_show_list', 'pages_read_engagement'];

    console.log('📋 Using scope:', finalScope);

    // ✅ v3 OPTIMIZATION: Auto-calculate expiry if not provided
    // Meta Page tokens typically expire in 60 days (5184000 seconds)
    let finalExpiresAt;
    if (expiresAt) {
      finalExpiresAt = new Date(expiresAt);
      console.log('📅 Token expiration (provided):', finalExpiresAt.toISOString());
    } else {
      const expiresIn = 5184000; // 60 days in seconds
      finalExpiresAt = new Date(Date.now() + (expiresIn * 1000));
      console.log('📅 Token expiration (auto-calculated):', finalExpiresAt.toISOString());
    }

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
        expires_at: finalExpiresAt.toISOString(),  // ✅ v3: Use calculated expiry
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
        expires_at: finalExpiresAt.toISOString(),
        credential_id: credentialData?.[0]?.id,
        success: true
      });
    } catch (auditError) {
      console.warn('⚠️  Audit logging failed (non-blocking):', auditError.message);
      // Don't fail the operation if audit fails - follows Jan 19 pattern
    }

    return {
      success: true,
      businessAccountId: businessAccount.id, // Return the UUID for frontend
      expiresAt: finalExpiresAt.toISOString()  // ✅ v3: Return calculated expiry
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
    console.log('   Expires at:', data.expires_at);

    // ===== STEP 3: Check if token expired =====
    const expiresAt = new Date(data.expires_at);
    const now = new Date();

    if (expiresAt < now) {
      const expiredAgo = Math.floor((now - expiresAt) / (1000 * 60 * 60 * 24)); // days
      console.error(`❌ Page token expired ${expiredAgo} day(s) ago`);

      throw new Error(
        `Page token expired on ${expiresAt.toISOString()}. User must reconnect their Instagram account through OAuth.`
      );
    }

    const expiresIn = Math.floor((expiresAt - now) / (1000 * 60 * 60 * 24)); // days
    console.log(`✅ Token valid - expires in ${expiresIn} day(s)`);

    // ===== STEP 4: Decrypt token using Supabase function =====
    console.log('🔓 Decrypting page token...');

    const { data: decryptedToken, error: decryptError } = await supabase
      .rpc('decrypt_instagram_token', {
        encrypted_token: data.access_token_encrypted
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
// EXPORTS
// ==========================================

module.exports = {
  // Token exchange
  exchangeForPageToken,

  // Insights API
  getAccountInsights,

  // Database operations
  storePageToken,
  retrievePageToken,

  // Constants (for testing)
  GRAPH_API_VERSION,
  GRAPH_API_BASE,
  DEFAULT_METRICS,
  SAFE_METRICS  // ✅ Added: Safe metrics that work for all account types
};
