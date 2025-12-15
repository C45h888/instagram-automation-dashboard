// backend.api/services/instagram-tokens.js
const axios = require('axios');
const { getSupabaseAdmin } = require('../config/supabase');

// ==========================================
// CONFIGURATION
// ==========================================

const GRAPH_API_VERSION = 'v23.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// Default metrics for account insights
const DEFAULT_METRICS = [
  'impressions',
  'reach',
  'profile_views',
  'website_clicks'
];

// ==========================================
// TOKEN EXCHANGE FUNCTIONS
// ==========================================

/**
 * Exchange user access token for page access token
 *
 * Required for instagram_manage_insights permission
 * Meta's architecture requires page-level tokens for analytics APIs
 *
 * Process:
 * 1. Query user's Facebook pages (/me/accounts)
 * 2. Extract page access token from first page
 * 3. Query Instagram Business account connected to page
 * 4. Return page token + Instagram account mapping
 *
 * @param {string} userAccessToken - User's Instagram/Facebook access token
 * @returns {Promise<{pageToken: string, pageId: string, pageName: string, igBusinessAccountId: string, expiresIn: number, tokenType: string}>}
 * @throws {Error} If no pages found, no IG account connected, or API error
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
          fields: 'instagram_business_account',
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
      throw new Error(
        'No Facebook pages found. To use Instagram Business features, you must:\n' +
        '1. Create a Facebook page (facebook.com/pages/create)\n' +
        '2. Connect your Instagram Business account to the page\n' +
        '3. Complete the OAuth flow again'
      );
    }

    // ===== STEP 3: Select page (use first, log if multiple) =====
    const page = pages[0];

    if (pages.length > 1) {
      console.warn('⚠️  User has multiple Facebook pages');
      console.warn(`   Using first page: ${page.name} (ID: ${page.id})`);
      console.warn('   TODO: Implement page selection UI for users with multiple pages');
    }

    console.log(`✅ Selected Facebook page: "${page.name}" (ID: ${page.id})`);
    console.log(`   Page token length: ${page.access_token?.length || 0}`);

    // ===== STEP 4: Get Instagram Business account from page data =====
    // ✅ NO SECOND API CALL NEEDED - already included in /me/accounts response
    console.log('📱 Step 2: Extracting Instagram Business account from page data...');

    const igBusinessAccount = page.instagram_business_account;

    // ===== STEP 5: Validate Instagram Business account exists =====
    if (!igBusinessAccount) {
      console.error(`❌ No Instagram Business account connected to page: ${page.name}`);
      throw new Error(
        `No Instagram Business account connected to Facebook page "${page.name}". To fix:\n` +
        '1. Open Facebook Settings → Instagram\n' +
        '2. Connect your Instagram Business account\n' +
        '3. Ensure account is a Business account (not Personal)\n' +
        '4. Complete the OAuth flow again'
      );
    }

    console.log(`✅ Found Instagram Business account: ${igBusinessAccount.id}`);

    // ===== STEP 6: Return token data =====
    const result = {
      pageToken: page.access_token,
      pageId: page.id,
      pageName: page.name,
      igBusinessAccountId: igBusinessAccount.id,
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
        throw new Error(
          'Invalid or expired user access token. User must reconnect their Instagram account through OAuth.'
        );
      }

      if (apiError?.code === 100) {
        throw new Error(
          'Invalid API request. Check that all required permissions (pages_show_list, instagram_basic) are granted.'
        );
      }

      if (apiError?.message) {
        throw new Error(`Facebook API Error: ${apiError.message}`);
      }
    }

    // ===== Handle network errors =====
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      throw new Error(
        'Unable to connect to Facebook Graph API. Check network connection and try again.'
      );
    }

    // ===== Re-throw with context =====
    throw new Error(`Page token exchange failed: ${error.message}`);
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
      metrics = DEFAULT_METRICS
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
    const now = Date.now();
    const since = Math.floor((now - (periodDays * 24 * 60 * 60 * 1000)) / 1000);
    const until = Math.floor(now / 1000);

    console.log(`📊 Fetching insights for account: ${igBusinessAccountId}`);
    console.log(`   Period: ${periodDays} days (${new Date(since * 1000).toISOString()} to ${new Date(until * 1000).toISOString()})`);
    console.log(`   Metrics: ${metrics.join(', ')}`);

    // ===== STEP 3: Call Instagram Insights API =====
    const response = await axios.get(
      `${GRAPH_API_BASE}/${igBusinessAccountId}/insights`,
      {
        params: {
          metric: metrics.join(','),
          period: 'day', // Daily granularity
          since,
          until,
          access_token: pageToken // ✅ CRITICAL: Must use page token, not user token
        },
        timeout: 15000 // 15 second timeout (insights can be slow)
      }
    );

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
      metrics
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
 * Uses Supabase encryption functions to secure token at rest
 * Upserts to handle token refresh scenarios
 *
 * @param {string} userId - User's UUID
 * @param {string} businessAccountId - Instagram Business account UUID
 * @param {Object} pageTokenData - Token data from exchangeForPageToken
 * @returns {Promise<boolean>} True if successful
 * @throws {Error} If database or encryption error
 */
async function storePageToken(userId, businessAccountId, pageTokenData) {
  try {
    console.log('💾 Storing page token in database...');
    console.log('   User ID:', userId);
    console.log('   Business Account ID:', businessAccountId);

    // ===== STEP 1: Get Supabase client =====
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      throw new Error('Database not available - Supabase client not initialized');
    }

    // ===== STEP 2: Encrypt page token using Supabase function =====
    console.log('🔐 Encrypting page token...');

    const { data: encryptedToken, error: encryptError } = await supabase
      .rpc('encrypt_instagram_token', { token: pageTokenData.pageToken });

    if (encryptError) {
      console.error('❌ Token encryption failed:', encryptError);
      throw new Error(`Token encryption failed: ${encryptError.message}`);
    }

    if (!encryptedToken) {
      throw new Error('Encryption returned null - check Supabase encryption function');
    }

    console.log('✅ Token encrypted successfully');

    // ===== STEP 3: Calculate expiration timestamp =====
    const expiresAt = new Date(Date.now() + (pageTokenData.expiresIn * 1000));

    console.log('📅 Token expiration:', expiresAt.toISOString());

    // ===== STEP 4: Upsert to instagram_credentials table =====
    // Unique constraint on (user_id, business_account_id, token_type)
    // This handles token refresh scenarios automatically
    const { data, error } = await supabase
      .from('instagram_credentials')
      .upsert({
        user_id: userId,
        business_account_id: businessAccountId,
        access_token_encrypted: encryptedToken,
        token_type: 'page',
        scope: ['instagram_manage_insights', 'pages_show_list', 'pages_read_engagement'],
        issued_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        is_active: true,
        last_refreshed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,business_account_id,token_type'
      })
      .select();

    if (error) {
      console.error('❌ Database upsert failed:', error);
      throw new Error(`Database error: ${error.message}`);
    }

    console.log('✅ Page token stored in database');
    console.log('   Record ID:', data?.[0]?.id);

    return true;

  } catch (error) {
    console.error('❌ Failed to store page token');
    console.error('   Error type:', error.constructor.name);
    console.error('   Error message:', error.message);
    throw error;
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
  DEFAULT_METRICS
};
