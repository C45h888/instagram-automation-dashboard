import React, { forwardRef, useState } from 'react';
import { AlertTriangle, LogOut, Unlink } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useToast } from '../../hooks/useToast';
import { useModal } from '../../hooks/useModal';
import { DatabaseService } from '../../services/databaseservices';

const DangerZoneSection = forwardRef<HTMLDivElement>((_, ref) => {
  const { user, logout } = useAuthStore();
  const toast = useToast();
  const modal = useModal();
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const handleDisconnect = async () => {
    const confirmed = await modal.openConfirm({
      title: 'Disconnect Instagram Account',
      message: 'This will remove your connected Instagram Business Account. You can reconnect at any time from the Token Management section.',
      variant: 'warning',
      confirmText: 'Disconnect',
      cancelText: 'Cancel'
    });

    if (!confirmed || !user?.id) return;

    setIsDisconnecting(true);
    try {
      const result = await DatabaseService.deleteUserData(user.id, { deleteAccounts: true });
      if (result.success) {
        toast.success('Instagram account disconnected.', { title: 'Disconnected', duration: 4000 });
      } else {
        toast.error(result.error || 'Failed to disconnect account.', { title: 'Error' });
      }
    } catch {
      toast.error('Network error — please try again.', { title: 'Error' });
    } finally {
      setIsDisconnecting(false);
    }
  };

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
      toast.success('Successfully logged out', { title: 'Goodbye!', duration: 3000 });
    }
  };

  return (
    <div ref={ref} className="rounded-2xl border border-red-500/30 bg-red-500/5 overflow-hidden">
      <div className="p-6 border-b border-red-500/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-red-400">Danger Zone</h2>
            <p className="text-gray-400 text-sm">Irreversible or sensitive actions</p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-red-500/10">
        {/* Disconnect */}
        <div className="p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <Unlink className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-white font-medium text-sm">Disconnect Instagram Account</p>
              <p className="text-gray-400 text-sm mt-0.5">
                Remove your connected Instagram Business Account. You can reconnect at any time.
              </p>
            </div>
          </div>
          <button
            onClick={handleDisconnect}
            disabled={isDisconnecting}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 border border-red-500/50 text-red-400 hover:bg-red-500/10 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
          >
            <Unlink className="w-4 h-4" />
            {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
          </button>
        </div>

        {/* Logout */}
        <div className="p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <LogOut className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-white font-medium text-sm">Log Out</p>
              <p className="text-gray-400 text-sm mt-0.5">
                Sign out of your current session.
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
});

DangerZoneSection.displayName = 'DangerZoneSection';

export default DangerZoneSection;
