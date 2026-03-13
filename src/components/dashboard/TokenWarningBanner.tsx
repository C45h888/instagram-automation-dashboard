// src/components/dashboard/TokenWarningBanner.tsx
// Proactive warning banner shown when UAT is approaching expiry (warning/critical),
// or when data_access_expires_at is approaching (separate Meta-controlled window).
// Distinct from TokenExpiredBanner (which handles already-expired tokens).

import React from 'react';
import { AlertTriangle, Clock, RefreshCw, ShieldAlert } from 'lucide-react';
import type { UatStatus } from '../../hooks/useTokenStatus';

interface TokenWarningBannerProps {
  uat: Pick<UatStatus, 'status' | 'warning' | 'expiresAt' | 'dataAccessStatus' | 'dataAccessWarning'>;
  onRefresh?: () => void | Promise<unknown>;
  isRefreshing?: boolean;
}

export const TokenWarningBanner: React.FC<TokenWarningBannerProps> = ({
  uat,
  onRefresh,
  isRefreshing = false,
}) => {
  const isCritical = uat.status === 'critical';
  const hasDataAccessWarning = uat.dataAccessStatus === 'warning' || uat.dataAccessStatus === 'critical' || uat.dataAccessStatus === 'expired';
  const isDataAccessCritical = uat.dataAccessStatus === 'critical' || uat.dataAccessStatus === 'expired';

  const daysRemaining = uat.expiresAt
    ? Math.ceil((new Date(uat.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const message = uat.warning
    || (daysRemaining !== null
      ? `Your access token expires in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}.`
      : 'Your access token is expiring soon.');

  return (
    <div className="space-y-2 mb-4">
      {/* UAT expiry warning row */}
      <div className={`glass-morphism-card p-4 rounded-2xl border-2 ${
        isCritical ? 'border-orange-500/50 bg-orange-900/20' : 'border-yellow-500/50 bg-yellow-900/10'
      }`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`flex-shrink-0 p-2 rounded-full ${
              isCritical ? 'bg-orange-500/20' : 'bg-yellow-500/20'
            }`}>
              {isCritical
                ? <AlertTriangle className="w-5 h-5 text-orange-400" />
                : <Clock className="w-5 h-5 text-yellow-400" />
              }
            </div>
            <div>
              <p className={`font-semibold text-sm ${isCritical ? 'text-orange-400' : 'text-yellow-400'}`}>
                {isCritical ? 'Token Expiring Soon' : 'Token Expiry Notice'}
              </p>
              <p className="text-gray-300 text-sm">{message}</p>
            </div>
          </div>

          {onRefresh && (
            <button
              onClick={() => onRefresh()}
              disabled={isRefreshing}
              className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
                         transition-all duration-200 hover:scale-105 active:scale-95 disabled:cursor-not-allowed
                         ${isCritical
                           ? 'bg-orange-600 hover:bg-orange-700 disabled:bg-orange-800 text-white'
                           : 'bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-800 text-white'
                         }`}
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh Token'}
            </button>
          )}
        </div>
      </div>

      {/* Data access expiry row — shown independently when approaching */}
      {hasDataAccessWarning && uat.dataAccessWarning && (
        <div className={`glass-morphism-card p-4 rounded-2xl border-2 ${
          isDataAccessCritical ? 'border-red-500/40 bg-red-900/10' : 'border-amber-500/40 bg-amber-900/10'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`flex-shrink-0 p-2 rounded-full ${
              isDataAccessCritical ? 'bg-red-500/20' : 'bg-amber-500/20'
            }`}>
              <ShieldAlert className={`w-5 h-5 ${isDataAccessCritical ? 'text-red-400' : 'text-amber-400'}`} />
            </div>
            <div>
              <p className={`font-semibold text-sm ${isDataAccessCritical ? 'text-red-400' : 'text-amber-400'}`}>
                Data Access Expiring
              </p>
              <p className="text-gray-300 text-sm">{uat.dataAccessWarning}</p>
              <p className="text-gray-500 text-xs mt-0.5">
                Refreshing the token won't renew this — reconnect via OAuth to reset.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TokenWarningBanner;
