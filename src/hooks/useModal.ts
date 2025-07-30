import { useModalContext } from '../contexts/ModalContext';

export const useModal = () => {
  const { openModal, closeModal, openConfirm, isOpen } = useModalContext();

  return {
    openModal,
    closeModal,
    openConfirm,
    isOpen,
  };
};