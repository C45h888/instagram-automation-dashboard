import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useToast } from '../hooks/useToast';
import { useModal } from '../hooks/useModal';
import { useInstagramAccount } from '../hooks/useInstagramAccount';

// ============================================
// TOKEN IMPORT SECTION COMPONENT (v3)
// ============================================

const TokenImportSection: React.FC = () => {
  const [pageAccessToken, setPageAccessToken] = useState('');
  const [instagramBusinessId, setInstagramBusinessId] = useState('');
  const [pageId, setPageId] = useState('');
  const [pageName, setPageName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const { user } = useAuthStore();
  const toast = useToast();

  // ✅ OPTIMIZATION: Pre-fill from existing account data
  const {
    instagramBusinessId: existingIgId,
  } = useInstagramAccount();

  // Auto-populate Instagram Business ID if account exists
  useEffect(() => {
    if (existingIgId && !instagramBusinessId) {
      setInstagramBusinessId(existingIgId);
    }
  }, [existingIgId, instagramBusinessId]);

  const handleImport = async () => {
    setIsSubmitting(true);
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

      // ✅ Call /validate-token with importMode=true
      const response = await fetch(`${API_BASE_URL}/api/instagram/validate-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          importMode: true, // ✅ Enable import mode
          pageAccessToken,
          instagramBusinessId,
          pageId: pageId || undefined,
          pageName: pageName || undefined
        })
      });

      const result = await response.json();

      if (result.success && result.status === 'imported') {
        toast.success('Credentials imported successfully!', {
          title: 'Success',
          duration: 5000
        });

        // Show detected scope
        if (result.data.scope) {
          console.log('Detected permissions:', result.data.scope);
        }

        // Clear form
        setPageAccessToken('');
        setPageId('');
        setPageName('');
      } else {
        // ✅ v3 OPTIMIZATION: Parse and display specific error details
        const errorMessage = result.details || result.error || 'Import failed';
        const errorTitle = result.error?.includes('validation') ? 'Token Validation Failed' :
                           result.error?.includes('expired') ? 'Token Expired' :
                           result.error?.includes('permission') ? 'Missing Permissions' :
                           'Error';

        toast.error(errorMessage, {
          title: errorTitle,
          duration: 5000
        });

        console.error('Import error details:', result);
      }
    } catch (err) {
      toast.error('Network error - please try again', {
        title: 'Connection Failed'
      });
      console.error('Network error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ v3 OPTIMIZATION: Enhanced client-side validation with regex
  const isTokenValid = /^EAA[A-Za-z0-9_-]{50,}$/.test(pageAccessToken); // Meta token format
  const isBusinessIdValid = /^\d{14,20}$/.test(instagramBusinessId);
  const canSubmit = isTokenValid && isBusinessIdValid && !isSubmitting;

  return (
    <div className="glass-morphism-card p-6 rounded-2xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-2">
          Import Instagram Credentials
        </h2>
        <p className="text-gray-400 text-sm">
          Import your Page Access Token to enable Instagram analytics and automation
        </p>
      </div>

      {/* Page Access Token */}
      <div>
        <label className="block text-gray-300 text-sm font-medium mb-2">
          Page Access Token *
        </label>
        <textarea
          className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none font-mono text-sm"
          placeholder="EAABsbCS1iHgBO..."
          value={pageAccessToken}
          onChange={(e) => setPageAccessToken(e.target.value)}
          rows={3}
        />
        {pageAccessToken && !isTokenValid && (
          <p className="text-red-400 text-xs mt-1">Token format invalid (should start with EAA)</p>
        )}
      </div>

      {/* Instagram Business ID */}
      <div>
        <label className="block text-gray-300 text-sm font-medium mb-2">
          Instagram Business Account ID *
        </label>
        <input
          type="text"
          className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          placeholder="17841475450533073"
          value={instagramBusinessId}
          onChange={(e) => setInstagramBusinessId(e.target.value)}
        />
        {existingIgId && (
          <p className="text-green-400 text-xs mt-1">
            ✓ Auto-filled from existing account
          </p>
        )}
        {instagramBusinessId && !isBusinessIdValid && (
          <p className="text-yellow-400 text-xs mt-1">
            Should be 14-20 digits
          </p>
        )}
      </div>

      {/* Advanced Options (Optional) */}
      <div>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-blue-400 text-sm hover:text-blue-300"
        >
          {showAdvanced ? '▼' : '▶'} Advanced Options (Optional)
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4 pl-4 border-l-2 border-gray-700">
            <div>
              <label className="block text-gray-400 text-sm mb-1">
                Facebook Page ID
              </label>
              <input
                type="text"
                className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-2 text-white text-sm"
                placeholder="Auto-detected if not provided"
                value={pageId}
                onChange={(e) => setPageId(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-gray-400 text-sm mb-1">
                Page Name
              </label>
              <input
                type="text"
                className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-2 text-white text-sm"
                placeholder="Auto-detected if not provided"
                value={pageName}
                onChange={(e) => setPageName(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Submit Button */}
      <button
        onClick={handleImport}
        disabled={!canSubmit}
        className={`w-full py-3 rounded-lg font-medium transition-colors ${
          canSubmit
            ? 'bg-blue-500 hover:bg-blue-600 text-white'
            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
        }`}
      >
        {isSubmitting ? 'Importing...' : 'Import Credentials'}
      </button>

      {/* Help Text */}
      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
        <p className="text-blue-300 text-sm">
          <strong>How to get your Page Access Token:</strong>
        </p>
        <ol className="text-blue-200 text-xs mt-2 space-y-1 list-decimal list-inside">
          <li>Go to Meta Developer Console</li>
          <li>Select your app ({import.meta.env.VITE_INSTAGRAM_APP_ID || '1595100661870639'})</li>
          <li>Tools → Access Token Tool</li>
          <li>Generate Page Access Token</li>
          <li>Copy and paste above</li>
        </ol>
      </div>
    </div>
  );
};

// ============================================
// MAIN SETTINGS COMPONENT
// ============================================

const Settings: React.FC = () => {
  const { user, logout } = useAuthStore();
  const toast = useToast();
  const modal = useModal();

  const handleLogout = async () => {
    const confirmed = await modal.openConfirm({
      title: 'Confirm Logout',
      message: 'Are you sure you want to log out of your account?',
      variant: 'warning',
      confirmText: 'Logout',
      cancelText: 'Stay Logged In'
    });

    if (confirmed) {
      logout();
      toast.success('Successfully logged out', {
        title: 'Goodbye!',
        duration: 3000
      });
    }
  };

  const handleSaveSettings = () => {
    toast.success('Settings saved successfully!', {
      title: 'Settings Updated',
      action: {
        label: 'Undo',
        onClick: () => {
          toast.info('Settings changes reverted');
        }
      }
    });
  };

  return (
    <div className="space-y-8">
      <div className="glass-morphism-card p-6 rounded-2xl">
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-gray-300">Manage your account and application preferences.</p>
      </div>

      {/* Token Import Section */}
      <TokenImportSection />

      <div className="glass-morphism-card p-6 rounded-2xl">
        <h2 className="text-xl font-semibold text-white mb-4">Account Information</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-gray-400 text-sm mb-1">Username</label>
            <p className="text-white">{user?.username || 'Not set'}</p>
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">User ID</label>
            <p className="text-white">{user?.id || 'Not set'}</p>
          </div>
          
          <div className="flex space-x-4 mt-6">
            <button
              onClick={handleSaveSettings}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              Save Settings
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;