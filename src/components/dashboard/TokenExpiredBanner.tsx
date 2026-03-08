// =====================================
// TOKEN EXPIRED BANNER COMPONENT
// Displays a prominent alert when Instagram access token is expired
//
// Purpose: Notify users that their token is invalid and they must reconnect
// Trigger: Shown when useTokenValidation hook returns isExpired: true
// Action: Try refresh first, fall back to OAuth reconnect
//
// Design: Red alert box with AlertTriangle icon, clear messaging, and action buttons
// =====================================

import React, { useState } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

interface TokenExpiredBannerProps {
  /**
   * Callback when user clicks "Reconnect Instagram Account" button
   * Should redirect to OAuth flow
   */
  onReconnect: () => void;

  /**
   * Optional: Attempt to refresh the token before requiring full OAuth reconnect
   * Returns { success, requiresReconnect? } — if requiresReconnect, refresh button hides
   */
  onRefresh?: () => Promise<{ success: boolean; requiresReconnect?: boolean }>;

  /**
   * Optional: True while token refresh is in progress
   */
  isRefreshing?: boolean;

  /**
   * Optional: Additional details about why token expired
   */
  expirationDetails?: {
    error_code?: number;
    error_subcode?: number;
    reason?: string;
  } | null;
}

export const TokenExpiredBanner: React.FC<TokenExpiredBannerProps> = ({
  onReconnect,
  onRefresh,
  isRefreshing = false,
  expirationDetails
}) => {
  const [refreshFailed, setRefreshFailed] = useState(false);

  const getExpirationMessage = () => {
    if (!expirationDetails?.error_subcode) {
      return 'Your Instagram access token has expired or is no longer valid.';
    }

    switch (expirationDetails.error_subcode) {
      case 460:
        return 'Your Instagram access token is invalid because you changed your Instagram or Facebook password.';
      case 463:
        return 'Your Instagram access token has been revoked or deauthorized. Please reconnect your account to restore access.';
      case 467:
        return 'Your Instagram access token has been revoked. This can happen if you logged out, deauthorized the app, or changed your password.';
      case 490:
        return 'Your Instagram account is not confirmed. Please confirm your account and reconnect.';
      default:
        return expirationDetails.reason || 'Your Instagram access token has expired or is no longer valid.';
    }
  };

  const handleRefresh = async () => {
    if (!onRefresh) return;

    const result = await onRefresh();

    if (result.success) {
      // Banner will auto-dismiss when parent isExpired becomes false
      return;
    }

    if (result.requiresReconnect) {
      setRefreshFailed(true);
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
          <h3 className="text-xl font-bold text-red-400 mb-2">
            Instagram Connection Expired
          </h3>

          <p className="text-gray-300 mb-1 leading-relaxed">
            {getExpirationMessage()}
          </p>

          {refreshFailed ? (
            <p className="text-amber-400 text-sm mb-4 leading-relaxed">
              Token cannot be refreshed — please reconnect your account.
            </p>
          ) : (
            <p className="text-gray-400 text-sm mb-4 leading-relaxed">
              {onRefresh && !refreshFailed
                ? 'Try refreshing the token first. If that doesn\'t work, you\'ll need to reconnect.'
                : 'Please reconnect your Instagram account to continue using the dashboard.'}
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            {/* Try Refresh button — shown when onRefresh provided and refresh hasn't failed */}
            {onRefresh && !refreshFailed && (
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="bg-amber-600 hover:bg-amber-700 disabled:bg-amber-800 disabled:cursor-not-allowed
                         text-white px-6 py-3 rounded-lg font-semibold transition-all duration-200
                         flex items-center gap-2 shadow-lg hover:shadow-amber-500/30
                         hover:scale-105 active:scale-95 disabled:hover:scale-100"
              >
                <RotateCcw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Refreshing...' : 'Try Refresh'}
              </button>
            )}

            {/* Reconnect button — always visible as fallback */}
            <button
              onClick={onReconnect}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg
                       font-semibold transition-all duration-200 flex items-center gap-2
                       shadow-lg hover:shadow-red-500/30 hover:scale-105 active:scale-95"
            >
              <RefreshCw className="w-5 h-5" />
              Reconnect Instagram Account
            </button>
          </div>

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
