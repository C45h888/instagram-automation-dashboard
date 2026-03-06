import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  duration?: number;
  dismissible?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextType {
  toasts: Toast[];
  history: Toast[];         // dismissed toasts (last 20) — feeds notification dropdown
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
  clearHistory: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToastContext = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToastContext must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [history, setHistory] = useState<Toast[]>([]);
  // Track timers so we can clear them on manual dismiss
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    // Clear any pending auto-dismiss timer
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }

    setToasts(prev => {
      const toast = prev.find(t => t.id === id);
      if (toast) {
        // Move dismissed toast into history (cap at 20)
        setHistory(h => [toast, ...h].slice(0, 20));
      }
      return prev.filter(t => t.id !== id);
    });
  }, []);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast: Toast = {
      id,
      duration: 5000,
      dismissible: true,
      ...toast,
    };

    setToasts(prev => [newToast, ...prev]);

    // Auto-dismiss after duration
    if (newToast.duration && newToast.duration > 0) {
      const timer = setTimeout(() => {
        removeToast(id);
      }, newToast.duration);
      timers.current.set(id, timer);
    }

    return id;
  }, [removeToast]);

  const clearToasts = useCallback(() => {
    // Clear all timers
    timers.current.forEach(timer => clearTimeout(timer));
    timers.current.clear();
    // Move all active toasts to history before clearing
    setToasts(prev => {
      if (prev.length > 0) {
        setHistory(h => [...prev, ...h].slice(0, 20));
      }
      return [];
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, history, addToast, removeToast, clearToasts, clearHistory }}>
      {children}
    </ToastContext.Provider>
  );
};
