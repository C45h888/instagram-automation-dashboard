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

  useEffect(() => {
    // Check if SDK already loaded
    if (window.FB) {
      setSdkReady(true);
      return;
    }

    // Initialize SDK when script loads
    window.fbAsyncInit = function() {
      const appId = import.meta.env.VITE_META_APP_ID;

      if (!appId || appId === '1449604936071207') {
        console.error('❌ VITE_META_APP_ID not configured. Facebook Login will not work.');
        console.error('   Please set VITE_META_APP_ID in your .env file.');
        return;
      }

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
    };

    // If SDK script already loaded but not initialized, call init
    if (typeof window.FB !== 'undefined' && !sdkReady) {
      window.fbAsyncInit();
    }
  }, [sdkReady]);

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
