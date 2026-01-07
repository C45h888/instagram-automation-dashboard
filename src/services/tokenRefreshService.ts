/**
 * Token Refresh Service
 *
 * Manages automatic refresh of Instagram access tokens before expiration
 * Long-lived tokens expire after 60 days, this service ensures they stay fresh
 *
 * Features:
 * - Automatic token refresh 7 days before expiration
 * - Background refresh (doesn't interrupt user)
 * - Error handling and retry logic
 * - Notification on refresh failure
 *
 * Security Best Practice:
 * - Backend does NOT return the new token (stored securely server-side)
 * - Frontend only needs to know if refresh succeeded
 *
 * @see https://developers.facebook.com/docs/instagram-basic-display-api/guides/long-lived-access-tokens
 */

import { supabase } from '../lib/supabase';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface TokenRefreshResult {
  success: boolean;
  expiresIn?: number; // Seconds until expiration
  expiresAt?: string; // ISO timestamp
  error?: string;
  code?: string; // Error code from backend
  requiresReconnect?: boolean; // If true, user must re-authenticate
}

export interface TokenInfo {
  userId: string;
  businessAccountId: string | null;
  accessToken: string;
  expiresAt: string | null;
  createdAt: string | null;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const REFRESH_THRESHOLD_DAYS = 7; // Refresh tokens 7 days before expiration
const REFRESH_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // Check daily (24 hours)
const MAX_RETRY_ATTEMPTS = 3;

// =============================================================================
// TOKEN REFRESH FUNCTIONS
// =============================================================================

/**
 * Refreshes a long-lived access token
 *
 * Makes API call to backend which calls Meta to exchange current token for a new one
 * Backend updates token in database with new expiration date
 *
 * Security Note: Backend does NOT return the new token (security best practice)
 *
 * @param userId - User UUID
 * @param businessAccountId - Instagram Business account ID
 * @returns TokenRefreshResult with success status and expiration info
 */
export async function refreshAccessToken(
  userId: string,
  businessAccountId: string
): Promise<TokenRefreshResult> {
  try {
    console.log('🔄 Refreshing access token...');
    console.log('   User ID:', userId);
    console.log('   Business Account ID:', businessAccountId);

    // Call backend endpoint to refresh token
    const backendUrl = import.meta.env.VITE_API_BASE_URL || 'https://api.888intelligenceautomation.in';
    const response = await fetch(`${backendUrl}/api/instagram/refresh-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId,
        businessAccountId
      })
    });

    const data = await response.json();

    // Handle different response status codes
    if (!response.ok) {
      console.error('❌ Token refresh failed:', data);

      // Token expired - user must reconnect
      if (data.code === 'TOKEN_EXPIRED_REQUIRE_LOGIN') {
        console.error('   Token has expired - user must reconnect Instagram account');
        return {
          success: false,
          error: data.error || 'Token has expired',
          code: data.code,
          requiresReconnect: true
        };
      }

      // Other errors
      return {
        success: false,
        error: data.error || data.message || 'Token refresh failed',
        code: data.code || 'UNKNOWN_ERROR'
      };
    }

    // Success response
    console.log('✅ Token refreshed successfully!');
    console.log('   New expiration:', data.data.expires_at);
    console.log('   Expires in:', data.data.expires_in_seconds, 'seconds');

    return {
      success: true,
      expiresIn: data.data.expires_in_seconds,
      expiresAt: data.data.expires_at
    };

  } catch (error) {
    console.error('❌ Token refresh error:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      code: 'NETWORK_ERROR'
    };
  }
}

/**
 * Checks if a token needs to be refreshed
 *
 * Returns true if token expires within REFRESH_THRESHOLD_DAYS
 *
 * @param expiresAt - ISO timestamp of token expiration
 * @returns boolean - true if token should be refreshed
 */
export function shouldRefreshToken(expiresAt: string): boolean {
  const expirationDate = new Date(expiresAt);
  const now = new Date();
  const daysUntilExpiration = (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  const shouldRefresh = daysUntilExpiration <= REFRESH_THRESHOLD_DAYS;

  if (shouldRefresh) {
    console.log(`⚠️ Token expires in ${Math.floor(daysUntilExpiration)} days - refresh needed`);
  }

  return shouldRefresh;
}

/**
 * Gets tokens that need refreshing from database
 *
 * Queries instagram_credentials table for tokens expiring soon
 *
 * @returns Array of TokenInfo objects
 */
export async function getTokensNeedingRefresh(): Promise<TokenInfo[]> {
  try {
    // Calculate threshold date (current date + REFRESH_THRESHOLD_DAYS)
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + REFRESH_THRESHOLD_DAYS);

    // Query database for tokens expiring before threshold
    // NOTE: We don't select page_access_token here (security best practice)
    const { data, error } = await supabase
      .from('instagram_credentials')
      .select('user_id, business_account_id, expires_at, created_at')
      .lt('expires_at', thresholdDate.toISOString())
      .order('expires_at', { ascending: true });

    if (error) {
      console.error('❌ Error fetching tokens:', error);
      return [];
    }

    return (data || []).map(row => ({
      userId: row.user_id,
      businessAccountId: row.business_account_id,
      accessToken: '', // Not retrieved for security reasons
      expiresAt: row.expires_at,
      createdAt: row.created_at
    }));

  } catch (error) {
    console.error('❌ Error in getTokensNeedingRefresh:', error);
    return [];
  }
}

/**
 * Refreshes all tokens that are expiring soon
 *
 * Background job that runs periodically to refresh tokens
 * Should be called from a cron job or interval timer
 *
 * @returns Object with success/failure counts
 */
export async function refreshAllExpiringTokens(): Promise<{
  total: number;
  succeeded: number;
  failed: number;
  requireReconnect: number;
}> {
  console.log('🔄 Starting automatic token refresh job...');

  const tokensToRefresh = await getTokensNeedingRefresh();

  console.log(`   Found ${tokensToRefresh.length} tokens to refresh`);

  let succeeded = 0;
  let failed = 0;
  let requireReconnect = 0;

  for (const tokenInfo of tokensToRefresh) {
    // Skip tokens without business account ID
    if (!tokenInfo.businessAccountId) {
      console.warn(`⚠️ Skipping token refresh - missing business account ID for user ${tokenInfo.userId}`);
      failed++;
      continue;
    }

    const result = await refreshAccessToken(
      tokenInfo.userId,
      tokenInfo.businessAccountId
    );

    if (result.success) {
      succeeded++;
    } else if (result.requiresReconnect) {
      requireReconnect++;
      // TODO: Send notification to user about needing to reconnect
      console.error(`❌ User ${tokenInfo.userId} needs to reconnect Instagram account`);
    } else {
      failed++;
      // TODO: Send notification to user about token refresh failure
      console.error(`❌ Failed to refresh token for user ${tokenInfo.userId}: ${result.error}`);
    }

    // Add delay between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('✅ Token refresh job complete');
  console.log(`   Succeeded: ${succeeded}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Require Reconnect: ${requireReconnect}`);

  return {
    total: tokensToRefresh.length,
    succeeded,
    failed,
    requireReconnect
  };
}

/**
 * Starts automatic token refresh interval
 *
 * Checks for expiring tokens every 24 hours and refreshes them
 * Should be called once when app initializes
 *
 * @returns Interval ID (can be used to clear interval with clearInterval)
 */
export function startTokenRefreshInterval(): NodeJS.Timeout {
  console.log('🚀 Starting automatic token refresh service...');
  console.log(`   Check interval: Every ${REFRESH_CHECK_INTERVAL / (1000 * 60 * 60)} hours`);
  console.log(`   Refresh threshold: ${REFRESH_THRESHOLD_DAYS} days before expiration`);

  // Run immediately on start
  refreshAllExpiringTokens();

  // Then run every 24 hours
  const intervalId = setInterval(() => {
    refreshAllExpiringTokens();
  }, REFRESH_CHECK_INTERVAL);

  return intervalId;
}

/**
 * Manually refreshes token for a specific user
 *
 * Useful for on-demand refresh when user encounters auth errors
 *
 * @param userId - User UUID
 * @param businessAccountId - Instagram Business account ID
 * @returns TokenRefreshResult
 */
export async function manualTokenRefresh(
  userId: string,
  businessAccountId: string
): Promise<TokenRefreshResult> {
  console.log('🔄 Manual token refresh requested');

  let attempts = 0;
  let lastError: string | undefined;
  let lastCode: string | undefined;
  let requiresReconnect = false;

  // Retry up to MAX_RETRY_ATTEMPTS times
  while (attempts < MAX_RETRY_ATTEMPTS) {
    attempts++;

    console.log(`   Attempt ${attempts}/${MAX_RETRY_ATTEMPTS}`);

    const result = await refreshAccessToken(userId, businessAccountId);

    if (result.success) {
      return result;
    }

    // If token expired, don't retry - user must reconnect
    if (result.requiresReconnect) {
      console.error('   Token expired - user must reconnect, skipping retries');
      return result;
    }

    lastError = result.error;
    lastCode = result.code;

    // Wait before retrying (exponential backoff)
    if (attempts < MAX_RETRY_ATTEMPTS) {
      const delay = Math.pow(2, attempts) * 1000; // 2s, 4s, 8s
      console.log(`   Retrying in ${delay / 1000}s...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  console.error(`❌ Manual token refresh failed after ${MAX_RETRY_ATTEMPTS} attempts`);

  return {
    success: false,
    error: lastError || 'Max retry attempts exceeded',
    code: lastCode || 'MAX_RETRIES_EXCEEDED',
    requiresReconnect
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Checks token expiration and returns human-readable time remaining
 *
 * @param expiresAt - ISO timestamp of token expiration
 * @returns Human-readable string (e.g., "45 days", "3 hours", "expired")
 */
export function getTokenExpirationStatus(expiresAt: string): string {
  const expirationDate = new Date(expiresAt);
  const now = new Date();
  const msRemaining = expirationDate.getTime() - now.getTime();

  if (msRemaining <= 0) {
    return 'expired';
  }

  const daysRemaining = Math.floor(msRemaining / (1000 * 60 * 60 * 24));
  const hoursRemaining = Math.floor((msRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (daysRemaining > 0) {
    return `${daysRemaining} day${daysRemaining > 1 ? 's' : ''}`;
  } else if (hoursRemaining > 0) {
    return `${hoursRemaining} hour${hoursRemaining > 1 ? 's' : ''}`;
  } else {
    const minutesRemaining = Math.floor(msRemaining / (1000 * 60));
    return `${minutesRemaining} minute${minutesRemaining > 1 ? 's' : ''}`;
  }
}

/**
 * Checks if token is expired
 *
 * @param expiresAt - ISO timestamp of token expiration
 * @returns boolean - true if token is expired
 */
export function isTokenExpired(expiresAt: string): boolean {
  const expirationDate = new Date(expiresAt);
  const now = new Date();
  return expirationDate.getTime() <= now.getTime();
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  refreshAccessToken,
  shouldRefreshToken,
  getTokensNeedingRefresh,
  refreshAllExpiringTokens,
  startTokenRefreshInterval,
  manualTokenRefresh,
  getTokenExpirationStatus,
  isTokenExpired
};
