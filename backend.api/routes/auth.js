// ═══════════════════════════════════════════════════════════════
// AUTHENTICATION ROUTES (COMPLETE IMPLEMENTATION)
// Handles Facebook OAuth with dual-ID system (UUID + Facebook ID)
// Fixes: Empty response body bug + UUID type mismatch
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { getSupabaseAdmin } = require('../config/supabase');

/**
 * Facebook OAuth Callback Handler
 *
 * Flow:
 * 1. Exchange authorization code for Facebook access token
 * 2. Fetch Facebook user data (id, name, email, picture)
 * 3. Sign in with Supabase Auth using signInWithIdToken → gets UUID
 * 4. Store dual-ID mapping: user_id (UUID) ↔ facebook_id (TEXT)
 * 5. Log user consent with UUID (not Facebook ID)
 * 6. Return success response (NEVER empty body)
 *
 * @route POST /api/auth/facebook/callback
 * @param {string} req.body.code - Authorization code from Facebook
 * @param {string} req.body.redirectUri - OAuth redirect URI for verification
 */
router.post('/facebook/callback', async (req, res) => {
  // Frontend sends code in request body (POST JSON), not query params
  const { code, redirectUri } = req.body;

  console.log('📥 Facebook OAuth callback received');
  console.log('   Code:', code ? code.substring(0, 20) + '...' : 'MISSING');

  // Initialize Supabase Admin client (with service role key)
  const supabaseAdmin = await getSupabaseAdmin();

  try {
    // ──────────────────────────────────────────────────────────────
    // STEP 1: Exchange code for Facebook access token
    // ──────────────────────────────────────────────────────────────
    const tokenResponse = await fetch('https://graph.facebook.com/v23.0/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        redirect_uri: redirectUri || process.env.FACEBOOK_REDIRECT_URI,
        code
      })
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('❌ Facebook token exchange failed:', errorData);
      return res.status(400).json({
        success: false,
        error: 'Facebook authentication failed',
        details: errorData
      });
    }

    const tokenData = await tokenResponse.json();
    const facebookAccessToken = tokenData.access_token;

    console.log('✅ Facebook access token obtained');

    // ──────────────────────────────────────────────────────────────
    // STEP 2: Fetch Facebook user data
    // ──────────────────────────────────────────────────────────────
    const userResponse = await fetch(
      `https://graph.facebook.com/v23.0/me?fields=id,name,email,picture&access_token=${facebookAccessToken}`
    );

    if (!userResponse.ok) {
      const errorData = await userResponse.json();
      console.error('❌ Facebook user data fetch failed:', errorData);
      return res.status(400).json({
        success: false,
        error: 'Failed to fetch Facebook user data',
        details: errorData
      });
    }

    const facebookUser = await userResponse.json();
    const facebookId = facebookUser.id;  // "122098096448937004" (TEXT)

    console.log(`✅ Facebook user data retrieved: ${facebookId}`);

    // ──────────────────────────────────────────────────────────────
    // STEP 3: Sign in with Supabase Auth using Facebook ID token
    // THIS IS THE CRITICAL FIX - Use Supabase Auth, get UUID
    // ──────────────────────────────────────────────────────────────
    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithIdToken({
      provider: 'facebook',
      token: facebookAccessToken,
      options: {
        data: {
          facebook_id: facebookId,  // Store in user metadata
          full_name: facebookUser.name,
          avatar_url: facebookUser.picture && facebookUser.picture.data ? facebookUser.picture.data.url : null
        }
      }
    });

    if (authError || !authData.user) {
      console.error('❌ Supabase Auth signInWithIdToken failed:', authError);
      return res.status(500).json({
        success: false,
        error: 'Supabase authentication failed',
        details: authError
      });
    }

    const supabaseUserId = authData.user.id;  // ← UUID from Supabase Auth

    console.log(`✅ Supabase Auth successful: ${supabaseUserId} (UUID)`);

    // ──────────────────────────────────────────────────────────────
    // STEP 4: Upsert user_profiles with DUAL-ID mapping
    // KEY: user_id (UUID) + facebook_id (TEXT)
    // ──────────────────────────────────────────────────────────────
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .upsert({
        user_id: supabaseUserId,      // ← UUID (PRIMARY)
        facebook_id: facebookId,       // ← TEXT (MAPPING)
        email: facebookUser.email || null,
        full_name: facebookUser.name || null,
        avatar_url: facebookUser.picture && facebookUser.picture.data ? facebookUser.picture.data.url : null,
        instagram_connected: false,
        last_active_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id',  // Upsert on UUID, not facebook_id
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (profileError) {
      console.error('❌ user_profiles upsert failed:', profileError);
      return res.status(500).json({
        success: false,
        error: 'Failed to create user profile',
        details: profileError
      });
    }

    console.log(`✅ user_profiles upserted: UUID=${supabaseUserId}, Facebook ID=${facebookId}`);

    // ──────────────────────────────────────────────────────────────
    // STEP 5: Log user consent (using UUID, not Facebook ID)
    // FIX: The context injection showed this INSERT was failing
    // ──────────────────────────────────────────────────────────────
    const { error: consentError } = await supabaseAdmin
      .from('user_consents')
      .insert({
        user_id: supabaseUserId,  // ← FIXED: Use UUID, not facebook_id
        consent_type: 'facebook_oauth',
        consent_given: true,
        consent_text: 'User granted Facebook OAuth permissions',
        ip_address: req.ip || 'unknown',
        user_agent: req.headers['user-agent'] || 'unknown',
        consented_at: new Date().toISOString()
      });

    if (consentError) {
      console.error('⚠️ user_consents insert failed (non-critical):', consentError);
      // Don't fail the whole flow if consent logging fails
    } else {
      console.log('✅ user_consents logged');
    }

    // ──────────────────────────────────────────────────────────────
    // STEP 6: Create session token for frontend
    // ──────────────────────────────────────────────────────────────
    const sessionToken = authData.session && authData.session.access_token ? authData.session.access_token : null;

    if (!sessionToken) {
      console.error('❌ No session token generated');
      return res.status(500).json({
        success: false,
        error: 'Failed to generate session token'
      });
    }

    // ──────────────────────────────────────────────────────────────
    // STEP 7: Return success response (NOT empty!)
    // FIX: Context injection said "empty response body on failure"
    // ──────────────────────────────────────────────────────────────
    console.log('✅ OAuth flow completed successfully');

    // Return JSON success response (frontend handles the redirect)
    return res.status(200).json({
      success: true,
      message: 'Facebook OAuth successful',
      user: {
        id: supabaseUserId,
        facebook_id: facebookId,
        email: facebookUser.email || null,
        name: facebookUser.name || null
      },
      session: {
        access_token: sessionToken
      }
    });

  } catch (error) {
    // ──────────────────────────────────────────────────────────────
    // CRITICAL ERROR HANDLING
    // FIX: Always return JSON response, never empty body
    // ──────────────────────────────────────────────────────────────
    console.error('❌ FATAL: OAuth callback error:', error);

    return res.status(500).json({
      success: false,
      error: 'Internal server error during Facebook OAuth',
      message: error.message || 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
