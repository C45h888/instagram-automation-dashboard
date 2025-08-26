// src/pages/PrivacyDashboard.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { 
  Shield, 
  Trash2, 
  Download, 
  AlertTriangle, 
  Check,  
  Clock,
  Database,
  Settings,
  User,
  Instagram,
  Cloud
} from 'lucide-react';

interface DeletionOption {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  selected: boolean;
  dataSize?: string;
}

const PrivacyDashboard: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<'overview' | 'deletion' | 'export' | 'settings'>('overview');
  const [deletionOptions, setDeletionOptions] = useState<DeletionOption[]>([
    {
      id: 'instagram-data',
      label: 'Instagram Data',
      description: 'Posts, comments, analytics, and cached content',
      icon: <Instagram className="w-5 h-5" />,
      selected: false,
      dataSize: '2.3 GB'
    },
    {
      id: 'automation-workflows',
      label: 'Automation Workflows',
      description: 'N8N configurations and execution history',
      icon: <Settings className="w-5 h-5" />,
      selected: false,
      dataSize: '156 MB'
    },
    {
      id: 'user-profile',
      label: 'User Profile',
      description: 'Account information and preferences',
      icon: <User className="w-5 h-5" />,
      selected: false,
      dataSize: '12 KB'
    },
    {
      id: 'third-party',
      label: 'Third-Party Integrations',
      description: 'Shopify, Google Analytics, Slack connections',
      icon: <Cloud className="w-5 h-5" />,
      selected: false,
      dataSize: '89 MB'
    }
  ]);
  
  const [confirmationText, setConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletionProgress, setDeletionProgress] = useState(0);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const handleSelectAll = () => {
    setDeletionOptions(options => 
      options.map(opt => ({ ...opt, selected: true }))
    );
  };

  const handleDeselectAll = () => {
    setDeletionOptions(options => 
      options.map(opt => ({ ...opt, selected: false }))
    );
  };

  const handleToggleOption = (id: string) => {
    setDeletionOptions(options =>
      options.map(opt => 
        opt.id === id ? { ...opt, selected: !opt.selected } : opt
      )
    );
  };

  const handleDataExport = async () => {
    // Simulate data export
    const exportData = {
      user: user,
      exportDate: new Date().toISOString(),
      dataCategories: deletionOptions.filter(opt => opt.selected).map(opt => opt.label)
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `888intelligence-data-export-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDataDeletion = async () => {
    if (confirmationText !== 'DELETE MY DATA') {
      alert('Please type "DELETE MY DATA" to confirm');
      return;
    }

    setIsDeleting(true);
    
    // Simulate deletion progress
    for (let i = 0; i <= 100; i += 10) {
      setTimeout(() => {
        setDeletionProgress(i);
        if (i === 100) {
          setIsDeleting(false);
          setShowSuccessModal(true);
        }
      }, i * 50);
    }
  };

  const selectedCount = deletionOptions.filter(opt => opt.selected).length;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="glass-morphism-card p-6 rounded-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 tracking-tight flex items-center">
              <Shield className="w-10 h-10 mr-3 text-yellow-500" />
              Privacy Dashboard
            </h1>
            <p className="text-gray-300 text-lg">Manage your data and privacy settings</p>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-sm">Account Created</p>
            <p className="text-white font-medium">January 1, 2025</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-800/50 p-1 rounded-lg">
        {[
          { id: 'overview', label: 'Overview', icon: <Database className="w-4 h-4" /> },
          { id: 'deletion', label: 'Data Deletion', icon: <Trash2 className="w-4 h-4" /> },
          { id: 'export', label: 'Data Export', icon: <Download className="w-4 h-4" /> },
          { id: 'settings', label: 'Privacy Settings', icon: <Settings className="w-4 h-4" /> }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-yellow-500/20 text-yellow-400'
                : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="glass-morphism-card p-6 rounded-xl">
            <Database className="w-8 h-8 text-blue-400 mb-3" />
            <h3 className="text-white font-semibold mb-1">Total Data Stored</h3>
            <p className="text-2xl font-bold text-white">2.5 GB</p>
            <p className="text-gray-400 text-sm mt-1">Across all services</p>
          </div>
          
          <div className="glass-morphism-card p-6 rounded-xl">
            <Instagram className="w-8 h-8 text-pink-400 mb-3" />
            <h3 className="text-white font-semibold mb-1">Instagram Connections</h3>
            <p className="text-2xl font-bold text-white">3</p>
            <p className="text-gray-400 text-sm mt-1">Business accounts</p>
          </div>
          
          <div className="glass-morphism-card p-6 rounded-xl">
            <Settings className="w-8 h-8 text-green-400 mb-3" />
            <h3 className="text-white font-semibold mb-1">Active Workflows</h3>
            <p className="text-2xl font-bold text-white">5</p>
            <p className="text-gray-400 text-sm mt-1">N8N automations</p>
          </div>
          
          <div className="glass-morphism-card p-6 rounded-xl">
            <Clock className="w-8 h-8 text-yellow-400 mb-3" />
            <h3 className="text-white font-semibold mb-1">Data Retention</h3>
            <p className="text-2xl font-bold text-white">24</p>
            <p className="text-gray-400 text-sm mt-1">Months</p>
          </div>
        </div>
      )}

      {activeTab === 'deletion' && (
        <div className="space-y-6">
          {/* Warning */}
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
            <div className="flex items-start">
              <AlertTriangle className="w-6 h-6 text-red-400 mt-1 mr-3 flex-shrink-0" />
              <div>
                <h3 className="text-red-400 font-semibold mb-2">Important: Data Deletion is Permanent</h3>
                <p className="text-red-300 text-sm">
                  Once you delete your data, it cannot be recovered. We recommend exporting your data before deletion. 
                  Some data may be retained for legal compliance (audit logs for 30 days, financial records for 7 years).
                </p>
              </div>
            </div>
          </div>

          {/* Selection Options */}
          <div className="glass-morphism-card p-6 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Select Data to Delete</h3>
              <div className="flex space-x-2">
                <button
                  onClick={handleSelectAll}
                  className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition"
                >
                  Select All
                </button>
                <button
                  onClick={handleDeselectAll}
                  className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition"
                >
                  Deselect All
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {deletionOptions.map(option => (
                <div
                  key={option.id}
                  onClick={() => handleToggleOption(option.id)}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    option.selected
                      ? 'bg-red-500/10 border-red-500/30'
                      : 'bg-gray-800/50 border-gray-700 hover:bg-gray-700/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${
                        option.selected ? 'bg-red-500/20 text-red-400' : 'bg-gray-700 text-gray-400'
                      }`}>
                        {option.icon}
                      </div>
                      <div>
                        <h4 className="text-white font-medium">{option.label}</h4>
                        <p className="text-gray-400 text-sm">{option.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-gray-500 text-sm">{option.dataSize}</span>
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        option.selected
                          ? 'bg-red-500 border-red-500'
                          : 'border-gray-600'
                      }`}>
                        {option.selected && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Confirmation */}
          {selectedCount > 0 && (
            <div className="glass-morphism-card p-6 rounded-xl">
              <h3 className="text-white font-semibold mb-4">Confirm Deletion</h3>
              <p className="text-gray-300 mb-4">
                You have selected {selectedCount} data categor{selectedCount === 1 ? 'y' : 'ies'} for deletion. 
                Type <span className="text-red-400 font-mono font-bold">DELETE MY DATA</span> to confirm.
              </p>
              <input
                type="text"
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                placeholder="Type confirmation text here"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:border-red-500/50 focus:outline-none mb-4"
              />
              <button
                onClick={handleDataDeletion}
                disabled={confirmationText !== 'DELETE MY DATA' || isDeleting}
                className={`w-full py-3 rounded-lg font-semibold transition-all ${
                  confirmationText === 'DELETE MY DATA' && !isDeleting
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isDeleting ? `Deleting... ${deletionProgress}%` : 'Delete Selected Data'}
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'export' && (
        <div className="glass-morphism-card p-6 rounded-xl">
          <h3 className="text-white font-semibold mb-4">Export Your Data</h3>
          <p className="text-gray-300 mb-6">
            Download a complete copy of your data in JSON format. This includes all your Instagram data, 
            automation configurations, and account information.
          </p>
          <button
            onClick={handleDataExport}
            className="flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
          >
            <Download className="w-5 h-5 mr-2" />
            Export All Data
          </button>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-6">
          <div className="glass-morphism-card p-6 rounded-xl">
            <h3 className="text-white font-semibold mb-4">Privacy Settings</h3>
            <div className="space-y-4">
              <label className="flex items-center justify-between">
                <div>
                  <p className="text-white">Analytics Opt-Out</p>
                  <p className="text-gray-400 text-sm">Disable platform analytics tracking</p>
                </div>
                <input type="checkbox" className="toggle" />
              </label>
              <label className="flex items-center justify-between">
                <div>
                  <p className="text-white">Marketing Communications</p>
                  <p className="text-gray-400 text-sm">Receive product updates and offers</p>
                </div>
                <input type="checkbox" className="toggle" defaultChecked />
              </label>
              <label className="flex items-center justify-between">
                <div>
                  <p className="text-white">AI Response Generation</p>
                  <p className="text-gray-400 text-sm">Allow AI to generate responses</p>
                </div>
                <input type="checkbox" className="toggle" defaultChecked />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-8 rounded-2xl max-w-md">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Data Deletion Complete</h3>
              <p className="text-gray-300 mb-6">
                Your selected data has been permanently deleted. You will receive a confirmation email shortly.
              </p>
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  navigate('/');
                }}
                className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg transition"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrivacyDashboard;