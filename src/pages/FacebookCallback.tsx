import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

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

useEffect(() => {
  const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN' || event === 'USER_UPDATED') {
      if (session?.provider_token) {
        // Update wherever you store the FB token (authStore, localStorage, etc.)
        console.log('🔄 Provider token refreshed, updating...');
        // Example: if you have a setter in authStore
        // setFacebookToken(session.provider_token);
        
        // Or just log for now to test
        localStorage.setItem('fb_provider_token_latest', session.provider_token);
      }
    }
  });

  return () => listener.subscription.unsubscribe();
}, []);

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

        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

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

        console.log('✅ Instagram token exchange successful');
        console.log('   Business Account ID:', exchangeResult.businessAccountId);
        console.log('   Instagram ID:', exchangeResult.instagramBusinessId);
        console.log('   Page:', exchangeResult.pageName);

        // ============================================
        // STEP 4: UPDATE AUTH STORE
        // ============================================
        // Set business account data
        setBusinessAccount({
          businessAccountId: exchangeResult.businessAccountId,
          instagramBusinessId: exchangeResult.instagramBusinessId,
          pageId: exchangeResult.pageId,
          pageName: exchangeResult.pageName
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

        {/* Processing State */}
        {(status === 'processing' || status === 'exchanging') && (
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
          </div>
        )}
      </div>
    </div>
  );
}
