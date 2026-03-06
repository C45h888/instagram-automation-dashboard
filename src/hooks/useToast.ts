// Thin bridge over ToastContext — keeps all 13 existing callers working unchanged.
// Previously used local useState (toasts were never rendered). Now routes through
// the global ToastContext so toasts are actually visible.
import { useToastContext } from '../contexts/ToastContext';

interface ToastOptions {
  title?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const useToast = () => {
  const { addToast } = useToastContext();

  return {
    success: (message: string, options?: ToastOptions) =>
      addToast({ type: 'success', message, title: options?.title, duration: options?.duration ?? 3000, dismissible: true, action: options?.action }),

    error: (message: string, options?: ToastOptions) =>
      addToast({ type: 'error', message, title: options?.title, duration: options?.duration ?? 3000, dismissible: true, action: options?.action }),

    info: (message: string, options?: ToastOptions) =>
      addToast({ type: 'info', message, title: options?.title, duration: options?.duration ?? 3000, dismissible: true, action: options?.action }),

    warning: (message: string, options?: ToastOptions) =>
      addToast({ type: 'warning', message, title: options?.title, duration: options?.duration ?? 3000, dismissible: true, action: options?.action }),
  };
};
