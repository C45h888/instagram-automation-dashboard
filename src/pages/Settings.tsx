import React from 'react';
import { useAuthStore } from '../stores/authStore';
import { useToast } from '../hooks/useToast';
import { useModal } from '../hooks/useModal';

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