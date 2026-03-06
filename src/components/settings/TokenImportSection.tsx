import React, { useState, useEffect, forwardRef } from 'react';
import { ChevronDown, ChevronRight, Facebook, Key, ExternalLink, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useInstagramAccount } from '../../hooks/useInstagramAccount';
import { useToast } from '../../hooks/useToast';
import { supabase } from '../../lib/supabase';

const TokenImportSection = forwardRef<HTMLDivElement>((_, ref) => {
  const [showManual, setShowManual] = useState(false);
  const [pageAccessToken, setPageAccessToken] = useState('');
  const [instagramBusinessId, setInstagramBusinessId] = useState('');
  const [pageId, setPageId] = useState('');
  const [pageName, setPageName] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState(false);

  const { user } = useAuthStore();
  const { instagramBusinessId: existingIgId } = useInstagramAccount();
  const toast = useToast();

  useEffect(() => {
    if (existingIgId && !instagramBusinessId) {
      setInstagramBusinessId(existingIgId);
    }
  }, [existingIgId, instagramBusinessId]);

  const handleOAuthReconnect = async () => {
    setIsOAuthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: {
          scopes: 'instagram_basic,instagram_manage_comments,instagram_content_publish,instagram_manage_messages,pages_read_user_content,pages_manage_metadata,business_management',
          redirectTo: `${window.location.origin}/auth/callback`,
        }
      });
      if (error) throw error;
    } catch (err: any) {
      toast.error(err.message || 'Failed to start OAuth flow', { title: 'Connection Error' });
      setIsOAuthLoading(false);
    }
  };

  const handleImport = async () => {
    setIsSubmitting(true);
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
      const response = await fetch(`${API_BASE_URL}/api/instagram/validate-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          importMode: true,
          pageAccessToken,
          instagramBusinessId,
          pageId: pageId || undefined,
          pageName: pageName || undefined
        })
      });

      const result = await response.json();

      if (result.success && result.status === 'imported') {
        toast.success('Credentials imported successfully!', { title: 'Success', duration: 5000 });
        setPageAccessToken('');
        setPageId('');
        setPageName('');
      } else {
        const errorMessage = result.details || result.error || 'Import failed';
        const errorTitle = result.error?.includes('validation') ? 'Token Validation Failed'
          : result.error?.includes('expired') ? 'Token Expired'
          : result.error?.includes('permission') ? 'Missing Permissions'
          : 'Error';
        toast.error(errorMessage, { title: errorTitle, duration: 5000 });
      }
    } catch {
      toast.error('Network error - please try again', { title: 'Connection Failed' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isTokenValid = /^(EAA|IG)[A-Za-z0-9_-]{50,}$/.test(pageAccessToken);
  const isBusinessIdValid = /^\d{14,20}$/.test(instagramBusinessId);
  const canSubmit = isTokenValid && isBusinessIdValid && !isSubmitting;

  return (
    <div ref={ref} className="glass-morphism-card p-6 rounded-2xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-yellow-500/20 rounded-xl flex items-center justify-center">
          <Key className="w-5 h-5 text-yellow-400" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white">Token Management</h2>
          <p className="text-gray-400 text-sm">Reconnect or manually import Instagram credentials</p>
        </div>
      </div>

      {/* Primary: OAuth Reconnect */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <Facebook className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-white font-medium">Reconnect via Facebook</h3>
            <p className="text-gray-400 text-sm mt-1">
              Recommended — automatically exchanges tokens and refreshes all permissions in one step.
            </p>
          </div>
        </div>
        <button
          onClick={handleOAuthReconnect}
          disabled={isOAuthLoading}
          className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-medium rounded-lg transition-colors"
        >
          {isOAuthLoading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Facebook className="w-4 h-4" />
          )}
          {isOAuthLoading ? 'Redirecting to Facebook...' : 'Reconnect via Facebook'}
        </button>
      </div>

      {/* Secondary: Manual Import (collapsible) */}
      <div className="border border-gray-700 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowManual(!showManual)}
          className="w-full flex items-center justify-between px-5 py-4 text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
        >
          <span className="text-sm font-medium">Or import manually</span>
          {showManual ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {showManual && (
          <div className="px-5 pb-5 space-y-5 border-t border-gray-700 pt-5">
            {/* Page Access Token */}
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Page Access Token <span className="text-red-400">*</span>
              </label>
              <textarea
                className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-500 focus:border-yellow-500/50 focus:outline-none font-mono text-sm transition-colors"
                placeholder="EAABsbCS1iHgBO..."
                value={pageAccessToken}
                onChange={(e) => setPageAccessToken(e.target.value)}
                rows={3}
              />
              {pageAccessToken && !isTokenValid && (
                <p className="text-red-400 text-xs mt-1">Token format invalid (should start with EAA or IG)</p>
              )}
            </div>

            {/* Instagram Business ID */}
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Instagram Business Account ID <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-500 focus:border-yellow-500/50 focus:outline-none transition-colors"
                placeholder="17841475450533073"
                value={instagramBusinessId}
                onChange={(e) => setInstagramBusinessId(e.target.value)}
              />
              {existingIgId && (
                <p className="text-green-400 text-xs mt-1">Auto-filled from existing account</p>
              )}
              {instagramBusinessId && !isBusinessIdValid && (
                <p className="text-yellow-400 text-xs mt-1">Should be 14-20 digits</p>
              )}
            </div>

            {/* Advanced Options */}
            <div>
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-blue-400 text-sm hover:text-blue-300 flex items-center gap-1"
              >
                {showAdvanced ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                Advanced Options (Optional)
              </button>

              {showAdvanced && (
                <div className="mt-4 space-y-4 pl-4 border-l-2 border-gray-700">
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Facebook Page ID</label>
                    <input
                      type="text"
                      className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-2 text-white text-sm focus:border-yellow-500/50 focus:outline-none"
                      placeholder="Auto-detected if not provided"
                      value={pageId}
                      onChange={(e) => setPageId(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Page Name</label>
                    <input
                      type="text"
                      className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-2 text-white text-sm focus:border-yellow-500/50 focus:outline-none"
                      placeholder="Auto-detected if not provided"
                      value={pageName}
                      onChange={(e) => setPageName(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleImport}
              disabled={!canSubmit}
              className={`w-full py-3 rounded-lg font-medium transition-colors ${
                canSubmit
                  ? 'bg-yellow-500 hover:bg-yellow-600 text-black'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? 'Importing...' : 'Import Credentials'}
            </button>

            {/* Help text */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
              <p className="text-gray-300 text-sm font-medium flex items-center gap-2">
                <ExternalLink className="w-4 h-4" />
                How to get your Page Access Token
              </p>
              <ol className="text-gray-400 text-xs mt-2 space-y-1 list-decimal list-inside">
                <li>Go to Meta Developer Console</li>
                <li>Select your app ({import.meta.env.VITE_INSTAGRAM_APP_ID || '1595100661870639'})</li>
                <li>Tools &rarr; Access Token Tool</li>
                <li>Generate Page Access Token</li>
                <li>Copy and paste above</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

TokenImportSection.displayName = 'TokenImportSection';

export default TokenImportSection;
