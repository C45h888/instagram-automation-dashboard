import React, { forwardRef, useState } from 'react';
import { Shield, Copy, Check, Instagram } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useToast } from '../../hooks/useToast';

const CopyButton: React.FC<{ value: string }> = ({ value }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 text-gray-500 hover:text-yellow-400 transition-colors rounded"
      title="Copy to clipboard"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
};

const Field: React.FC<{ label: string; value?: string | null; mono?: boolean; copyable?: boolean }> = ({
  label, value, mono = false, copyable = false
}) => (
  <div>
    <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">{label}</p>
    <div className="flex items-center gap-2">
      <p className={`text-white text-sm truncate ${mono ? 'font-mono' : ''}`}>
        {value || <span className="text-gray-500 italic">Not set</span>}
      </p>
      {copyable && value && <CopyButton value={value} />}
    </div>
  </div>
);

const RoleBadge: React.FC<{ role?: string }> = ({ role }) => {
  const config = {
    super_admin: { label: 'Super Admin', classes: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    admin:       { label: 'Admin',       classes: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    user:        { label: 'User',        classes: 'bg-gray-700/50 text-gray-400 border-gray-600' },
  }[role || 'user'] ?? { label: role, classes: 'bg-gray-700/50 text-gray-400 border-gray-600' };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.classes}`}>
      {config.label}
    </span>
  );
};

const AccountInfoSection = forwardRef<HTMLDivElement>((_, ref) => {
  const {
    user,
    pageId,
    pageName,
    instagramBusinessId,
    businessAccountId,
    permissions,
  } = useAuthStore();
  const toast = useToast();

  const handleSave = () => {
    toast.success('Settings saved successfully!', {
      title: 'Settings Updated',
      action: { label: 'Undo', onClick: () => toast.info('Settings changes reverted') }
    });
  };

  return (
    <div ref={ref} className="glass-morphism-card p-6 rounded-2xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-yellow-500/20 rounded-xl flex items-center justify-center">
          <Shield className="w-5 h-5 text-yellow-400" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white">Account Info</h2>
          <p className="text-gray-400 text-sm">Your app account and connected service details</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left — App Account */}
        <div className="space-y-4">
          <h3 className="text-gray-300 text-sm font-medium uppercase tracking-wider border-b border-gray-700/50 pb-2">
            App Account
          </h3>

          <div className="flex items-center justify-between">
            <Field label="Username" value={user?.username} />
            <RoleBadge role={user?.role} />
          </div>

          <Field label="Email" value={user?.email} />

          <Field
            label="User ID"
            value={user?.id ? `${user.id.slice(0, 8)}...${user.id.slice(-4)}` : null}
            mono
            copyable={false}
          />
          {user?.id && (
            <div className="flex items-center gap-2 -mt-2">
              <p className="font-mono text-gray-500 text-xs">{user.id}</p>
              <CopyButton value={user.id} />
            </div>
          )}

          {user?.facebook_id && (
            <Field label="Facebook ID" value={user.facebook_id} mono />
          )}

          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Instagram Connected</p>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
              user?.instagramConnected
                ? 'bg-green-500/20 text-green-400 border-green-500/30'
                : 'bg-gray-700/50 text-gray-400 border-gray-600'
            }`}>
              <Instagram className="w-3 h-3" />
              {user?.instagramConnected ? 'Connected' : 'Not Connected'}
            </span>
          </div>
        </div>

        {/* Right — Connected Services */}
        <div className="space-y-4">
          <h3 className="text-gray-300 text-sm font-medium uppercase tracking-wider border-b border-gray-700/50 pb-2">
            Connected Services
          </h3>

          <Field label="Facebook Page" value={pageName} />
          <Field label="Facebook Page ID" value={pageId} mono copyable />
          <Field label="Instagram Business ID" value={instagramBusinessId} mono copyable />
          <Field
            label="Internal Account UUID"
            value={businessAccountId ? `${businessAccountId.slice(0, 8)}...` : null}
            mono
          />
          {businessAccountId && (
            <div className="flex items-center gap-2 -mt-2">
              <p className="font-mono text-gray-500 text-xs truncate">{businessAccountId}</p>
              <CopyButton value={businessAccountId} />
            </div>
          )}
        </div>
      </div>

      {/* Permissions */}
      {permissions.length > 0 && (
        <div>
          <h3 className="text-gray-300 text-sm font-medium uppercase tracking-wider border-b border-gray-700/50 pb-2 mb-3">
            App Permissions
          </h3>
          <div className="flex flex-wrap gap-2">
            {permissions.map((perm) => (
              <span
                key={perm}
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
              >
                {perm}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="pt-2">
        <button
          onClick={handleSave}
          className="px-5 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-medium rounded-lg transition-colors text-sm"
        >
          Save Settings
        </button>
      </div>
    </div>
  );
});

AccountInfoSection.displayName = 'AccountInfoSection';

export default AccountInfoSection;
