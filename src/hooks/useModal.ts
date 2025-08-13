import { useState, useCallback } from 'react';

interface ConfirmModalOptions {
  title: string;
  message: string;
  variant?: 'info' | 'warning' | 'danger';
  confirmText?: string;
  cancelText?: string;
}

export const useModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<ConfirmModalOptions | null>(null);
  const [resolver, setResolver] = useState<((value: boolean) => void) | null>(null);

  const openConfirm = useCallback((options: ConfirmModalOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setModalConfig(options);
      setIsOpen(true);
      setResolver(() => resolve);
    });
  }, []);

  const confirm = useCallback(() => {
    if (resolver) {
      resolver(true);
      setResolver(null);
    }
    setIsOpen(false);
    setModalConfig(null);
  }, [resolver]);

  const cancel = useCallback(() => {
    if (resolver) {
      resolver(false);
      setResolver(null);
    }
    setIsOpen(false);
    setModalConfig(null);
  }, [resolver]);

  return {
    openConfirm,
    confirm,
    cancel,
    isOpen,
    modalConfig
  };
};