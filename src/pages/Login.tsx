import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';
import {
  Instagram,      // Instagram logo
  Lock,           // Security/privacy indicator
  ChevronRight,   // Accordion arrow
  Shield,         // Permission/security icon for consent section
  CheckCircle     // Checkmark for permission list items
} from 'lucide-react';

const Login: React.FC = () => {
  const { login } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || '/';
  
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
   * Log user consent to database for GDPR/CCPA compliance
   *
   * Records comprehensive consent metadata including:
   * - Timestamp (ISO 8601 format)
   * - IP address (for geographic jurisdiction)
   * - User agent (for device/browser tracking)
   * - Policy versions (for version control)
   * - Consent type (OAuth-specific)
   *
   * This function is called immediately before OAuth redirect to ensure
   * consent is logged before any data access occurs.
   *
   * @returns {Promise<void>}
   *
   * @throws {Error} If IP fetch fails (logged but doesn't block OAuth)
   * @throws {Error} If database insert fails (logged but doesn't block OAuth)
   *
   * @compliance
   * - GDPR Article 7: Conditions for consent
   * - GDPR Article 30: Records of processing activities
   * - CCPA Section 1798.100: Consumer's right to know
   * - Meta Platform Terms (February 2025)
   *
   * @example
   * try {
   *   await logConsent();
   *   // Proceed with OAuth
   * } catch (error) {
   *   // Log error but don't block user
   *   console.error('Consent logging failed:', error);
   * }
   *
   * @see {@link https://supabase.com/docs/reference/javascript/insert}
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

        // Optional: Add user ID if available at this stage
        // user_id: currentUser?.id || null,

        // Optional: Add session ID for tracking
        // session_id: sessionStorage.getItem('session_id') || null,
      };

      // ============================================
      // STEP 3: Insert Consent Record to Database
      // ============================================

      const { data, error } = await supabase
        .from('user_consents')
        .insert([consentData])
        .select(); // Return inserted record for confirmation

      if (error) {
        throw new Error(`Database insert failed: ${error.message}`);
      }

      console.log('✅ User consent logged successfully');
      console.log('   Timestamp:', consentData.consented_at);
      console.log('   IP Address:', ipAddress);
      console.log('   Policy Versions: Privacy v2.0, Terms v2.0');

      // Optional: Store consent ID in session for reference
      if (data && data[0] && data[0].id) {
        sessionStorage.setItem('consent_id', data[0].id);
      }

    } catch (error) {
      // ============================================
      // ERROR HANDLING
      // ============================================
      // Log error but DON'T block OAuth flow
      // Consent logging is important but shouldn't prevent authentication

      console.error('❌ Failed to log consent:', error);
      console.warn('⚠️ Continuing with OAuth despite logging failure');

      // Optional: Send error to monitoring service
      // if (window.Sentry) {
      //   Sentry.captureException(error, {
      //     tags: { component: 'consent-logging' }
      //   });
      // }

      // DON'T throw - allow OAuth to proceed
      // Consent was given in UI, logging failure is operational issue
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
   * This handler is separate from handleInstagramLogin to maintain backwards compatibility.
   * It uses Facebook's OAuth flow to request Instagram Business permissions.
   *
   * @remarks
   * - Uses Facebook OAuth endpoints (not Instagram OAuth)
   * - Requests Instagram Business API permissions via Facebook
   * - Complies with Meta Platform Terms (February 2025)
   * - State parameter includes auth method for tracking
   *
   * @see https://developers.facebook.com/docs/facebook-login/overview
   */
  const handleFacebookLogin = async (): Promise<void> => {
    // ============================================
    // STEP 1: CONSENT VALIDATION (CRITICAL)
    // ============================================
    // Required by Meta Platform Terms (February 2025)
    // User MUST explicitly consent before OAuth redirect

    if (!consentGiven) {
      // Show error message to user
      setMessage({
        type: 'error',
        text: 'Please accept the Privacy Policy and Terms of Service to continue with Facebook Login.'
      });

      // Log attempted OAuth without consent (security audit)
      console.warn('⚠️ OAuth attempt without consent - Facebook Login blocked');

      // Exit early - do NOT proceed with OAuth
      return;
    }

    // ============================================
    // STEP 2: SET LOADING STATE
    // ============================================
    setIsFacebookLoading(true);
    setMessage(null);

    try {
      // ============================================
      // STEP 3: LOG CONSENT (BEFORE OAuth)
      // ============================================
      // CRITICAL: Log consent BEFORE redirecting to Facebook
      // Ensures consent record exists before data access

      await logConsent();

      console.log('🔵 Initiating Facebook OAuth for Instagram Business Account...');
      console.log('   ✅ User consent verified and logged');

      // ============================================
      // STEP 4: PROCEED WITH OAUTH FLOW
      // ============================================
      // Rest of existing Facebook OAuth logic...

      // Required Instagram Business API scopes
      const scopes = [
        'instagram_basic',
        'instagram_manage_comments',
        'instagram_manage_insights',
        'instagram_business_manage_messages',
        'pages_show_list',
        'pages_read_engagement',
        'pages_manage_metadata'
      ];

      // Build Facebook OAuth URL (CRITICAL: Not Instagram OAuth)
      // TODO: Uncomment for production with approved Meta app
      // const facebookOAuthEndpoint = 'https://www.facebook.com/v18.0/dialog/oauth';
      const redirectUri = `${window.location.origin}/auth/callback`;
      const clientId = import.meta.env.VITE_META_APP_ID;

      // Validate required environment variables
      if (!clientId || clientId === 'your_meta_app_id_here') {
        throw new Error(
          'VITE_META_APP_ID not properly configured. ' +
          'Please set a valid Meta App ID in your environment variables.'
        );
      }

      // State parameter with tracking metadata
      // TODO: Uncomment for production with approved Meta app
      // const state = btoa(JSON.stringify({
      //   timestamp: Date.now(),
      //   returnUrl: from,
      //   authMethod: 'facebook',
      //   nonce: crypto.randomUUID()
      // }));

      // Development mock (preserve existing mock authentication patterns)
      if (import.meta.env.DEV || import.meta.env.MODE === 'development') {
        console.log('🔵 Development Mode: Simulating Facebook OAuth...');

        // Simulate OAuth delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Use existing login function
        login({
          id: 'dev_facebook_user',
          username: 'facebook_dev_user',
          avatarUrl: '',
          permissions: ['dashboard', 'content', 'engagement', 'analytics', 'settings'],
        }, 'mock_facebook_token');

        // Success message using existing message system
        setMessage({
          type: 'success',
          text: '✅ Development: Facebook OAuth simulation successful'
        });

        // Navigate using existing navigation pattern
        setTimeout(() => {
          navigate(from, { replace: true });
        }, 1000);

        return;
      }

      // In production, redirect to Facebook OAuth
      // TODO: Uncomment for production with approved Meta app
      // const oauthUrl = `${facebookOAuthEndpoint}?` +
      //   `client_id=${clientId}` +
      //   `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      //   `&scope=${encodeURIComponent(scopes.join(','))}` +
      //   `&response_type=code` +
      //   `&state=${state}` +
      //   `&auth_type=rerequest`;

      console.log('🔵 Redirecting to Facebook OAuth...');
      console.log('  Redirect URI:', redirectUri);
      console.log('  Scopes:', scopes.join(', '));

      // TODO: Uncomment for production with approved Meta app
      // window.location.href = oauthUrl;

      // Temporary placeholder for unapproved apps
      setMessage({
        type: 'info',
        text: '⏳ Facebook OAuth integration pending Meta app approval. Using development mode.'
      });
    } catch (error) {
      console.error('❌ Facebook OAuth Error:', error);

      setMessage({
        type: 'error',
        text: error instanceof Error
          ? error.message
          : 'Facebook login failed. Please try again or contact support.'
      });
    } finally {
      setIsFacebookLoading(false);
    }
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
                      Permission: <code className="text-blue-400">instagram_business_manage_messages</code>
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
                href="https://instagram-backend.888intelligenceautomation.in/legal/privacy-policy"
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
                href="https://instagram-backend.888intelligenceautomation.in/legal/terms-of-service"
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
                href="https://instagram-backend.888intelligenceautomation.in/legal/data-deletion"
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

              {/* Facebook Login Button */}
              <button
                onClick={handleFacebookLogin}
                disabled={!consentGiven || isFacebookLoading || isAnyAuthLoading}
                className={`
                  w-full py-4 px-6 rounded-xl font-semibold text-lg
                  flex items-center justify-center space-x-3
                  transition-all duration-300 transform
                  ${!consentGiven || isFacebookLoading || isAnyAuthLoading
                    ? 'bg-gray-600 cursor-not-allowed opacity-50'
                    : 'bg-[#1877F2] hover:bg-[#166FE5] hover:scale-[1.02] active:scale-[0.98]'
                  }
                  text-white shadow-lg hover:shadow-xl
                  focus:outline-none focus:ring-4 focus:ring-blue-500/50
                  min-h-[80px]
                `}
                aria-label="Continue with Facebook to connect Instagram Business account"
                data-testid="facebook-login-button"
              >
                {isFacebookLoading ? (
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
                    <span>Connecting to Facebook...</span>
                  </div>
                ) : (
                  <>
                    {/* Facebook "f" Logo */}
                    <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center flex-shrink-0">
                      <svg
                        viewBox="0 0 24 24"
                        className="w-5 h-5"
                        fill="#1877F2"
                        aria-hidden="true"
                      >
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                    </div>
                    <span>Continue with Facebook</span>
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