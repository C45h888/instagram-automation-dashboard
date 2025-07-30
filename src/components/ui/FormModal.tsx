import React, { useState } from 'react';
import Modal from './Modal';

interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  onSubmit: (data: any) => Promise<void> | void;
  submitText?: string;
  cancelText?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const FormModal: React.FC<FormModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  onSubmit,
  submitText = 'Save',
  cancelText = 'Cancel',
  size = 'md',
}) => {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors([]);

    try {
      const formData = new FormData(e.target as HTMLFormElement);
      const data = Object.fromEntries(formData.entries());
      await onSubmit(data);
      onClose();
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'An error occurred']);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size={size}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {errors.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
            <ul className="text-red-400 text-sm space-y-1">
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {children}

        <div className="flex space-x-3 justify-end pt-4 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-gray-300 hover:text-white transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Saving...' : submitText}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default FormModal;