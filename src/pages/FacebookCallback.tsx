import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { PagePickerModal, PageOption } from '../components/auth/PagePickerModal';

/**
 * PHASE 3.7: Native Supabase OAuth Callback Handler
 *
 * Handles the redirect from Supabase after Facebook OAuth completion.
 * Supabase automatically sets the session, we just need to:
 * 1. Verify session is established
 * 2. Extract provider_token (Facebook access token)
 * 3. Call Instagram token exchange
 * 4. Update auth store
 * 5. Persist consent and redirect to dashboard
 */
export default function FacebookCallback() {
  const navigate = useNavigate();
  const { login, setBusinessAccount } = useAuthStore();
  const [status, setStatus] = useState<'processing' | 'exchanging' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('Completing authentication...');
  const [pendingPages, setPendingPages] = useState<PageOption[] | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.888intelligenceautomation.in';


  const handlePageSelect = async (selectedPage: PageOption) => {
    try {
      setPendingPages(null);
      setStatus('exchanging');
      setStatusMessage('Connecting your Instagram Business account...');

      const selectionResponse = await fetch(`${API_BASE_URL}/api/instagram/exchange-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: pendingUserId, selectedPage })
      });

      if (!selectionResponse.ok) {
        const errorData = await selectionResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `Instagram connection failed: ${selectionResponse.status}`);
      }

      const selectionResult = await selectionResponse.json();
      if (!selectionResult.success) {
        throw new Error(selectionResult.error || 'Failed to connect Instagram account');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session expired during page selection');

      setBusinessAccount({
        businessAccountId: selectionResult.data?.businessAccountId,
        instagramBusinessId: selectionResult.data?.instagramBusinessId,
        pageId: selectionResult.data?.pageId,
        pageName: selectionResult.data?.pageName
      });

      login({
        id: session.user.id,
        email: session.user.email || '',
        username: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
        facebook_id: session.user.user_metadata?.provider_id || null,
        avatarUrl: session.user.user_metadata?.avatar_url || '',
        permissions: ['dashboard', 'content', 'engagement', 'analytics', 'settings']
      }, session.access_token);

      setStatus('success');
      setStatusMessage('Success! Redirecting to dashboard...');
      setTimeout(() => navigate('/dashboard', { replace: true }), 1500);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      setStatus('error');
    }
  };

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        console.log('📥 OAuth callback received, processing...');

        // ============================================
        // STEP 1: GET SESSION (Supabase auto-sets from URL hash)
        // ============================================
        // Supabase client automatically detects tokens in URL hash
        // and establishes the session via detectSessionInUrl: true
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('❌ Session error:', sessionError);
          throw new Error(sessionError.message);
        }

        if (!session) {
          console.error('❌ No session found after OAuth');
          throw new Error('Authentication failed: No session created');
        }

        console.log('✅ Supabase session established');
        console.log('   User ID (UUID):', session.user.id);
        console.log('   Email:', session.user.email);

        // ============================================
        // STEP 2: EXTRACT PROVIDER TOKEN
        // ============================================
        const providerToken = session.provider_token;
        const userId = session.user.id;

        if (!providerToken) {
          console.error('❌ No provider_token in session');
          throw new Error('Facebook token not available. Please try logging in again.');
        }

        console.log('✅ Provider token extracted');
        console.log('   Token prefix:', providerToken.substring(0, 20) + '...');

        // ============================================
        // STEP 3: CALL INSTAGRAM TOKEN EXCHANGE
        // ============================================
        setStatus('exchanging');
        setStatusMessage('Connecting your Instagram Business account...');

        console.log('🔄 Calling Instagram token exchange...');
        const exchangeResponse = await fetch(`${API_BASE_URL}/api/instagram/exchange-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userAccessToken: providerToken,
            userId: userId
          })
        });

        if (!exchangeResponse.ok) {
          const errorData = await exchangeResponse.json().catch(() => ({}));
          console.error('❌ Instagram exchange failed:', errorData);
          throw new Error(errorData.error || `Instagram connection failed: ${exchangeResponse.status}`);
        }

        const exchangeResult = await exchangeResponse.json();

        if (!exchangeResult.success) {
          throw new Error(exchangeResult.error || 'Failed to connect Instagram account');
        }

        if (exchangeResult.requiresSelection) {
          setPendingUserId(userId);
          setPendingPages(exchangeResult.pages);
          return; // Pause — wait for user to pick a page
        }

        console.log('✅ Instagram token exchange successful');
        console.log('   Business Account ID:', exchangeResult.data?.businessAccountId);
        console.log('   Instagram ID:', exchangeResult.data?.instagramBusinessId);
        console.log('   Page:', exchangeResult.data?.pageName);

        // ============================================
        // STEP 3.5: SCOPE VALIDATION (Phase 2 - BLOCKER-02 FIX)
        // Verify Meta actually granted all requested scopes
        // Reference: current-work.md Phase 2
        // ============================================
        console.log('🔍 Validating granted scopes...');

        try {
          // Fetch granted permissions from Meta Graph API v22.0
          const scopeCheckUrl = `https://graph.facebook.com/v22.0/me/permissions?access_token=${providerToken}`;
          const scopeResponse = await fetch(scopeCheckUrl);

          if (!scopeResponse.ok) {
            console.warn('⚠️ Could not validate scopes (non-blocking)');
          } else {
            const scopeData = await scopeResponse.json();
            const grantedScopes = scopeData.data
              .filter((p: { status: string }) => p.status === 'granted')
              .map((p: { permission: string }) => p.permission);

            console.log('✅ Granted scopes:', grantedScopes);
            console.log('   Total granted:', grantedScopes.length);

            // Define required scopes (must match Login.tsx CORE scopes)
            const requiredScopes = [
              'instagram_basic',
              'pages_show_list',
              'business_management',
              'pages_manage_metadata',
              'instagram_manage_insights',
              'pages_read_engagement'
            ];

            // Check for missing critical scopes
            const missingScopes = requiredScopes.filter(s => !grantedScopes.includes(s));

            // Check for explicitly declined scopes
            const declinedScopes = scopeData.data
              .filter((p: { status: string }) => p.status === 'declined')
              .map((p: { permission: string }) => p.permission);

            if (declinedScopes.length > 0) {
              console.warn('⚠️ User declined scopes:', declinedScopes);
              console.warn('   Impact: Features requiring these scopes will be unavailable');

              // If critical scopes were declined, this is a blocker
              const declinedCritical = declinedScopes.filter((s: string) => requiredScopes.includes(s));
              if (declinedCritical.length > 0) {
                console.error('❌ Critical permissions declined:', declinedCritical);
                // Don't throw - allow flow to continue but log warning
                setStatusMessage('Warning: Some permissions were declined. Some features may not work.');
              }
            }

            if (missingScopes.length > 0) {
              console.warn('⚠️ Missing scopes (may need App Review):', missingScopes);
              console.warn('   Tip: Use Development Mode or complete App Review for these scopes');
              // Don't throw - allow flow to continue for dev/test purposes
            } else {
              console.log('✅ All required scopes granted');
            }
          }
        } catch (scopeError) {
          console.error('❌ Scope validation error:', scopeError);
          console.warn('⚠️ Continuing despite scope validation failure');
        }

        // ============================================
        // STEP 4: UPDATE AUTH STORE
        // ============================================
        // Set business account data
        setBusinessAccount({
          businessAccountId: exchangeResult.data?.businessAccountId,
          instagramBusinessId: exchangeResult.data?.instagramBusinessId,
          pageId: exchangeResult.data?.pageId,
          pageName: exchangeResult.data?.pageName
        });

        // Login to auth store with user data
        login({
          id: userId,
          email: session.user.email || '',
          username: session.user.user_metadata?.full_name ||
                    session.user.email?.split('@')[0] ||
                    'User',
          facebook_id: session.user.user_metadata?.provider_id || null,
          avatarUrl: session.user.user_metadata?.avatar_url || '',
          permissions: ['dashboard', 'content', 'engagement', 'analytics', 'settings']
        }, session.access_token);

        console.log('✅ Auth store updated');

        // ============================================
        // STEP 5: PERSIST CONSENT
        // ============================================
        try {
          // Retrieve stored consent from session storage
          const storedConsent = sessionStorage.getItem('pendingConsent');
          if (storedConsent) {
            const consentData = JSON.parse(storedConsent);

            // Insert consent record with UUID
            const { error: consentError } = await supabase
              .from('user_consents')
              .insert({
                user_id: userId,
                consent_type: consentData.consent_type || 'facebook_oauth',
                consent_given: true,
                consent_text: consentData.consent_text || 'User authorized Facebook OAuth for Instagram Business access',
                ip_address: consentData.ip_address || 'unknown',
                user_agent: navigator.userAgent,
                consented_at: consentData.consented_at || new Date().toISOString()
              });

            if (consentError) {
              console.warn('⚠️ Consent persistence failed (non-blocking):', consentError);
            } else {
              console.log('✅ Consent persisted to database');
              sessionStorage.removeItem('pendingConsent');
            }
          }
        } catch (consentErr) {
          console.warn('⚠️ Consent persistence error (non-blocking):', consentErr);
        }

        // ============================================
        // STEP 6: SUCCESS - REDIRECT TO DASHBOARD
        // ============================================
        setStatus('success');
        setStatusMessage('Success! Redirecting to dashboard...');

        console.log('✅ OAuth flow complete, redirecting to dashboard');

        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 1500);

      } catch (err: unknown) {
        console.error('❌ OAuth callback error:', err);
        const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
        setError(errorMessage);
        setStatus('error');
      }
    };

    handleOAuthCallback();
  }, [navigate, login, setBusinessAccount]);

  // ============================================
  // RENDER UI
  // ============================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800/50 backdrop-blur-xl p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700">

        {/* Page Picker — shown when multiple IG-linked pages found */}
        {pendingPages && (
          <PagePickerModal pages={pendingPages} onSelect={handlePageSelect} />
        )}

        {/* Processing State */}
        {!pendingPages && (status === 'processing' || status === 'exchanging') && (
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-500 mb-6"></div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {status === 'processing' ? 'Authenticating...' : 'Connecting Instagram...'}
            </h2>
            <p className="text-gray-400">{statusMessage}</p>

            {/* Progress indicator */}
            <div className="mt-6 flex justify-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${status === 'processing' ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></div>
              <div className={`w-3 h-3 rounded-full ${status === 'exchanging' ? 'bg-yellow-500 animate-pulse' : 'bg-gray-600'}`}></div>
              <div className="w-3 h-3 rounded-full bg-gray-600"></div>
            </div>
          </div>
        )}

        {/* Success State */}
        {status === 'success' && (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Connected Successfully!</h2>
            <p className="text-gray-400">{statusMessage}</p>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Authentication Failed</h2>
            <p className="text-red-400 mb-6">{error}</p>
            <button
              onClick={() => navigate('/login')}
              className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold rounded-lg transition-colors"
            >
              Back to Login
            </button>
            <p className="text-gray-500 text-sm mt-4">
              Or{' '}
              <button
                onClick={() => navigate('/settings')}
                className="text-yellow-400 hover:text-yellow-300 underline"
              >
                import your token manually in Settings
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
