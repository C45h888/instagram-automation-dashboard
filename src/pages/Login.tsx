import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';
import {  Instagram,      // Instagram logo
  Lock,           // Security/privacy indicator
  ChevronRight,   // Accordion arrow
  Shield,         // Permission/security icon for consent section
  CheckCircle     // Checkmark for permission list items
} from 'lucide-react';
// Phase 3.7: Facebook SDK removed - using Native Supabase OAuth
// import { useFacebookSDK, facebookLogin } from '../hooks/useFacebookSDK';

const Login: React.FC = () => {
  const { login, setBusinessAccount } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || '/';

  // Phase 3.7: Facebook SDK initialization removed
  // Native Supabase OAuth handles everything via signInWithOAuth()
  // const fbSdkReady = useFacebookSDK();

  const [isInstagramLoading, setIsInstagramLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'info' | 'error' | 'success'; text: string } | null>(null);

  /**
   * Facebook button loading state
   * Tracks Facebook OAuth flow progress independently
   * @type {boolean}
   * @default false
   */
  const [isFacebookLoading, setIsFacebookLoading] = useState<boolean>(false);

  /**
   * Combined loading state for global UI effects
   * Used to disable interactions during any OAuth flow
   * @type {boolean}
   * @computed
   */
  const isAnyAuthLoading = isFacebookLoading || isInstagramLoading;

  // ============================================
  // CONSENT STATE MANAGEMENT
  // ============================================
  // Added for February 2025 Platform Terms compliance

  /**
   * Tracks whether user has given explicit consent for OAuth
   *
   * @type {boolean}
   * @default false
   *
   * CRITICAL: Must be false by default (no pre-checked consent)
   * User must actively check the consent checkbox
   *
   * Related: Meta Platform Terms (Feb 2025), GDPR Article 7
   */
  const [consentGiven, setConsentGiven] = useState<boolean>(false);

  /**
   * Controls visibility of permission disclosure accordion
   *
   * @type {boolean}
   * @default false
   *
   * When true, shows detailed breakdown of what data will be accessed
   * Helps users make informed consent decision
   */
  const [showPermissions, setShowPermissions] = useState<boolean>(false);

  // Authentication mode configuration type
  type AuthMode = 'facebook' | 'instagram' | 'both';

  // Component-level state for auth mode
  const [authMode] = useState<AuthMode>(() => {
    const envMode = import.meta.env.VITE_AUTH_MODE as AuthMode | undefined;

    // Validate environment variable value
    if (envMode && ['facebook', 'instagram', 'both'].includes(envMode)) {
      return envMode;
    }

    // Default to 'both' for maximum flexibility
    console.warn('VITE_AUTH_MODE not set or invalid. Defaulting to "both".');
    return 'both';
  });

  // Rendering flags derived from mode
  const showFacebookLogin = authMode === 'facebook' || authMode === 'both';
  const showInstagramLogin = authMode === 'instagram' || authMode === 'both';

  // Log mode for debugging (development only)
  if (import.meta.env.DEV) {
    console.log('🔐 Authentication Mode:', authMode);
    console.log('  - Facebook Login:', showFacebookLogin ? '✅' : '❌');
    console.log('  - Instagram Login:', showInstagramLogin ? '✅' : '❌');
  }

  /**
   * Store user consent in session storage for later persistence
   *
   * UPDATED: Session-based approach to fix RLS policy violation
   *
   * This function stores consent metadata in sessionStorage during OAuth flow.
   * The consent is persisted to database AFTER authentication completes,
   * ensuring we have a valid user_id and authenticated session.
   *
   * Records comprehensive consent metadata including:
   * - Timestamp (ISO 8601 format)
   * - IP address (for geographic jurisdiction)
   * - User agent (for device/browser tracking)
   * - Policy versions (for version control)
   * - Consent type (OAuth-specific)
   *
   * @returns {Promise<void>}
   *
   * @throws {Error} If IP fetch fails (logged but doesn't block OAuth)
   *
   * @compliance
   * - GDPR Article 7: Conditions for consent
   * - GDPR Article 30: Records of processing activities
   * - CCPA Section 1798.100: Consumer's right to know
   * - Meta Platform Terms (February 2025)
   *
   * @see persistStoredConsent() - Called after authentication to save to DB
   */
  const logConsent = async (): Promise<void> => {
    try {
      // ============================================
      // STEP 1: Fetch User's IP Address
      // ============================================
      // Used for geographic jurisdiction determination
      // Required for GDPR territorial scope (Article 3)

      let ipAddress = 'unknown';

      try {
        // Using ipify.org - free, reliable IP detection service
        // Alternative: Implement server-side endpoint for IP detection
        const ipResponse = await fetch('https://api.ipify.org?format=json', {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });

        if (ipResponse.ok) {
          const ipData = await ipResponse.json();
          ipAddress = ipData.ip || 'unknown';
        } else {
          console.warn('⚠️ IP fetch failed, using "unknown"');
        }
      } catch (ipError) {
        console.error('❌ IP detection error:', ipError);
        // Continue with 'unknown' - don't block consent logging
      }

      // ============================================
      // STEP 2: Gather Consent Metadata
      // ============================================

      const consentData = {
        // Type of consent being given
        consent_type: 'instagram_oauth' as const,

        // Explicit consent flag
        consent_given: true,

        // User's IP address for jurisdiction
        ip_address: ipAddress,

        // Browser/device information
        user_agent: navigator.userAgent,

        // Policy version tracking (for version control)
        privacy_policy_version: '2.0',
        terms_version: '2.0',

        // Timestamp (ISO 8601 format)
        consented_at: new Date().toISOString(),
      };

      // ============================================
      // STEP 3: Store in Session Storage
      // ============================================
      // Store temporarily until authentication completes
      // Will be persisted to database by persistStoredConsent()

      sessionStorage.setItem('pendingConsent', JSON.stringify(consentData));

      console.log('✅ Consent metadata stored in session');
      console.log('   Timestamp:', consentData.consented_at);
      console.log('   IP Address:', ipAddress);
      console.log('   Policy Versions: Privacy v2.0, Terms v2.0');
      console.log('   ⏳ Will be persisted to database after authentication');

    } catch (error) {
      // ============================================
      // ERROR HANDLING
      // ============================================
      // Log error but DON'T block OAuth flow
      // Consent logging is important but shouldn't prevent authentication

      console.error('❌ Failed to store consent metadata:', error);
      console.warn('⚠️ Continuing with OAuth despite storage failure');

      // DON'T throw - allow OAuth to proceed
      // Consent was given in UI, storage failure is operational issue
    }
  };

  /**
   * Persist stored consent to database after authentication
   *
   * This function retrieves consent metadata from sessionStorage and
   * persists it to the database using the authenticated user's credentials.
   *
   * Called immediately after successful authentication to ensure:
   * - User has valid authenticated session
   * - user_id is available from auth.uid()
   * - RLS policies allow the insert
   *
   * @param userId - The authenticated user's ID from OAuth response
   * @returns {Promise<void>}
   *
   * @example
   * // After successful login
   * login(userData, token);
   * await persistStoredConsent(userData.id);
   */
  /**
   * Persist consent to database with UUID validation (PHASE 3.5 FIX)
   *
   * CRITICAL: userId MUST be a Supabase UUID, NOT Facebook ID
   */
  const persistStoredConsent = async (userId: string): Promise<void> => {
    try {
      // ============================================
      // STEP 1: Validate UUID format
      // ============================================
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (!uuidRegex.test(userId)) {
        console.error('❌ Cannot persist consent: user_id is not a valid UUID');
        console.error('   Got:', userId);
        console.error('   Hint: Ensure you are passing Supabase UUID, not Facebook ID');
        throw new Error('Invalid user_id format for consent persistence');
      }

      // ============================================
      // STEP 2: Retrieve Consent from Session Storage
      // ============================================
      const storedConsent = sessionStorage.getItem('pendingConsent');

      if (!storedConsent) {
        console.warn('⚠️ No pending consent found in session storage');
        return;
      }

      const consentData = JSON.parse(storedConsent);

      // ============================================
      // STEP 3: Add user_id to Consent Data
      // ============================================
      // Now we have authenticated user, add user_id (UUID)
      const completeConsentData = {
        ...consentData,
        user_id: userId,  // This is the Supabase UUID
      };

      // ============================================
      // STEP 4: Insert to Database (Now Authenticated)
      // ============================================
      // User is now authenticated, RLS policy will allow this insert
      const { data, error } = await supabase
        .from('user_consents')
        .insert([completeConsentData])
        .select();

      if (error) {
        throw new Error(`Database insert failed: ${error.message}`);
      }

      console.log('✅ User consent persisted to database successfully');
      console.log('   User ID (UUID):', userId);
      console.log('   Consent ID:', data?.[0]?.id);
      console.log('   Timestamp:', consentData.consented_at);

      // ============================================
      // STEP 5: Cleanup Session Storage
      // ============================================
      sessionStorage.removeItem('pendingConsent');

      // Optional: Store consent ID for reference
      if (data && data[0] && data[0].id) {
        sessionStorage.setItem('consent_id', data[0].id);
      }

    } catch (error) {
      console.error('❌ Failed to persist consent to database:', error);
      console.warn('⚠️ Consent metadata was captured but database insert failed');

      // Non-blocking error - don't prevent login
    }
  };

  /**
   * Complete the OAuth handshake (PHASE 3.5 NEW)
   *
   * Bridges the gap between OAuth and Dashboard by:
   * 1. Calling backend /exchange-token with UUID
   * 2. Receiving discovered businessAccountId
   * 3. Storing business account info in authStore
   */
  const completeHandshake = async (
    providerToken: string,
    userId: string  // Must be UUID from Supabase Auth
  ): Promise<{ success: boolean; error?: string; businessAccountId?: string }> => {
    console.log('🤝 Starting handshake...');
    console.log('   Provider token:', providerToken ? 'Present' : 'Missing');
    console.log('   User ID (UUID):', userId);

    try {
      const backendUrl = import.meta.env.VITE_API_BASE_URL || 'https://api.888intelligenceautomation.in';

      // ──────────────────────────────────────────────────────────────
      // STEP 1: Call the FIXED /exchange-token endpoint
      // Note: We do NOT send businessAccountId - backend will discover it
      // ──────────────────────────────────────────────────────────────
      const response = await fetch(`${backendUrl}/api/instagram/exchange-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userAccessToken: providerToken,
          userId: userId  // UUID from Supabase Auth
          // Note: businessAccountId is intentionally NOT sent
        })
      });

      // ──────────────────────────────────────────────────────────────
      // STEP 2: Parse response (handle empty response gracefully)
      // ──────────────────────────────────────────────────────────────
      const text = await response.text();

      if (!text) {
        console.error('❌ Empty response from token exchange');
        throw new Error('Server returned empty response');
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error('❌ Failed to parse response:', text.substring(0, 200));
        throw new Error('Invalid JSON response from server');
      }

      if (!response.ok || !data.success) {
        console.error('❌ Token exchange failed:', data.error || data.message);
        throw new Error(data.error || 'Token exchange failed');
      }

      console.log('✅ Token exchange successful');
      console.log('   Business Account ID:', data.data.businessAccountId);
      console.log('   Instagram Business ID:', data.data.instagramBusinessId);

      // ──────────────────────────────────────────────────────────────
      // STEP 3: Update authStore with the new business account info
      // ──────────────────────────────────────────────────────────────
      setBusinessAccount({
        businessAccountId: data.data.businessAccountId,
        instagramBusinessId: data.data.instagramBusinessId,
        pageId: data.data.pageId,
        pageName: data.data.pageName
      });

      console.log('✅ Auth store updated with business account info');

      // ──────────────────────────────────────────────────────────────
      // STEP 4: Return success - caller should redirect to dashboard
      // ──────────────────────────────────────────────────────────────
      return {
        success: true,
        businessAccountId: data.data.businessAccountId
      };

    } catch (error: any) {
      console.error('❌ Handshake failed:', error);
      return {
        success: false,
        error: error.message || 'Handshake failed'
      };
    }
  };

  const handleInstagramLogin = async (): Promise<void> => {
    // ============================================
    // STEP 1: CONSENT VALIDATION (CRITICAL)
    // ============================================
    // Required by Meta Platform Terms (February 2025)
    // Applies to BOTH Facebook and Instagram OAuth methods

    if (!consentGiven) {
      // Show error message to user
      setMessage({
        type: 'error',
        text: 'Please accept the Privacy Policy and Terms of Service to continue with Instagram Login.'
      });

      // Log attempted OAuth without consent (security audit)
      console.warn('⚠️ OAuth attempt without consent - Instagram Login blocked');

      // Exit early - do NOT proceed with OAuth
      return;
    }

    // ============================================
    // STEP 2: SET LOADING STATE
    // ============================================
    setIsInstagramLoading(true);
    setMessage(null);

    try {
      // ============================================
      // STEP 3: LOG CONSENT (BEFORE OAuth)
      // ============================================
      await logConsent();

      console.log('🟣 Initiating Instagram OAuth (Legacy)...');
      console.log('   ✅ User consent verified and logged');

      // ============================================
      // STEP 4: PROCEED WITH OAUTH FLOW
      // ============================================
      // Rest of existing Instagram OAuth logic continues unchanged...

      // Simulate Instagram OAuth flow
      await new Promise(resolve => setTimeout(resolve, 1500));

      // In production, this would redirect to Instagram OAuth
      // For now, show a message about Instagram API pending
      setMessage({
        type: 'info',
        text: 'Instagram OAuth integration pending Meta API approval'
      });

      // Temporary mock login for development
      // Remove this in production
      if (process.env.NODE_ENV === 'development') {
        // Wait a bit to show the message
        await new Promise(resolve => setTimeout(resolve, 1000));

        login({
          id: '1',
          username: 'instauser',
          avatarUrl: '',
          permissions: ['dashboard', 'content', 'engagement', 'analytics', 'settings'],
        }, 'mock_token');

        // Persist consent to database (now authenticated)
        await persistStoredConsent('1');

        setMessage({
          type: 'success',
          text: 'Development mode: Mock login successful'
        });

        // Navigate after showing success message
        setTimeout(() => {
          navigate(from, { replace: true });
        }, 1000);
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Instagram login failed. Please try again.'
      });
    } finally {
      setIsInstagramLoading(false);
    }
  };

  /**
   * Facebook OAuth Handler for Instagram Business API Access
   *
   * UPDATED: Now uses official Facebook JavaScript SDK for OAuth
   * This is compliant with Meta's Brand Guidelines (February 2025)
   *
   * @remarks
   * - Uses Facebook SDK's FB.login() method (official approach)
   * - Requests Instagram Business API permissions via Facebook
   * - Complies with Meta Platform Terms (February 2025)
   * - No custom OAuth redirect needed - SDK handles it
   *
   * @see https://developers.facebook.com/docs/facebook-login/web
   */
/**
   * PHASE 3.7: Native Supabase OAuth Handler
   *
   * Uses signInWithOAuth() instead of Facebook SDK
   * Supabase handles Facebook token exchange internally
   *
   * Flow:
   * 1. User consents
   * 2. Log consent to session storage
   * 3. Call supabase.auth.signInWithOAuth({ provider: 'facebook' })
   * 4. Browser redirects to Facebook OAuth dialog
   * 5. User grants permissions
   * 6. Facebook redirects to Supabase callback
   * 7. Supabase exchanges code for token (internal)
   * 8. Supabase redirects to /auth/callback with session
   * 9. FacebookCallback.tsx handles rest (Instagram exchange, auth store update)
   */
  const handleFacebookLogin = async (): Promise<void> => {
    // ============================================
    // STEP 1: CONSENT VALIDATION (CRITICAL)
    // ============================================
    if (!consentGiven) {
      setMessage({
        type: 'error',
        text: 'Please accept the Privacy Policy and Terms of Service to continue.'
      });
      console.warn('⚠️ OAuth attempt without consent - Login blocked');
      return;
    }

    // ============================================
    // STEP 2: SET LOADING STATE
    // ============================================
    setIsFacebookLoading(true);
    setMessage(null);

    try {
      // ============================================
      // STEP 3: LOG CONSENT (BEFORE OAuth redirect)
      // ============================================
      await logConsent();
      console.log('🔵 Initiating Native Supabase OAuth...');
      console.log('   ✅ User consent verified and logged');

      // ============================================
      // STEP 4: DEFINE INSTAGRAM BUSINESS SCOPES
      // Updated: v1.3 - Added business_management + pages_manage_metadata
      // Reference: current-work.md Phase 1 (BLOCKER-01 FIX)
      // ============================================
      const scopes = [
        // Instagram permissions (Core - REQUIRED)
        'instagram_basic',                    // Basic profile info (REQUIRED for IG Business)
        'instagram_manage_insights',          // Analytics & metrics (REQUIRED for data pulls)
        'instagram_manage_messages',          // DM automation
        'instagram_content_publish',          // Post scheduling
        'instagram_manage_comments',          // Comment management

        // Facebook Business permissions (CRITICAL - NEWLY ADDED)
        'pages_show_list',                    // List connected pages (REQUIRED)
        'pages_read_engagement',              // Read page metrics (REQUIRED)
        'business_management',                // Access business account lists (REQUIRED for /me/accounts)
        'pages_manage_metadata',              // Manage page metadata (REQUIRED for IG linkage)

        // Optional but recommended (for advanced features)
        'pages_read_user_content',            // Read user-generated content
        'pages_manage_posts'                  // Broader page management
      ].join(',');

      console.log('📋 Requesting OAuth scopes:', scopes);
      console.log('   Total scopes:', scopes.split(',').length);
      console.log('   Core required: 9 | Optional advanced: 2');

      // ============================================
      // STEP 5: NATIVE SUPABASE OAUTH
      // ============================================
      // This is the critical fix - Supabase handles everything:
      // - Builds OAuth URL with correct parameters
      // - Redirects to Facebook
      // - Receives callback with authorization code
      // - Exchanges code for access token (server-side)
      // - Creates Supabase session with UUID
      // - Stores provider_token in auth.identities
      // - Redirects back to our app with session

      // CRITICAL FIX: Use environment variable or production URL for redirectTo
      // Never use window.location.origin as it could be localhost in dev
      const redirectUrl = import.meta.env.VITE_OAUTH_REDIRECT_URI || 'https://888intelligenceautomation.in/auth/callback';

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: {
          redirectTo: redirectUrl,
          scopes: scopes,
          queryParams: {
            // Request fresh permissions dialog
            auth_type: 'rerequest'
          }
        }
      });

      if (error) {
        console.error('❌ Supabase OAuth error:', error);
        throw error;
      }

      console.log('✅ Redirecting to Facebook OAuth...');
      console.log('   Redirect URL:', data.url);

      // Browser will redirect to Facebook OAuth dialog
      // After user grants permissions, Facebook redirects to Supabase
      // Supabase creates session and redirects to /auth/callback
      // FacebookCallback.tsx handles the rest

    } catch (error) {
      console.error('❌ OAuth Error:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Login failed. Please try again.'
      });
      setIsFacebookLoading(false);
    }
    // Note: No finally block to reset loading - page will redirect
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-xl p-8 rounded-2xl shadow-2xl w-full max-w-2xl border border-white/20 transition-all duration-300">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-r from-pink-500 to-orange-500 flex items-center justify-center">
            <Instagram className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">InstaAutomate</h1>
          <p className="text-gray-400">Sign in to your automation dashboard</p>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`mb-6 p-3 rounded-lg ${
            message.type === 'error' ? 'bg-red-500/10 border border-red-500/30 text-red-400' :
            message.type === 'success' ? 'bg-green-500/10 border border-green-500/30 text-green-400' :
            'bg-blue-500/10 border border-blue-500/30 text-blue-400'
          }`}>
            <p className="text-sm">{message.text}</p>
          </div>
        )}

        {/* ============================================ */}
        {/* CONSENT & PRIVACY POLICY SECTION            */}
        {/* ============================================ */}
        {/* Required by Meta Platform Terms (Feb 2025)  */}
        {/* GDPR Article 7, CCPA Section 1798.100       */}
        {/* ============================================ */}

        <div className="mb-6 space-y-4">

          {/* ============================================ */}
          {/* PERMISSION DISCLOSURE ACCORDION             */}
          {/* ============================================ */}
          {/* Shows users exactly what data will be accessed */}

          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700">

            {/* Accordion Header (Clickable) */}
            <button
              type="button"
              onClick={() => setShowPermissions(!showPermissions)}
              className="w-full flex items-center justify-between text-left hover:opacity-80 transition-opacity"
              aria-expanded={showPermissions}
              aria-controls="permissions-content"
            >
              <div className="flex items-center">
                <Shield className="w-5 h-5 text-blue-400 mr-3 flex-shrink-0" />
                <span className="text-white font-semibold text-base">
                  What we'll access from your Instagram Business account
                </span>
              </div>
              <ChevronRight
                className={`w-5 h-5 text-gray-400 transition-transform duration-200 flex-shrink-0 ${
                  showPermissions ? 'rotate-90' : ''
                }`}
                aria-hidden="true"
              />
            </button>

            {/* Accordion Content (Conditional) */}
            {showPermissions && (
              <div
                id="permissions-content"
                className="mt-4 space-y-3 text-sm text-gray-300 pl-2 animate-in fade-in slide-in-from-top-2 duration-200"
              >
                {/* Permission 1: Basic Profile */}
                <div className="flex items-start">
                  <CheckCircle className="w-4 h-4 text-green-400 mr-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-white">Basic Profile Information</span>
                    <p className="text-gray-400 mt-0.5">
                      Username, profile picture, account type, follower count, and media count
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Permission: <code className="text-blue-400">instagram_basic</code>
                    </p>
                  </div>
                </div>

                {/* Permission 2: Comments */}
                <div className="flex items-start">
                  <CheckCircle className="w-4 h-4 text-green-400 mr-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-white">Comment Management</span>
                    <p className="text-gray-400 mt-0.5">
                      Read comments on your posts, reply to comments, and manage comment interactions
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Permission: <code className="text-blue-400">instagram_manage_comments</code>
                    </p>
                  </div>
                </div>

                {/* Permission 3: Insights */}
                <div className="flex items-start">
                  <CheckCircle className="w-4 h-4 text-green-400 mr-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-white">Analytics & Insights</span>
                    <p className="text-gray-400 mt-0.5">
                      View performance metrics, reach, impressions, engagement data, and audience demographics
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Permission: <code className="text-blue-400">instagram_manage_insights</code>
                    </p>
                  </div>
                </div>

                {/* Permission 4: Messages */}
                <div className="flex items-start">
                  <CheckCircle className="w-4 h-4 text-green-400 mr-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-white">Direct Message Automation</span>
                    <p className="text-gray-400 mt-0.5">
                      Read and send direct messages to automate customer service (24-hour window enforced)
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Permission: <code className="text-blue-400">instagram_manage_messages</code>
                    </p>
                  </div>
                </div>

                {/* Data Usage Disclaimer */}
                <div className="mt-4 pt-3 border-t border-gray-700">
                  <p className="text-xs text-gray-400 italic">
                    💡 <strong>Your data security:</strong> We use industry-standard encryption
                    and never share your data with third parties. You can revoke access at any
                    time through your Instagram settings or our privacy dashboard.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ============================================ */}
          {/* EXPLICIT CONSENT CHECKBOX (CRITICAL)        */}
          {/* ============================================ */}
          {/* MUST be unchecked by default per GDPR/CCPA  */}

          <label
            htmlFor="consent-checkbox"
            className="flex items-start cursor-pointer group"
          >
            <input
              id="consent-checkbox"
              type="checkbox"
              checked={consentGiven}
              onChange={(e) => setConsentGiven(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-2 border-gray-600 text-blue-500
                         focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900
                         cursor-pointer transition-colors"
              aria-describedby="consent-description"
            />
            <span
              id="consent-description"
              className="ml-3 text-sm text-gray-300 leading-relaxed"
            >
              I have read and agree to the{' '}
              <a
                href="https://api.888intelligenceautomation.in/legal/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline underline-offset-2
                           font-medium transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                Privacy Policy
              </a>
              {' '}and{' '}
              <a
                href="https://api.888intelligenceautomation.in/legal/terms-of-service"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline underline-offset-2
                           font-medium transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                Terms of Service
              </a>
              . I understand and consent to 888 Intelligence Automation accessing my
              Instagram Business account data as described above for the purpose of
              providing automation services.
            </span>
          </label>

          {/* ============================================ */}
          {/* COMPLIANCE NOTICE (OPTIONAL BUT RECOMMENDED) */}
          {/* ============================================ */}

          <div className="text-xs text-gray-500 text-center space-y-1">
            <p>
              🔒 Your data is encrypted and protected. We comply with GDPR, CCPA,
              and Meta Platform Terms (February 2025).
            </p>
            <p>
              You can request data deletion at any time through our{' '}
              <a
                href="https://api.888intelligenceautomation.in/legal/data-deletion"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                Privacy Dashboard
              </a>.
            </p>
          </div>

        </div>

        {/* ============================================ */}
        {/* AUTHENTICATION METHODS - 2-COLUMN GRID      */}
        {/* ============================================ */}
        <div className={`
          grid gap-6 mt-8
          ${showFacebookLogin && showInstagramLogin
            ? 'grid-cols-1 md:grid-cols-2'
            : 'grid-cols-1 max-w-md mx-auto'
          }
        `}>

          {/* ============================================ */}
          {/* LEFT COLUMN: FACEBOOK LOGIN (PRIMARY)       */}
          {/* ============================================ */}
          {showFacebookLogin && (
            <div className="flex flex-col space-y-4">

              {/* Yellow Reviewer Notice Badge */}
              {showInstagramLogin && (
                <div className="bg-yellow-500/20 border border-yellow-500/40 rounded-lg px-3 py-2 text-center">
                  <p className="text-yellow-300 text-xs font-semibold uppercase tracking-wide">
                    ⭐ Recommended for Meta Review
                  </p>
                </div>
              )}

              {/* Facebook Login Button - Meta Brand Guidelines Compliant */}
              {/* PHASE 3.7: Native Supabase OAuth - No SDK loading needed */}
              <button
                onClick={handleFacebookLogin}
                disabled={!consentGiven || isFacebookLoading || isAnyAuthLoading}
                className={`
                  w-full py-5 px-6 rounded-lg font-bold text-lg
                  flex items-center justify-center space-x-4
                  transition-all duration-200
                  ${!consentGiven || isFacebookLoading || isAnyAuthLoading
                    ? 'bg-gray-400 cursor-not-allowed opacity-60'
                    : 'bg-[#1877F2] hover:bg-[#0C63D4] active:bg-[#0952b8]'
                  }
                  text-white shadow-2xl hover:shadow-blue-500/50
                  focus:outline-none focus:ring-4 focus:ring-[#1877F2]/50
                  border-4 border-white/20
                  min-h-[90px]
                  transform hover:scale-105 active:scale-95
                `}
                aria-label="Continue with Facebook - Official Login Method for Instagram Business"
                data-testid="facebook-login-button"
                style={{
                  fontFamily: 'Helvetica, Arial, sans-serif',
                  letterSpacing: '0.25px'
                }}
              >
                {isFacebookLoading ? (
                  <div className="flex items-center space-x-3">
                    <svg
                      className="animate-spin h-7 w-7 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span className="text-xl">Redirecting to Facebook...</span>
                  </div>
                ) : (
                  <>
                    {/* Official Facebook "f" Logo - White on Blue background as per brand guidelines */}
                    <svg
                      width="32"
                      height="32"
                      viewBox="0 0 216 216"
                      xmlns="http://www.w3.org/2000/svg"
                      className="flex-shrink-0"
                      aria-hidden="true"
                    >
                      <path
                        fill="#FFFFFF"
                        d="M204.1 0H11.9C5.3 0 0 5.3 0 11.9v192.2c0 6.6 5.3 11.9 11.9 11.9h103.5v-83.6H87.2V99.8h28.1v-24c0-27.9 17-43.1 41.9-43.1 11.9 0 22.2.9 25.2 1.3v29.2h-17.3c-13.5 0-16.2 6.4-16.2 15.9v20.8h32.3l-4.2 32.6h-28.1V216h55c6.6 0 11.9-5.3 11.9-11.9V11.9C216 5.3 210.7 0 204.1 0z"
                      />
                    </svg>
                    <span className="text-xl tracking-wide">Continue with Facebook</span>
                  </>
                )}
              </button>

              {/* Info Box */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 flex-grow">
                <h3 className="text-blue-300 font-semibold text-sm mb-2 flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  Why Facebook Login?
                </h3>
                <p className="text-gray-300 text-xs leading-relaxed">
                  Instagram Business accounts are connected through Facebook. This login securely connects your Instagram Business account for automation and management features.
                </p>
                <p className="text-gray-400 text-xs mt-3 leading-relaxed">
                  Complies with <span className="text-blue-400 font-medium">Meta Platform Terms (February 2025)</span>
                </p>
              </div>

            </div>
          )}

          {/* ============================================ */}
          {/* RIGHT COLUMN: INSTAGRAM LOGIN (LEGACY)      */}
          {/* ============================================ */}
          {showInstagramLogin && (
            <div className="flex flex-col space-y-4">

              {/* Gray Legacy Notice Badge */}
              {showFacebookLogin && (
                <div className="bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-center">
                  <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide">
                    Legacy Authentication Method
                  </p>
                </div>
              )}

              {/* Instagram Login Button */}
              <button
                onClick={handleInstagramLogin}
                disabled={!consentGiven || isInstagramLoading || isAnyAuthLoading}
                className={`
                  w-full py-4 px-6 rounded-xl font-semibold text-lg
                  flex items-center justify-center space-x-3
                  transition-all duration-300 transform
                  ${!consentGiven || isInstagramLoading || isAnyAuthLoading
                    ? 'bg-gray-600 cursor-not-allowed opacity-50'
                    : 'bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 hover:scale-[1.02] active:scale-[0.98]'
                  }
                  text-white shadow-lg hover:shadow-xl
                  focus:outline-none focus:ring-4 focus:ring-pink-500/50
                  min-h-[80px]
                `}
                aria-label="Continue with Instagram (Legacy OAuth)"
                data-testid="instagram-login-button"
              >
                {isInstagramLoading ? (
                  <div className="flex items-center space-x-3">
                    <svg
                      className="animate-spin h-6 w-6 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span>Connecting to Instagram...</span>
                  </div>
                ) : (
                  <>
                    <Instagram className="w-6 h-6 flex-shrink-0" />
                    <span>Continue with Instagram</span>
                  </>
                )}
              </button>

              {/* Info Box */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex-grow">
                <h3 className="text-gray-300 font-semibold text-sm mb-2 flex items-center">
                  <Lock className="w-4 h-4 mr-2" />
                  Instagram Integration Status
                </h3>
                <p className="text-gray-400 text-xs leading-relaxed mb-3">
                  We're currently awaiting Meta API approval for Instagram Business features. Full automation capabilities will be available once approved.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center text-gray-500 text-xs">
                    <Lock className="w-3 h-3 mr-2 flex-shrink-0" />
                    <span>Secure OAuth 2.0 authentication</span>
                  </div>
                  <div className="flex items-center text-gray-500 text-xs">
                    <Lock className="w-3 h-3 mr-2 flex-shrink-0" />
                    <span>End-to-end encryption</span>
                  </div>
                  <div className="flex items-center text-gray-500 text-xs">
                    <Lock className="w-3 h-3 mr-2 flex-shrink-0" />
                    <span>Cloudflare security</span>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Hidden Admin Portal Link */}
        {/* Subtle footer with hidden admin access */}
        <div className="mt-8 pt-6 border-t border-white/10">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>© 2024 888Intelligence</span>
            {/* Hidden admin link - appears as a period but is clickable */}
            <Link
              to="/admin/login"
              className="hover:text-gray-400 transition-colors"
              title="Administrative Access"
              style={{ fontSize: '8px', opacity: 0.3 }}
            >
              •
            </Link>
          </div>
        </div>

        {/* Alternative: More visible admin link - controlled by environment variable */}
        {import.meta.env.VITE_SHOW_ADMIN_LINK === 'true' && (
          <div className="mt-4 text-center">
            <Link
              to="/admin/login"
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors inline-flex items-center"
            >
              Admin Portal <ChevronRight className="w-3 h-3 ml-1" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;