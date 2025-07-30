import React from 'react';
import { AnimatePresence } from 'framer-motion';
import { useToastContext } from '../../contexts/ToastContext';
import Toast from './Toast';

const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastContext();

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast toast={toast} onDismiss={removeToast} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default ToastContainer;