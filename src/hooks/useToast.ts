import { useToastContext, Toast } from '../contexts/ToastContext';

interface ToastOptions {
  title?: string;
  duration?: number;
  dismissible?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const useToast = () => {
  const { addToast, removeToast, clearToasts } = useToastContext();

  const toast = {
    success: (message: string, options?: ToastOptions) => {
      return addToast({
        type: 'success',
        message,
        ...options,
      });
    },

    error: (message: string, options?: ToastOptions) => {
      return addToast({
        type: 'error',
        message,
        duration: 7000, // Longer duration for errors
        ...options,
      });
    },

    warning: (message: string, options?: ToastOptions) => {
      return addToast({
        type: 'warning',
        message,
        ...options,
      });
    },

    info: (message: string, options?: ToastOptions) => {
      return addToast({
        type: 'info',
        message,
        ...options,
      });
    },

    dismiss: removeToast,
    clear: clearToasts,
  };

  return toast;
};