// =====================================
// TOKEN EXPIRED BANNER COMPONENT
// Displays a prominent alert when Instagram access token is expired
//
// Purpose: Notify users that their token is invalid and they must reconnect
// Trigger: Shown when useTokenValidation hook returns isExpired: true
// Action: Redirect to OAuth flow to get a new token
//
// Design: Red alert box with AlertTriangle icon, clear messaging, and reconnect button
// ✅ Follows project Tailwind patterns (glass-morphism, rounded-2xl, etc.)
// ✅ Uses Lucide React icons
// =====================================

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface TokenExpiredBannerProps {
  /**
   * Callback when user clicks "Reconnect Instagram Account" button
   * Should redirect to OAuth flow (e.g., window.location.href = '/api/auth/instagram')
   */
  onReconnect: () => void;

  /**
   * Optional: Additional details about why token expired
   * - error_code: Meta API error code (e.g., 190)
   * - error_subcode: More specific error (460=password changed, 463=expired, 467=revoked)
   * - reason: Human-readable reason
   */
  expirationDetails?: {
    error_code?: number;
    error_subcode?: number;
    reason?: string;
  } | null;
}

/**
 * Banner component to display when Instagram access token is expired
 *
 * Usage:
 * ```tsx
 * const { isExpired, expirationDetails } = useTokenValidation();
 *
 * if (isExpired) {
 *   return (
 *     <TokenExpiredBanner
 *       onReconnect={() => window.location.href = '/api/auth/instagram'}
 *       expirationDetails={expirationDetails}
 *     />
 *   );
 * }
 * ```
 */
export const TokenExpiredBanner: React.FC<TokenExpiredBannerProps> = ({
  onReconnect,
  expirationDetails
}) => {
  // ===== DETERMINE SPECIFIC REASON FOR EXPIRATION =====
  const getExpirationMessage = () => {
    if (!expirationDetails?.error_subcode) {
      return 'Your Instagram access token has expired or is no longer valid.';
    }

    switch (expirationDetails.error_subcode) {
      case 460:
        return 'Your Instagram access token is invalid because you changed your Instagram or Facebook password.';
      case 463:
        return 'Your Instagram access token has expired. Tokens are valid for 60 days and must be renewed.';
      case 467:
        return 'Your Instagram access token has been revoked. This can happen if you logged out, deauthorized the app, or changed your password.';
      case 490:
        return 'Your Instagram account is not confirmed. Please confirm your account and reconnect.';
      default:
        return expirationDetails.reason || 'Your Instagram access token has expired or is no longer valid.';
    }
  };

  return (
    <div className="glass-morphism-card p-6 rounded-2xl mb-6 border-2 border-red-500/50 bg-red-900/20">
      <div className="flex items-start gap-4">
        {/* Alert Icon */}
        <div className="flex-shrink-0">
          <div className="bg-red-500/20 p-3 rounded-full">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          {/* Title */}
          <h3 className="text-xl font-bold text-red-400 mb-2">
            Instagram Connection Expired
          </h3>

          {/* Message */}
          <p className="text-gray-300 mb-1 leading-relaxed">
            {getExpirationMessage()}
          </p>

          <p className="text-gray-400 text-sm mb-4 leading-relaxed">
            Please reconnect your Instagram account to continue using the dashboard.
            You'll be redirected to Instagram to authorize the app again. This only takes a few seconds.
          </p>

          {/* Action Button */}
          <button
            onClick={onReconnect}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg
                     font-semibold transition-all duration-200 flex items-center gap-2
                     shadow-lg hover:shadow-red-500/30 hover:scale-105 active:scale-95"
          >
            <RefreshCw className="w-5 h-5" />
            Reconnect Instagram Account
          </button>

          {/* Debug Info (only shown in development) */}
          {import.meta.env.DEV && expirationDetails && (
            <div className="mt-4 p-3 bg-gray-900/50 rounded-lg border border-gray-700">
              <p className="text-xs text-gray-400 font-mono">
                <strong>Debug Info:</strong><br />
                Error Code: {expirationDetails.error_code || 'N/A'}<br />
                Error Subcode: {expirationDetails.error_subcode || 'N/A'}<br />
                Reason: {expirationDetails.reason || 'N/A'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TokenExpiredBanner;
