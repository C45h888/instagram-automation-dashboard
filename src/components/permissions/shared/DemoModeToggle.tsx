// =====================================
// DEMO MODE TOGGLE
// Switch between demo data and real data
// Critical for screencast recording
// =====================================

import React from 'react';
import { Video } from 'lucide-react';
import { usePermissionDemoStore } from '../../../stores/permissionDemoStore';

export const DemoModeToggle: React.FC = () => {
  const { demoMode, setDemoMode } = usePermissionDemoStore();

  return (
    <div className="glass-morphism-card p-4 rounded-xl border border-purple-500/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Video className="w-5 h-5 text-purple-400" />
          <div>
            <p className="text-white font-semibold text-sm">Screencast Mode</p>
            <p className="text-gray-400 text-xs">
              {demoMode ? 'Showing demo data for Meta review' : 'Using real account data'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setDemoMode(!demoMode)}
          className={`
            relative inline-flex h-6 w-11 items-center rounded-full transition-colors
            ${demoMode ? 'bg-purple-500' : 'bg-gray-600'}
          `}
        >
          <span
            className={`
              inline-block h-4 w-4 transform rounded-full bg-white transition-transform
              ${demoMode ? 'translate-x-6' : 'translate-x-1'}
            `}
          />
        </button>
      </div>

      {demoMode && (
        <div className="mt-3 pt-3 border-t border-purple-500/20">
          <p className="text-xs text-purple-300 flex items-center">
            <Video className="w-3 h-3 mr-1" />
            Demo mode active - Perfect for Meta app review screencast
          </p>
        </div>
      )}
    </div>
  );
};

export default DemoModeToggle;
