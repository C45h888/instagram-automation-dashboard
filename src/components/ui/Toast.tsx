import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { Toast as ToastType } from '../../contexts/ToastContext';

interface ToastProps {
  toast: ToastType;
  onDismiss: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!toast.duration || toast.duration <= 0) return;

    const interval = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev - (100 / (toast.duration! / 100));
        return Math.max(0, newProgress);
      });
    }, 100);

    return () => clearInterval(interval);
  }, [toast.duration]);

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-400" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-400" />;
    }
  };

  const getVariantClasses = () => {
    switch (toast.type) {
      case 'success':
        return 'border-green-500/50 bg-green-500/10';
      case 'error':
        return 'border-red-500/50 bg-red-500/10';
      case 'warning':
        return 'border-yellow-500/50 bg-yellow-500/10';
      case 'info':
        return 'border-blue-500/50 bg-blue-500/10';
    }
  };

  const getProgressColor = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-green-400';
      case 'error':
        return 'bg-red-400';
      case 'warning':
        return 'bg-yellow-400';
      case 'info':
        return 'bg-blue-400';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 300, scale: 0.3 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 300, scale: 0.5, transition: { duration: 0.2 } }}
      className={`glass-morphism-card p-4 rounded-xl shadow-lg border border-white/20 ${getVariantClasses()} max-w-sm w-full cursor-pointer group`}
      onClick={() => toast.dismissible && onDismiss(toast.id)}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          {getIcon()}
        </div>
        
        <div className="flex-1 min-w-0">
          {toast.title && (
            <h4 className="text-sm font-semibold text-white mb-1">
              {toast.title}
            </h4>
          )}
          <p className="text-sm text-gray-300">
            {toast.message}
          </p>
          
          {toast.action && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toast.action!.onClick();
              }}
              className="mt-2 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
            >
              {toast.action.label}
            </button>
          )}
        </div>

        {toast.dismissible && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(toast.id);
            }}
            className="flex-shrink-0 text-gray-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Progress bar */}
      {toast.duration && toast.duration > 0 && (
        <div className="mt-3 w-full bg-white/10 rounded-full h-1">
          <div
            className={`h-1 rounded-full transition-all duration-100 ease-linear ${getProgressColor()}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </motion.div>
  );
};

export default Toast;