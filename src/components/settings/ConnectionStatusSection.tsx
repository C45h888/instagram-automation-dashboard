import React, { forwardRef } from 'react';
import { Wifi, RefreshCw, Copy, Check, CheckCircle, XCircle, AlertCircle, Clock } from 'lucide-react';
import { useTokenValidation } from '../../hooks/useTokenValidation';
import { useInstagramAccount } from '../../hooks/useInstagramAccount';
import { useAuthStore } from '../../stores/authStore';

const CopyInline: React.FC<{ value: string }> = ({ value }) => {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="p-1 text-gray-500 hover:text-yellow-400 transition-colors rounded flex-shrink-0">
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
};

const formatRelativeTime = (dateStr: string | null): string => {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

interface ConnectionStatusSectionProps {
  onScrollToToken?: () => void;
}

const ConnectionStatusSection = forwardRef<HTMLDivElement, ConnectionStatusSectionProps>(
  ({ onScrollToToken }, ref) => {
    const { isValid, isExpired, isLoading, isError, error, expirationDetails, revalidate } = useTokenValidation();
    const { accounts, instagramBusinessId, businessAccountId } = useInstagramAccount();
    const { pageId, pageName } = useAuthStore();

    const primaryAccount = accounts[0];

    const statusConfig = (() => {
      if (isLoading) return {
        icon: <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />,
        label: 'Validating token...',
        classes: 'bg-gray-700/50 border-gray-600 text-gray-300',
        dot: 'bg-gray-400'
      };
      if (isExpired) return {
        icon: <XCircle className="w-5 h-5 text-red-400" />,
        label: 'Token Expired',
        classes: 'bg-red-500/10 border-red-500/30 text-red-300',
        dot: 'bg-red-400'
      };
      if (isError) return {
        icon: <AlertCircle className="w-5 h-5 text-yellow-400" />,
        label: 'Validation Error',
        classes: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300',
        dot: 'bg-yellow-400'
      };
      if (isValid) return {
        icon: <CheckCircle className="w-5 h-5 text-green-400" />,
        label: 'Token Active',
        classes: 'bg-green-500/10 border-green-500/30 text-green-300',
        dot: 'bg-green-400 animate-pulse'
      };
      return {
        icon: <AlertCircle className="w-5 h-5 text-gray-400" />,
        label: 'Unknown',
        classes: 'bg-gray-700/50 border-gray-600 text-gray-300',
        dot: 'bg-gray-400'
      };
    })();

    return (
      <div ref={ref} className="glass-morphism-card p-6 rounded-2xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-500/20 rounded-xl flex items-center justify-center">
            <Wifi className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Connection Status</h2>
            <p className="text-gray-400 text-sm">Live token health and account link details</p>
          </div>
        </div>

        {/* Status Banner */}
        <div className={`flex items-center justify-between p-4 rounded-xl border ${statusConfig.classes}`}>
          <div className="flex items-center gap-3">
            <span className={`w-2.5 h-2.5 rounded-full ${statusConfig.dot}`} />
            {statusConfig.icon}
            <div>
              <p className="font-semibold">{statusConfig.label}</p>
              {isExpired && expirationDetails?.reason && (
                <p className="text-xs mt-0.5 text-red-400">{expirationDetails.reason}</p>
              )}
              {isExpired && expirationDetails?.error_subcode && (
                <p className="text-xs text-gray-500">
                  Code: {expirationDetails.error_code} / {expirationDetails.error_subcode}
                </p>
              )}
              {isError && error && (
                <p className="text-xs mt-0.5 text-yellow-400">{error}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => revalidate()}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Revalidate
          </button>
        </div>

        {/* Expired CTA */}
        {isExpired && onScrollToToken && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 flex items-center justify-between gap-4">
            <p className="text-gray-300 text-sm">Your token needs to be refreshed to continue using the dashboard.</p>
            <button
              onClick={onScrollToToken}
              className="flex-shrink-0 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black text-sm font-medium rounded-lg transition-colors"
            >
              Reconnect
            </button>
          </div>
        )}

        {/* Account Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Facebook Page */}
          <div className="bg-gray-800/40 rounded-xl p-4 space-y-1">
            <p className="text-gray-500 text-xs uppercase tracking-wider">Facebook Page</p>
            <p className="text-white text-sm font-medium">{pageName || <span className="text-gray-500 italic text-xs">Not set</span>}</p>
            {pageId && (
              <div className="flex items-center gap-1">
                <p className="text-gray-500 font-mono text-xs">{pageId}</p>
                <CopyInline value={pageId} />
              </div>
            )}
          </div>

          {/* Instagram Business ID */}
          <div className="bg-gray-800/40 rounded-xl p-4 space-y-1">
            <p className="text-gray-500 text-xs uppercase tracking-wider">Instagram Business ID</p>
            <div className="flex items-center gap-1">
              <p className="text-white font-mono text-sm">
                {instagramBusinessId || <span className="text-gray-500 italic text-xs not-italic">Not set</span>}
              </p>
              {instagramBusinessId && <CopyInline value={instagramBusinessId} />}
            </div>
          </div>

          {/* Internal UUID */}
          <div className="bg-gray-800/40 rounded-xl p-4 space-y-1">
            <p className="text-gray-500 text-xs uppercase tracking-wider">Account UUID</p>
            <div className="flex items-center gap-1">
              <p className="text-gray-400 font-mono text-xs truncate">
                {businessAccountId || <span className="text-gray-500 italic">Not set</span>}
              </p>
              {businessAccountId && <CopyInline value={businessAccountId} />}
            </div>
          </div>

          {/* Connection Status + Last Sync */}
          <div className="bg-gray-800/40 rounded-xl p-4 space-y-2">
            <p className="text-gray-500 text-xs uppercase tracking-wider">Account Status</p>
            {primaryAccount ? (
              <>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
                  primaryAccount.is_connected
                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                    : 'bg-red-500/20 text-red-400 border-red-500/30'
                }`}>
                  {primaryAccount.is_connected ? 'Connected' : 'Disconnected'}
                </span>
                <div className="flex items-center gap-1.5 text-gray-500 text-xs mt-1">
                  <Clock className="w-3 h-3" />
                  Last sync: {formatRelativeTime(primaryAccount.last_sync_at)}
                </div>
              </>
            ) : (
              <p className="text-gray-500 text-xs italic">No account data</p>
            )}
          </div>
        </div>
      </div>
    );
  }
);

ConnectionStatusSection.displayName = 'ConnectionStatusSection';

export default ConnectionStatusSection;
