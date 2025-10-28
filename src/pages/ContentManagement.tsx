import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, TrendingUp } from 'lucide-react';

const ContentManagement: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      <div className="glass-morphism-card p-6 rounded-2xl">
        <h1 className="text-3xl font-bold text-white mb-2">Content Management</h1>
        <p className="text-gray-300">Create, schedule, and manage your Instagram content.</p>
      </div>

      {/* Content Analytics Card */}
      <div
        onClick={() => navigate('/content/analytics')}
        className="glass-morphism-card p-6 rounded-2xl cursor-pointer hover:border-green-500/50 border border-gray-700 transition-all group"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center group-hover:bg-green-500/30 transition-all">
              <BarChart3 className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white mb-1">Content Analytics</h3>
              <p className="text-gray-400">View performance metrics and engagement data</p>
            </div>
          </div>
          <TrendingUp className="w-6 h-6 text-green-400" />
        </div>
      </div>

      <div className="glass-morphism-card p-6 rounded-2xl">
        <p className="text-white">Content management features coming soon...</p>
      </div>
    </div>
  );
};

export default ContentManagement;