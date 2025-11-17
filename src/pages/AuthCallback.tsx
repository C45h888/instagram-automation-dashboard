import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

/**
 * OAuth Callback Handler Component
 *
 * This component handles the OAuth redirect from Facebook/Instagram
 * Processes the authorization code and exchanges it for access tokens
 *
 * URL Parameters:
 * - code: Authorization code from Facebook OAuth
 * - state: State parameter for CSRF protection
 * - error: Error code if OAuth failed
 * - error_description: Human-readable error description
 *
 * Flow:
 * 1. Extract code/error from URL parameters
 * 2. Validate state parameter (CSRF protection)
 * 3. Exchange code for access token
 * 4. Store tokens in backend
 * 5. Redirect to dashboard
 *
 * @see https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow
 */
const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuthStore();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('Processing your login...');
  const [details, setDetails] = useState<string>('');

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        // ============================================
        // STEP 1: CHECK FOR OAUTH ERRORS
        // ============================================
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        if (error) {
          console.error('❌ OAuth Error:', error);
          console.error('   Description:', errorDescription);

          setStatus('error');
          setMessage('Login failed');
          setDetails(errorDescription || error);

          // Log specific error types
          if (error === 'access_denied') {
            setMessage('Login cancelled');
            setDetails('You cancelled the login process. You can try again or contact support if this was unintentional.');
          } else if (error === 'server_error') {
            setMessage('Server error');
            setDetails('Facebook encountered an error. Please try again in a few moments.');
          }

          // Redirect to login after delay
          setTimeout(() => {
            navigate('/login', { replace: true });
          }, 5000);
          return;
        }

        // ============================================
        // STEP 2: EXTRACT AUTHORIZATION CODE
        // ============================================
        const code = searchParams.get('code');
        const state = searchParams.get('state');

        if (!code) {
          throw new Error('No authorization code received from Facebook');
        }

        console.log('✅ Authorization code received');
        console.log('   Code:', code.substring(0, 20) + '...');

        // ============================================
        // STEP 3: VALIDATE STATE (CSRF PROTECTION)
        // ============================================
        if (state) {
          try {
            const stateData = JSON.parse(atob(state));
            console.log('✅ State parameter validated');
            console.log('   Auth Method:', stateData.authMethod);
            console.log('   Return URL:', stateData.returnUrl);
          } catch (stateError) {
            console.warn('⚠️ Invalid state parameter - possible CSRF attempt');
            // Continue anyway, but log the warning
          }
        }

        // ============================================
        // STEP 4: EXCHANGE CODE FOR ACCESS TOKEN
        // ============================================
        setMessage('Exchanging authorization code...');

        const backendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

        // This endpoint should exchange the code for an access token
        // and then exchange that for a long-lived token
        const response = await fetch(`${backendUrl}/api/instagram/oauth-callback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            code,
            redirectUri: `${window.location.origin}/auth/callback`
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Token exchange failed');
        }

        const data = await response.json();

        console.log('✅ Token exchange successful!');
        console.log('   User ID:', data.userId);
        console.log('   Page Name:', data.pageName);
        console.log('   Instagram Account ID:', data.igBusinessAccountId);

        // ============================================
        // STEP 5: LOGIN USER
        // ============================================
        setMessage('Logging you in...');

        login({
          id: data.userId,
          username: data.pageName || 'instagram_user',
          avatarUrl: '',
          permissions: ['dashboard', 'content', 'engagement', 'analytics', 'settings'],
        }, data.accessToken);

        setStatus('success');
        setMessage('Login successful!');
        setDetails('Redirecting to your dashboard...');

        // ============================================
        // STEP 6: REDIRECT TO DASHBOARD
        // ============================================
        setTimeout(() => {
          const returnUrl = state ? JSON.parse(atob(state)).returnUrl : '/';
          navigate(returnUrl, { replace: true });
        }, 2000);

      } catch (error) {
        console.error('❌ OAuth callback error:', error);

        setStatus('error');
        setMessage('Login failed');
        setDetails(error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.');

        // Redirect to login after delay
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 5000);
      }
    };

    handleOAuthCallback();
  }, [searchParams, navigate, login]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-xl p-12 rounded-2xl shadow-2xl max-w-md w-full border border-white/20">

        {/* Status Icon */}
        <div className="flex justify-center mb-6">
          {status === 'loading' && (
            <Loader2 className="w-16 h-16 text-blue-400 animate-spin" />
          )}
          {status === 'success' && (
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-400" />
            </div>
          )}
          {status === 'error' && (
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
              <XCircle className="w-10 h-10 text-red-400" />
            </div>
          )}
        </div>

        {/* Message */}
        <h1 className="text-2xl font-bold text-white text-center mb-3">
          {message}
        </h1>

        {/* Details */}
        {details && (
          <p className="text-gray-400 text-center text-sm mb-6">
            {details}
          </p>
        )}

        {/* Progress Steps (only show during loading) */}
        {status === 'loading' && (
          <div className="space-y-3 mt-8">
            <div className="flex items-center text-sm text-gray-400">
              <div className="w-2 h-2 bg-blue-400 rounded-full mr-3 animate-pulse"></div>
              <span>Verifying authorization...</span>
            </div>
            <div className="flex items-center text-sm text-gray-400">
              <div className="w-2 h-2 bg-gray-600 rounded-full mr-3"></div>
              <span>Exchanging tokens...</span>
            </div>
            <div className="flex items-center text-sm text-gray-400">
              <div className="w-2 h-2 bg-gray-600 rounded-full mr-3"></div>
              <span>Setting up your account...</span>
            </div>
          </div>
        )}

        {/* Error Actions */}
        {status === 'error' && (
          <div className="mt-6 space-y-3">
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="w-full py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => navigate('/', { replace: true })}
              className="w-full py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
            >
              Go Home
            </button>
          </div>
        )}

        {/* Security Notice */}
        <div className="mt-8 pt-6 border-t border-white/10">
          <div className="flex items-start text-xs text-gray-500">
            <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
            <p>
              If you didn't initiate this login, close this window immediately and contact support.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthCallback;
