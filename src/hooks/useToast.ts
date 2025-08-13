import { useState, useCallback } from 'react';

interface ToastOptions {
  title?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  options?: ToastOptions;
}

export const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: Toast['type'], options?: ToastOptions) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast = { id, message, type, options };
    
    setToasts(prev => [...prev, newToast]);
    
    // Auto remove after duration
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, options?.duration || 3000);
  }, []);

  const success = useCallback((message: string, options?: ToastOptions) => {
    addToast(message, 'success', options);
  }, [addToast]);

  const error = useCallback((message: string, options?: ToastOptions) => {
    addToast(message, 'error', options);
  }, [addToast]);

  const info = useCallback((message: string, options?: ToastOptions) => {
    addToast(message, 'info', options);
  }, [addToast]);

  const warning = useCallback((message: string, options?: ToastOptions) => {
    addToast(message, 'warning', options);
  }, [addToast]);

  return { success, error, info, warning, toasts };
};