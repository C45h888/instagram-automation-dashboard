import React from 'react';
import { AlertTriangle, Info, AlertCircle } from 'lucide-react';

interface ConfirmModalProps {
  title: string;
  message: string;
  variant?: 'danger' | 'warning' | 'info';
  confirmText?: string;
  cancelText?: string;
  onClose: (confirmed: boolean) => void;
  loading?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  title,
  message,
  variant = 'info',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onClose,
  loading = false,
}) => {
  const getIcon = () => {
    switch (variant) {
      case 'danger':
        return <AlertCircle className="w-6 h-6 text-red-400" />;
      case 'warning':
        return <AlertTriangle className="w-6 h-6 text-yellow-400" />;
      case 'info':
        return <Info className="w-6 h-6 text-blue-400" />;
    }
  };

  const getConfirmButtonClasses = () => {
    switch (variant) {
      case 'danger':
        return 'bg-red-600 hover:bg-red-700 text-white';
      case 'warning':
        return 'bg-yellow-600 hover:bg-yellow-700 text-white';
      case 'info':
        return 'bg-blue-600 hover:bg-blue-700 text-white';
    }
  };

  return (
    <div className="glass-morphism-card rounded-2xl shadow-2xl border border-white/20 max-w-md w-full p-6">
      <div className="flex items-start space-x-4 mb-6">
        <div className="flex-shrink-0">
          {getIcon()}
        </div>
        <div>
          <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
          <p className="text-gray-300">{message}</p>
        </div>
      </div>
      
      <div className="flex space-x-3 justify-end">
        <button
          onClick={() => onClose(false)}
          disabled={loading}
          className="px-4 py-2 text-gray-300 hover:text-white transition-colors disabled:opacity-50"
        >
          {cancelText}
        </button>
        <button
          onClick={() => onClose(true)}
          disabled={loading}
          className={`px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 ${getConfirmButtonClasses()}`}
        >
          {loading ? 'Processing...' : confirmText}
        </button>
      </div>
    </div>
  );
};

export default ConfirmModal;