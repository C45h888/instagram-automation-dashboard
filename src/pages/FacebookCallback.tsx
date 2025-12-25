import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

/**
 * Facebook OAuth Callback Handler
 *
 * This component handles the OAuth callback from Facebook after the user
 * authorizes the application. It:
 * 1. Extracts the authorization code from URL params
 * 2. Sends the code to the backend for token exchange
 * 3. Backend handles signInWithIdToken and dual-ID mapping
 * 4. Redirects to dashboard on success or shows error
 */
export default function FacebookCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { checkSession } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Extract code and state from URL params
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const errorParam = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        // Handle Facebook OAuth errors
        if (errorParam) {
          console.error('Facebook OAuth error:', errorParam, errorDescription);
          setError(errorDescription || `Facebook login failed: ${errorParam}`);
          setIsProcessing(false);
          return;
        }

        // Validate code parameter
        if (!code) {
          console.error('No authorization code received from Facebook');
          setError('Authorization failed: No code received from Facebook');
          setIsProcessing(false);
          return;
        }

        console.log('📥 Facebook OAuth code received, exchanging for token...');

        // Send code to backend for token exchange
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
        const response = await fetch(`${apiBaseUrl}/api/auth/facebook/callback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            code,
            state,
            redirectUri: `${window.location.origin}/auth/callback`
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Server error: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Authentication failed');
        }

        console.log('✅ Facebook authentication successful');

        // Refresh the session in the auth store
        await checkSession();

        // Redirect to dashboard
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 500);

      } catch (err: any) {
        console.error('❌ Facebook callback error:', err);
        setError(err.message || 'An unexpected error occurred during authentication');
        setIsProcessing(false);
      }
    };

    handleCallback();
  }, [searchParams, navigate, checkSession]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md">
        {isProcessing ? (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Completing Facebook Login...
            </h2>
            <p className="text-gray-600">
              Please wait while we authenticate your account.
            </p>
          </div>
        ) : error ? (
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <svg
                className="h-6 w-6 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Authentication Failed
            </h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => navigate('/login')}
              className="inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Back to Login
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
