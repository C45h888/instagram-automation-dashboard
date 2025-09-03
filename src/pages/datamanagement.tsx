
import React, { useState, useCallback, useMemo } from 'react';
import { DatabaseService } from '../services/databaseservices';
import { useAuthStore } from '../stores/authStore';
import { Download, Shield, AlertTriangle, Check } from 'lucide-react';

const DATA_TYPES = [
  { key: 'deleteAccounts', label: 'Instagram Accounts', icon: '📱' },
  { key: 'deleteWorkflows', label: 'Automation Workflows', icon: '🤖' },
  { key: 'deleteAnalytics', label: 'Analytics Data', icon: '📊' },
  { key: 'deleteAuditLogs', label: 'Audit Logs', icon: '📝' },
  { key: 'deleteProfile', label: 'User Profile', icon: '👤', danger: true }
];

export const DataManagement: React.FC = () => {
  const { user } = useAuthStore();
  const [deleteOptions, setDeleteOptions] = useState({
    deleteProfile: false,
    deleteAccounts: false,
    deleteWorkflows: false,
    deleteAnalytics: false,
    deleteAuditLogs: false
  });
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  const handleExportData = useCallback(async () => {
    if (!user) {
      console.error('Please login to export data');
      return;
    }
    
    try {
      await DatabaseService.exportUserData(user.id);
      console.log('Data export started');
    } catch (error) {
      console.error('Export failed:', error);
    }
  }, [user]);
  
  const handleDeleteData = useCallback(async () => {
    if (!user || confirmText !== 'DELETE MY DATA') {
      console.error('Please type "DELETE MY DATA" to confirm');
      return;
    }
    
    setDeleting(true);
    try {
      const result = await DatabaseService.deleteUserData(user.id, deleteOptions);
      
      if (result.success) {
        setShowDeleteModal(false);
        setConfirmText('');
        
        if (deleteOptions.deleteProfile) {
          useAuthStore.getState().signOut();
        }
      }
    } finally {
      setDeleting(false);
    }
  }, [user, confirmText, deleteOptions]);
  
  const selectedCount = useMemo(() => 
    Object.values(deleteOptions).filter(Boolean).length,
    [deleteOptions]
  );
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="glass-morphism-card p-6 rounded-2xl">
          <h1 className="text-3xl font-bold text-white mb-2">Data Management</h1>
          <p className="text-gray-400">Export or delete your data (GDPR compliant)</p>
        </div>
        
        {/* Export Section */}
        <div className="glass-morphism-card p-6 rounded-2xl">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Download className="text-blue-400" size={24} />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-white mb-2">Export Your Data</h2>
              <p className="text-gray-400 mb-4">
                Download all your data in JSON format for backup or migration.
              </p>
              <button
                onClick={handleExportData}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Export All Data
              </button>
            </div>
          </div>
        </div>
        
        {/* Delete Section */}
        <div className="glass-morphism-card p-6 rounded-2xl border border-red-900/30">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 rounded-lg bg-red-500/20 flex items-center justify-center">
              <AlertTriangle className="text-red-400" size={24} />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-white mb-2">Delete Your Data</h2>
              <p className="text-gray-400 mb-4">
                Permanently delete selected data. This action cannot be undone.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {DATA_TYPES.map(type => (
                  <label
                    key={type.key}
                    className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      deleteOptions[type.key as keyof typeof deleteOptions]
                        ? type.danger ? 'bg-red-500/20 border border-red-500/30' : 'bg-indigo-500/20 border border-indigo-500/30'
                        : 'bg-white/5 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={deleteOptions[type.key as keyof typeof deleteOptions]}
                      onChange={(e) => setDeleteOptions({
                        ...deleteOptions,
                        [type.key]: e.target.checked
                      })}
                      className="rounded border-gray-600 bg-gray-800"
                    />
                    <span className="text-2xl">{type.icon}</span>
                    <span className={`text-sm ${type.danger ? 'text-red-400' : 'text-white'}`}>
                      {type.label}
                    </span>
                  </label>
                ))}
              </div>
              
              <button
                onClick={() => setShowDeleteModal(true)}
                disabled={selectedCount === 0}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Delete Selected ({selectedCount})
              </button>
            </div>
          </div>
        </div>
        
        {/* Privacy Info */}
        <div className="glass-morphism-card p-6 rounded-2xl">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center">
              <Shield className="text-green-400" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white mb-2">Privacy & Security</h2>
              <ul className="text-gray-400 space-y-2">
                <li className="flex items-start">
                  <Check className="text-green-400 mr-2 mt-0.5" size={16} />
                  <span>All data encrypted at rest and in transit</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-green-400 mr-2 mt-0.5" size={16} />
                  <span>GDPR and CCPA compliant</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-green-400 mr-2 mt-0.5" size={16} />
                  <span>Data deletion is permanent and audited</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-green-400 mr-2 mt-0.5" size={16} />
                  <span>Export data anytime for portability</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      
      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-morphism-card p-6 rounded-2xl max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4">Confirm Data Deletion</h3>
            
            <div className="bg-red-900/20 border border-red-900/50 rounded-lg p-4 mb-4">
              <p className="text-red-400 text-sm">
                ⚠️ This will permanently delete {selectedCount} type(s) of data. This cannot be undone.
              </p>
            </div>
            
            <p className="text-gray-400 mb-4">
              Type <span className="font-mono font-bold text-white">DELETE MY DATA</span> to confirm:
            </p>
            
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white mb-4 focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Type here..."
            />
            
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setConfirmText('');
                }}
                className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteData}
                disabled={confirmText !== 'DELETE MY DATA' || deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deleting ? 'Deleting...' : 'Delete Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataManagement;