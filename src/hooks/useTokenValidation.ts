// =====================================
// USE TOKEN VALIDATION HOOK - PRODUCTION
// Implements "Lazy Validation" strategy for Instagram access tokens
// NO AUTO-REFRESH, NO CRON JOBS - User-driven reconnection on expiration
//
// Strategy: Validate token on-demand when user loads dashboard
// If expired: Show red banner prompting user to reconnect via OAuth
//
// Error Handling:
// - status: 'active' - Token is valid, user can proceed
// - status: 'expired' - Token invalid (Error 190), user must reconnect
// - status: 'error' - System error (network, rate limit, etc.)
// - status: 'not_found' - No credentials found in database
//
// ✅ UPDATED: Uses useAuthStore for user context
// ✅ UPDATED: Uses useInstagramAccount for businessAccountId
// ✅ UPDATED: Follows project patterns (fetch API, VITE_API_BASE_URL)
// =====================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useInstagramAccount } from './useInstagramAccount';

interface TokenValidationResult {
  /**
   * True if token is valid and active
   */
  isValid: boolean;

  /**
   * True if token is expired or invalid (requires reconnect)
   */
  isExpired: boolean;

  /**
   * True while validation is in progress
   */
  isLoading: boolean;

  /**
   * True if validation encountered a system error (not auth failure)
   */
  isError: boolean;

  /**
   * Error message if validation failed
   */
  error: string | null;

  /**
   * Additional details about token expiration
   * - error_code: Meta API error code (e.g., 190)
   * - error_subcode: More specific error (460=password changed, 463=expired, 467=revoked)
   * - reason: Human-readable reason
   */
  expirationDetails: {
    error_code?: number;
    error_subcode?: number;
    reason?: string;
  } | null;

  /**
   * Manually trigger token validation
   */
  revalidate: () => Promise<void>;
}

/**
 * Hook to validate Instagram access token on-demand
 *
 * Usage:
 * ```tsx
 * const { isExpired, isLoading, revalidate } = useTokenValidation();
 *
 * if (isExpired) {
 *   return <TokenExpiredBanner onReconnect={handleReconnect} />;
 * }
 * ```
 *
 * @returns TokenValidationResult
 */
export const useTokenValidation = (): TokenValidationResult => {
  // ✅ Get user ID from auth store
  const { user } = useAuthStore();

  // ✅ Get Instagram account IDs from useInstagramAccount hook
  const { businessAccountId } = useInstagramAccount();

  // ===== STATE MANAGEMENT =====
  const [isValid, setIsValid] = useState(true); // Assume valid until proven otherwise
  const [isExpired, setIsExpired] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expirationDetails, setExpirationDetails] = useState<{
    error_code?: number;
    error_subcode?: number;
    reason?: string;
  } | null>(null);

  // ✅ Prevent infinite loops - track if validation has been attempted
  const hasValidatedRef = useRef(false);

  /**
   * Validate token by calling backend validation endpoint
   */
  const validateToken = useCallback(async () => {
    // Don't validate if user or businessAccountId is missing
    if (!user?.id || !businessAccountId) {
      console.log('[Token Validation] Skipping validation - no user or businessAccountId');
      return;
    }

    // ✅ CRITICAL: Prevent infinite loops
    // Only run once per mount unless explicitly called via revalidate()
    if (hasValidatedRef.current && isLoading) {
      console.log('[Token Validation] Already validating, skipping...');
      return;
    }

    hasValidatedRef.current = true;
    setIsLoading(true);
    setIsError(false);
    setError(null);

    try {
      // ✅ Use VITE_API_BASE_URL from environment
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

      console.log(`[Token Validation] Validating token for user: ${user.id}`);

      // ✅ Call backend validation endpoint
      const response = await fetch(`${apiBaseUrl}/api/instagram/validate-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.id,
          businessAccountId: businessAccountId
        })
      });

      const result = await response.json();

      // ===== HANDLE RESPONSE BASED ON STATUS =====

      if (result.status === 'active') {
        // ✅ Token is valid
        console.log('[Token Validation] ✅ Token is active');
        setIsValid(true);
        setIsExpired(false);
        setIsError(false);
        setExpirationDetails(null);

      } else if (result.status === 'expired') {
        // ⚠️ Token is expired - User must reconnect
        console.warn('[Token Validation] ⚠️ Token expired:', result.details?.reason);
        setIsValid(false);
        setIsExpired(true);
        setIsError(false);
        setError(result.error || 'Token expired');
        setExpirationDetails(result.details || null);

      } else if (result.status === 'not_found') {
        // ❌ Credentials not found in database
        console.error('[Token Validation] ❌ Credentials not found');
        setIsValid(false);
        setIsExpired(true); // Treat as expired - user needs to reconnect
        setIsError(false);
        setError('No Instagram credentials found. Please connect your account.');
        setExpirationDetails(null);

      } else if (result.status === 'rate_limited') {
        // ⚠️ Rate limit hit - This is a temporary error, not auth failure
        console.warn('[Token Validation] ⚠️ Rate limited');
        setIsValid(true); // Don't mark as expired - this is temporary
        setIsExpired(false);
        setIsError(true);
        setError('Rate limit exceeded. Please try again later.');

      } else {
        // ❌ System error (network, server error, etc.)
        console.error('[Token Validation] ❌ Validation error:', result.error);
        setIsValid(true); // Don't mark as expired - this might be temporary
        setIsExpired(false);
        setIsError(true);
        setError(result.error || 'Failed to validate token');
      }

    } catch (err: any) {
      // ❌ Network error or unexpected error
      console.error('[Token Validation] ❌ Unexpected error:', err);
      setIsValid(true); // Don't mark as expired - network errors are temporary
      setIsExpired(false);
      setIsError(true);
      setError(err.message || 'Network error during token validation');

    } finally {
      setIsLoading(false);
    }
  }, [user?.id, businessAccountId, isLoading]);

  /**
   * Manually trigger revalidation (e.g., after user reconnects)
   */
  const revalidate = useCallback(async () => {
    hasValidatedRef.current = false; // Reset validation flag
    await validateToken();
  }, [validateToken]);

  // ===== EFFECT: Auto-validate on mount or when IDs change =====
  useEffect(() => {
    // Reset validation flag when user or businessAccountId changes
    hasValidatedRef.current = false;
    validateToken();
  }, [user?.id, businessAccountId]);

  return {
    isValid,
    isExpired,
    isLoading,
    isError,
    error,
    expirationDetails,
    revalidate
  };
};

export default useTokenValidation;
