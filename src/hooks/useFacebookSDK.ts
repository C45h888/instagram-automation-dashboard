import { useEffect, useState } from 'react';

/**
 * Facebook SDK Hook
 *
 * Initializes the Facebook JavaScript SDK with proper configuration
 * Required for official Facebook Login button functionality
 *
 * @returns {boolean} sdkReady - True when SDK is loaded and initialized
 */

declare global {
  interface Window {
    FB?: any;
    fbAsyncInit?: () => void;
  }
}

export const useFacebookSDK = () => {
  const [sdkReady, setSdkReady] = useState(false);
  const [initAttempted, setInitAttempted] = useState(false);

  useEffect(() => {
    // Prevent multiple initialization attempts
    if (initAttempted) return;

    const initializeFacebookSDK = () => {
      const appId = import.meta.env.VITE_META_APP_ID;

      if (!appId || appId === 'your_meta_app_id_here') {
        console.error('❌ VITE_META_APP_ID not configured. Facebook Login will not work.');
        console.error('   Please set VITE_META_APP_ID in your .env file.');
        return;
      }

      // Check if already initialized
      if (window.FB && typeof window.FB.getLoginStatus === 'function') {
        console.log('✅ Facebook SDK already initialized');
        setSdkReady(true);
        return;
      }

      // Initialize if SDK is loaded but not initialized
      if (window.FB && typeof window.FB.init === 'function') {
        window.FB.init({
          appId: appId,
          cookie: true,           // Enable cookies for session
          xfbml: true,            // Parse social plugins on this page
          version: 'v18.0'        // Use latest stable API version
        });

        // Log page view for analytics
        window.FB.AppEvents.logPageView();

        console.log('✅ Facebook SDK initialized successfully');
        console.log('   App ID:', appId);
        console.log('   SDK Version: v18.0');

        setSdkReady(true);
        return;
      }
    };

    // Define the async init callback for SDK
    window.fbAsyncInit = function() {
      setInitAttempted(true);
      initializeFacebookSDK();
    };

    // If SDK already loaded, initialize immediately
    if (window.FB) {
      setInitAttempted(true);
      initializeFacebookSDK();
    } else {
      // Poll for SDK to load (handles race condition)
      let pollCount = 0;
      const maxPolls = 100; // 10 seconds (100 * 100ms)

      const checkInterval = setInterval(() => {
        pollCount++;

        if (window.FB) {
          clearInterval(checkInterval);
          setInitAttempted(true);
          initializeFacebookSDK();
        } else if (pollCount >= maxPolls) {
          clearInterval(checkInterval);
          console.error('❌ Facebook SDK failed to load after 10 seconds');
          console.error('   Check your internet connection and firewall settings');
        }
      }, 100); // Check every 100ms

      // Cleanup function
      return () => clearInterval(checkInterval);
    }
  }, []); // Empty dependency array - run once on mount

  return sdkReady;
};

/**
 * Facebook Login Status Check
 *
 * Checks if user is currently logged into Facebook
 *
 * @returns {Promise<any>} Facebook login status response
 */
export const checkFacebookLoginStatus = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if (!window.FB) {
      reject(new Error('Facebook SDK not loaded'));
      return;
    }

    // Verify SDK is fully initialized before calling getLoginStatus
    if (typeof window.FB.getLoginStatus !== 'function') {
      reject(new Error('Facebook SDK not initialized - FB.init() not called yet'));
      return;
    }

    window.FB.getLoginStatus((response: any) => {
      resolve(response);
    });
  });
};

/**
 * Facebook Login Function
 *
 * Initiates Facebook OAuth flow with requested permissions
 *
 * @param {string[]} scopes - Array of Facebook permissions to request
 * @returns {Promise<any>} OAuth response with access token
 */
export const facebookLogin = (scopes: string[]): Promise<any> => {
  return new Promise((resolve, reject) => {
    if (!window.FB) {
      reject(new Error('Facebook SDK not loaded'));
      return;
    }

    window.FB.login((response: any) => {
      if (response.authResponse) {
        console.log('✅ Facebook login successful');
        console.log('   Access Token:', response.authResponse.accessToken.substring(0, 20) + '...');
        console.log('   Granted Scopes:', response.authResponse.grantedScopes);
        resolve(response);
      } else {
        console.log('❌ Facebook login cancelled or failed');
        reject(new Error('User cancelled login or did not fully authorize'));
      }
    }, {
      scope: scopes.join(','),
      return_scopes: true,
      auth_type: 'rerequest' // Force permission dialog even if previously granted
    });
  });
};
