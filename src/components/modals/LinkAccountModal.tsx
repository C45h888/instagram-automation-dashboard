// src/components/modals/LinkAccountModal.tsx
// ============================================
// PHASE 5: USER-FRIENDLY ERROR GUIDANCE
// Shows actionable steps when no Instagram account found
// Reference: current-work.md Phase 5 (Mixpost pattern)
// ============================================

import React from 'react';
import { ExternalLink, AlertCircle, X, RefreshCw } from 'lucide-react';

interface LinkAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetry: () => void;
  isRetrying?: boolean;
}

export const LinkAccountModal: React.FC<LinkAccountModalProps> = ({
  isOpen,
  onClose,
  onRetry,
  isRetrying = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full p-6 border border-gray-700 relative">

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-start mb-6">
          <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center mr-4 flex-shrink-0">
            <AlertCircle className="w-6 h-6 text-yellow-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">
              No Instagram Business Account Found
            </h2>
            <p className="text-gray-400 text-sm">
              We couldn't find an Instagram Business Account linked to your Facebook Page.
              Follow the steps below to connect your account.
            </p>
          </div>
        </div>

        {/* Step-by-step instructions */}
        <div className="space-y-4 mb-6">
          <p className="text-gray-300 font-semibold">
            Please follow these steps to link your account:
          </p>

          <div className="bg-gray-900/50 rounded-lg p-4 space-y-4">

            {/* Step 1 */}
            <div className="flex items-start">
              <div className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold mr-3 flex-shrink-0">
                1
              </div>
              <div className="flex-1">
                <p className="text-white font-medium">Go to Facebook Business Suite</p>
                <a
                  href="https://business.facebook.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 text-sm flex items-center mt-1 w-fit"
                >
                  Open Business Suite <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start">
              <div className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold mr-3 flex-shrink-0">
                2
              </div>
              <div className="flex-1">
                <p className="text-white font-medium">Navigate to Settings → Instagram Accounts</p>
                <p className="text-gray-400 text-sm mt-1">
                  Find the "Instagram accounts" section in the left sidebar under Settings
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start">
              <div className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold mr-3 flex-shrink-0">
                3
              </div>
              <div className="flex-1">
                <p className="text-white font-medium">Connect your Instagram Business Account</p>
                <p className="text-gray-400 text-sm mt-1">
                  Click "Connect Account" and follow the prompts to link your Instagram
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex items-start">
              <div className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold mr-3 flex-shrink-0">
                4
              </div>
              <div className="flex-1">
                <p className="text-white font-medium">Return here and click "Retry Connection"</p>
                <p className="text-gray-400 text-sm mt-1">
                  Once connected, we'll automatically detect your account
                </p>
              </div>
            </div>
          </div>

          {/* Troubleshooting note */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <p className="text-blue-300 text-sm">
              <strong>Important:</strong> Your Instagram account must be a{' '}
              <strong>Business Account</strong> or <strong>Creator Account</strong>,
              not a personal account. Convert it in the Instagram app under{' '}
              <span className="text-blue-200">Settings → Account → Switch to Professional Account</span>.
            </p>
          </div>

          {/* Additional help */}
          <div className="bg-gray-900/30 border border-gray-700 rounded-lg p-4">
            <p className="text-gray-400 text-sm">
              <strong className="text-gray-300">Still having trouble?</strong> Make sure you have{' '}
              <strong>Admin access</strong> to the Facebook Page linked to your Instagram account.
              You can check this in{' '}
              <a
                href="https://business.facebook.com/settings/pages"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 inline-flex items-center"
              >
                Business Settings → Pages <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onRetry}
            disabled={isRetrying}
            className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isRetrying ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Retry Connection
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="sm:w-auto bg-gray-700 hover:bg-gray-600 text-gray-300 font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            I'll Do This Later
          </button>
        </div>
      </div>
    </div>
  );
};

export default LinkAccountModal;
