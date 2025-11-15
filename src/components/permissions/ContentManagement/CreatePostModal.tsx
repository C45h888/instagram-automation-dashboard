// src/components/permissions/ContentManagement/CreatePostModal.tsx
import React, { useState } from 'react';
import Modal from '../../ui/Modal';
import LoadingButton from '../../ui/LoadingButton';
import { useToast } from '../../../hooks/useToast';
import { useAuthStore } from '../../../stores/authStore';
import { useInstagramAccount } from '../../../hooks/useInstagramAccount';
import type { CreatePostRequest, CreatePostResponse } from '../../../types/instagram-media';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [caption, setCaption] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ caption?: string; imageUrl?: string }>({});

  const { success, error: toastError } = useToast();
  const userId = useAuthStore(state => state.user?.id);
  const { businessAccountId } = useInstagramAccount();

  // Validation
  const validate = (): boolean => {
    const newErrors: { caption?: string; imageUrl?: string } = {};

    if (!caption.trim()) {
      newErrors.caption = 'Caption is required';
    } else if (caption.length > 2200) {
      newErrors.caption = 'Caption must be 2200 characters or less';
    }

    if (!imageUrl.trim()) {
      newErrors.imageUrl = 'Image URL is required';
    } else {
      // Basic URL validation
      try {
        const url = new URL(imageUrl);
        if (url.protocol !== 'https:') {
          newErrors.imageUrl = 'Image URL must use HTTPS';
        }
        if (!imageUrl.match(/\.(jpg|jpeg|png|gif)$/i)) {
          newErrors.imageUrl = 'Image URL must end with .jpg, .jpeg, .png, or .gif';
        }
      } catch {
        newErrors.imageUrl = 'Invalid URL format';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsLoading(true);

    try {
      if (!userId || !businessAccountId) {
        throw new Error('User authentication is required. Please log in again.');
      }

      const requestBody: CreatePostRequest = {
        userId,
        businessAccountId,
        caption: caption.trim(),
        image_url: imageUrl.trim(),
      };

      console.log('📤 Submitting post:', { caption: caption.substring(0, 50) + '...', imageUrl });

      const response = await fetch('/api/instagram/create-post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const result: CreatePostResponse = await response.json();

      if (!response.ok || !result.success) {
        // Handle specific error codes
        if (result.code === 'RATE_LIMIT_EXCEEDED') {
          throw new Error('Rate limit exceeded. Please wait before posting again.');
        }
        if (result.code === 'TOKEN_INVALID' || result.code === 'TOKEN_RETRIEVAL_FAILED') {
          throw new Error('Your Instagram connection expired. Please reconnect your account.');
        }
        if (result.code === 'INVALID_IMAGE_URL') {
          throw new Error(result.error || 'Invalid image URL');
        }

        throw new Error(
          result.details?.error?.message ||
          result.error ||
          'Failed to publish post'
        );
      }

      console.log('✅ Post published:', result.data);

      // Success!
      success('Your post is now live on Instagram.', {
        title: 'Post Published!',
        duration: 5000,
      });

      // Clear form
      setCaption('');
      setImageUrl('');
      setErrors({});

      // Trigger refetch and close
      onSuccess();
      onClose();

    } catch (error: any) {
      console.error('❌ Post creation error:', error);

      // Error toast
      toastError(error.message || 'An unexpected error occurred.', {
        title: 'Publishing Failed',
        duration: 7000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setCaption('');
      setImageUrl('');
      setErrors({});
      onClose();
    }
  };

  const remainingChars = 2200 - caption.length;
  const isOverLimit = remainingChars < 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create New Instagram Post"
      size="lg"
    >
      <div className="p-6">
        <p className="text-gray-300 mb-6">
          Publish a new image post to your Instagram account. Image must be publicly accessible via HTTPS.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Caption Field */}
          <div>
            <label htmlFor="caption" className="block text-sm font-medium text-white mb-2">
              Caption *
            </label>
            <textarea
              id="caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className={`w-full px-4 py-3 rounded-lg bg-gray-800 border ${
                errors.caption ? 'border-red-500' : 'border-gray-700'
              } text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors resize-none`}
              placeholder="Write your caption here..."
              rows={4}
              maxLength={2200}
              disabled={isLoading}
            />
            <div className="flex justify-between mt-1">
              <div>
                {errors.caption && (
                  <p className="text-red-500 text-sm">{errors.caption}</p>
                )}
              </div>
              <p className={`text-sm ${isOverLimit ? 'text-red-500' : 'text-gray-400'}`}>
                {remainingChars} characters remaining
              </p>
            </div>
          </div>

          {/* Image URL Field */}
          <div>
            <label htmlFor="imageUrl" className="block text-sm font-medium text-white mb-2">
              Image URL *
            </label>
            <input
              id="imageUrl"
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className={`w-full px-4 py-3 rounded-lg bg-gray-800 border ${
                errors.imageUrl ? 'border-red-500' : 'border-gray-700'
              } text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors`}
              placeholder="https://example.com/image.jpg"
              disabled={isLoading}
            />
            {errors.imageUrl && (
              <p className="text-red-500 text-sm mt-1">{errors.imageUrl}</p>
            )}
            <p className="text-gray-400 text-xs mt-1">
              Must be HTTPS and end with .jpg, .jpeg, .png, or .gif
            </p>
          </div>

          {/* Image Preview (if valid URL) */}
          {imageUrl && !errors.imageUrl && (
            <div>
              <p className="text-sm font-medium text-white mb-2">Preview</p>
              <div className="relative w-full h-64 bg-gray-800 rounded-lg overflow-hidden">
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    setErrors(prev => ({ ...prev, imageUrl: 'Failed to load image. Check the URL.' }));
                  }}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="px-6 py-2 rounded-lg text-white bg-gray-600 hover:bg-gray-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <LoadingButton
              loading={isLoading}
              type="submit"
              className="px-6 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white font-bold transition-all flex items-center space-x-2"
              disabled={isLoading || isOverLimit}
            >
              {isLoading ? 'Publishing...' : 'Publish Now'}
            </LoadingButton>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default CreatePostModal;
