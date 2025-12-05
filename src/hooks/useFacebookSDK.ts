import { useEffect, useState } from 'react';

/**
 * Facebook SDK Hook - PRODUCTION FIXED VERSION
 *
 * Fixes "init not called with valid version" error by:
 * 1. Using v21.0 (v18.0 is deprecated)
 * 2. Always calling FB.init() explicitly (no shortcuts)
 * 3. Verifying initialization with FB.getLoginStatus test
 * 4. Adding proper error handling
 *
 * @returns {boolean} sdkReady - True when SDK is loaded and VERIFIED initialized
 */

declare global {
  interface Window {
    FB?: any;
    fbAsyncInit?: () => void;
    _fbInitialized?: boolean; // Track if we already initialized
  }
}

export const useFacebookSDK = () => {
  const [sdkReady, setSdkReady] = useState(false);
  const [initAttempted, setInitAttempted] = useState(false);

  useEffect(() => {
    // Prevent multiple initialization attempts
    if (initAttempted) return;

    const initializeFacebookSDK = async () => {
      const appId = import.meta.env.VITE_META_APP_ID;

      console.log('🔵 Attempting Facebook SDK initialization...');
      console.log('   App ID:', appId);

      if (!appId || appId === 'your_meta_app_id_here') {
        console.error('❌ VITE_META_APP_ID not configured. Facebook Login will not work.');
        console.error('   Please set VITE_META_APP_ID in your .env file.');
        return;
      }

      // Check if window.FB exists
      if (!window.FB) {
        console.error('❌ window.FB not loaded yet');
        return;
      }

      // ⚠️ CRITICAL FIX: Always call FB.init() explicitly
      // Never trust that window.FB existing means it's initialized with OUR config
      try {
        console.log('🔄 Calling FB.init() with v21.0...');

        window.FB.init({
          appId: appId,
          cookie: true,           // Enable cookies for session
          xfbml: true,            // Parse social plugins on this page
          version: 'v21.0'        // ⚠️ CRITICAL: Updated from v18.0 to v21.0
        });

        // Mark that we initialized
        window._fbInitialized = true;

        // Log page view for analytics
        if (window.FB.AppEvents && typeof window.FB.AppEvents.logPageView === 'function') {
          window.FB.AppEvents.logPageView();
        }

        console.log('✅ FB.init() called successfully');
        console.log('   App ID:', appId);
        console.log('   SDK Version: v21.0');

        // ⚠️ CRITICAL FIX: Verify initialization by testing FB.getLoginStatus
        // This confirms FB.init() actually worked
        console.log('🔄 Verifying initialization with getLoginStatus test...');

        window.FB.getLoginStatus((response: any) => {
          console.log('✅ Facebook SDK verified and ready');
          console.log('   Status:', response.status);
          setSdkReady(true);
        }, true); // true = force fresh status, don't use cache

      } catch (error: any) {
        console.error('❌ Facebook SDK initialization failed:', error);
        console.error('   Error message:', error.message || 'Unknown error');
        setSdkReady(false);
      }
    };

    // Define the async init callback for SDK
    window.fbAsyncInit = function() {
      console.log('📢 fbAsyncInit callback triggered');
      setInitAttempted(true);
      initializeFacebookSDK();
    };

    // If SDK already loaded, initialize immediately
    if (window.FB) {
      console.log('📢 window.FB detected, initializing immediately');
      setInitAttempted(true);
      initializeFacebookSDK();
    } else {
      // Poll for SDK to load (handles race condition)
      console.log('⏳ Polling for Facebook SDK to load...');
      let pollCount = 0;
      const maxPolls = 100; // 10 seconds (100 * 100ms)

      const checkInterval = setInterval(() => {
        pollCount++;

        if (window.FB) {
          console.log(`✅ Facebook SDK loaded after ${pollCount * 100}ms`);
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
 * Facebook Login Function - PRODUCTION FIXED VERSION
 *
 * Initiates Facebook OAuth flow with requested permissions
 * Now includes proper error handling for "init not called" errors
 *
 * @param {string[]} scopes - Array of Facebook permissions to request
 * @returns {Promise<any>} OAuth response with access token
 */
export const facebookLogin = (scopes: string[]): Promise<any> => {
  return new Promise((resolve, reject) => {
    console.log('🔵 facebookLogin called with scopes:', scopes);

    // Pre-flight checks
    if (!window.FB) {
      console.error('❌ window.FB not available');
      reject(new Error('Facebook SDK not loaded'));
      return;
    }

    if (!window._fbInitialized) {
      console.error('❌ FB.init() was never called');
      reject(new Error('Facebook SDK not initialized - FB.init() not called'));
      return;
    }

    if (typeof window.FB.login !== 'function') {
      console.error('❌ FB.login function not available');
      reject(new Error('Facebook SDK not properly loaded - FB.login missing'));
      return;
    }

    // ⚠️ CRITICAL FIX: Wrap FB.login in try-catch
    // This catches "init not called with valid version" errors
    try {
      console.log('🔄 Calling FB.login()...');

      window.FB.login((response: any) => {
        console.log('📥 FB.login callback received');
        console.log('   Response status:', response.status);

        if (response.authResponse) {
          console.log('✅ Facebook login successful');
          console.log('   Access Token:', response.authResponse.accessToken.substring(0, 20) + '...');
          console.log('   User ID:', response.authResponse.userID);
          console.log('   Granted Scopes:', response.authResponse.grantedScopes);
          resolve(response);
        } else {
          console.log('❌ Facebook login cancelled or failed');
          console.log('   Status:', response.status);
          reject(new Error('User cancelled login or did not fully authorize'));
        }
      }, {
        scope: scopes.join(','),
        return_scopes: true,
        auth_type: 'rerequest' // Force permission dialog even if previously granted
      });

      console.log('✅ FB.login() called without throwing');

    } catch (error: any) {
      // ⚠️ CRITICAL: This catches the "init not called with valid version" error
      console.error('❌ FB.login() threw an error:', error);
      console.error('   Error type:', error.constructor.name);
      console.error('   Error message:', error.message || 'Unknown error');
      console.error('   Inner error:', error.innerError);

      // Provide helpful error message
      if (error.message && error.message.includes('init not called')) {
        reject(new Error(
          'Facebook SDK initialization error: ' + error.message +
          '. This usually means the SDK version is outdated or init failed.'
        ));
      } else {
        reject(new Error('Facebook login error: ' + (error.message || 'Unknown error')));
      }
    }
  });
};
