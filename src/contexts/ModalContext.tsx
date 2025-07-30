import React, { createContext, useContext, useState, useCallback } from 'react';

interface ModalState {
  isOpen: boolean;
  component: React.ComponentType<any> | null;
  props: any;
  resolve: ((value: any) => void) | null;
}

interface ModalContextType {
  isOpen: boolean;
  openModal: <T = any>(component: React.ComponentType<any>, props?: any) => Promise<T>;
  closeModal: (data?: any) => void;
  openConfirm: (options: ConfirmOptions) => Promise<boolean>;
}

interface ConfirmOptions {
  title: string;
  message: string;
  variant?: 'danger' | 'warning' | 'info';
  confirmText?: string;
  cancelText?: string;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const useModalContext = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModalContext must be used within a ModalProvider');
  }
  return context;
};

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    component: null,
    props: {},
    resolve: null,
  });

  const openModal = useCallback(<T = any>(component: React.ComponentType<any>, props: any = {}): Promise<T> => {
    return new Promise((resolve) => {
      setModalState({
        isOpen: true,
        component,
        props,
        resolve,
      });
    });
  }, []);

  const closeModal = useCallback((data?: any) => {
    if (modalState.resolve) {
      modalState.resolve(data);
    }
    setModalState({
      isOpen: false,
      component: null,
      props: {},
      resolve: null,
    });
  }, [modalState.resolve]);

  const openConfirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    const ConfirmModal = ({ onClose }: { onClose: (result: boolean) => void }) => (
      <div className="glass-morphism-card rounded-2xl shadow-2xl border border-white/20 max-w-md w-full p-6">
        <h3 className="text-xl font-bold text-white mb-2">{options.title}</h3>
        <p className="text-gray-300 mb-6">{options.message}</p>
        <div className="flex space-x-3 justify-end">
          <button
            onClick={() => onClose(false)}
            className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
          >
            {options.cancelText || 'Cancel'}
          </button>
          <button
            onClick={() => onClose(true)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              options.variant === 'danger'
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : options.variant === 'warning'
                ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {options.confirmText || 'Confirm'}
          </button>
        </div>
      </div>
    );

    return openModal(ConfirmModal, {});
  }, [openModal]);

  const contextValue: ModalContextType = {
    isOpen: modalState.isOpen,
    openModal,
    closeModal,
    openConfirm,
  };

  return (
    <ModalContext.Provider value={contextValue}>
      {children}
      {modalState.isOpen && modalState.component && (
        <ModalRenderer
          component={modalState.component}
          props={modalState.props}
          onClose={closeModal}
        />
      )}
    </ModalContext.Provider>
  );
};

interface ModalRendererProps {
  component: React.ComponentType<any>;
  props: any;
  onClose: (data?: any) => void;
}

const ModalRenderer: React.FC<ModalRendererProps> = ({ component: Component, props, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onClose()}
      />
      <div className="relative z-10">
        <Component {...props} onClose={onClose} />
      </div>
    </div>
  );
};