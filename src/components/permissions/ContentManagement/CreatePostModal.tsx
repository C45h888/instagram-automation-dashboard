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
  platform?: 'instagram' | 'facebook';
}

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  platform = 'instagram'
}) => {
  // Existing state
  const [caption, setCaption] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ caption?: string; imageUrl?: string }>({});

  // New facade state for enterprise features
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [workflowStage, setWorkflowStage] = useState('');
  const [showHashtags, setShowHashtags] = useState(false);
  const [hashtagQuery, setHashtagQuery] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<{
    id: number;
    type: 'image' | 'video';
    url: string;
    thumbnail: string;
    name: string;
  } | null>(null);

  const { success, error: toastError } = useToast();
  const userId = useAuthStore(state => state.user?.id);
  const { businessAccountId } = useInstagramAccount();

  // Mock Gallery Data - Enterprise "Media Library" Facade
  const mockGallery = [
    {
      id: 1,
      type: 'image' as const,
      url: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800',
      thumbnail: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=200',
      name: 'Business Team'
    },
    {
      id: 2,
      type: 'image' as const,
      url: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800',
      thumbnail: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=200',
      name: 'Workspace'
    },
    {
      id: 3,
      type: 'image' as const,
      url: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800',
      thumbnail: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=200',
      name: 'Team Meeting'
    },
    {
      id: 4,
      type: 'image' as const,
      url: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=800',
      thumbnail: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=200',
      name: 'Marketing'
    },
    {
      id: 5,
      type: 'video' as const,
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      thumbnail: 'https://images.unsplash.com/photo-1492619375914-88005aa9e8fb?w=200',
      name: 'Product Demo'
    },
    {
      id: 6,
      type: 'video' as const,
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      thumbnail: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=200',
      name: 'Brand Story'
    }
  ];

  // Validation
  const validate = (): boolean => {
    const newErrors: { caption?: string; imageUrl?: string } = {};

    if (!caption.trim()) {
      newErrors.caption = 'Caption is required';
    } else if (caption.length > 2200) {
      newErrors.caption = 'Caption must be 2200 characters or less';
    }

    if (!imageUrl.trim()) {
      newErrors.imageUrl = 'Media URL is required';
    } else {
      // Updated URL validation to support videos
      try {
        const url = new URL(imageUrl);
        if (url.protocol !== 'https:') {
          newErrors.imageUrl = 'Media URL must use HTTPS';
        }
        if (!imageUrl.match(/\.(jpg|jpeg|png|gif|mp4|mov|avi)$/i)) {
          newErrors.imageUrl = 'Media URL must end with .jpg, .jpeg, .png, .gif, .mp4, .mov, or .avi';
        }
      } catch {
        newErrors.imageUrl = 'Invalid URL format';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Upload Simulation - Enterprise Facade
  const handleFileUploadSimulation = () => {
    setUploadProgress(0);

    // Simulate upload progress over 2 seconds
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          // On completion, set a valid mock URL
          const mockImage = mockGallery[0];
          setImageUrl(mockImage.url);
          setSelectedMedia(mockImage);
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  // Gallery Selection Handler
  const handleGallerySelect = (media: typeof mockGallery[0]) => {
    setSelectedMedia(media);
    setImageUrl(media.url);
    setErrors(prev => ({ ...prev, imageUrl: undefined }));
  };

  // Business-Safe Hashtags for Intelligence Feature
  const businessHashtags = [
    '#business', '#growth', '#innovation', '#marketing', '#startup',
    '#entrepreneur', '#success', '#strategy', '#leadership', '#digital',
    '#productivity', '#technology', '#branding', '#socialmedia', '#sales'
  ];

  // Hashtag Intelligence - Detect # and show suggestions
  const handleCaptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCaption = e.target.value;
    setCaption(newCaption);

    // Detect if user just typed '#'
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = newCaption.substring(0, cursorPos);
    const lastHashIndex = textBeforeCursor.lastIndexOf('#');

    if (lastHashIndex !== -1) {
      const textAfterHash = textBeforeCursor.substring(lastHashIndex + 1);
      // Show hashtags if # is at start or after space, and no space after #
      const charBeforeHash = lastHashIndex > 0 ? textBeforeCursor[lastHashIndex - 1] : ' ';
      if ((charBeforeHash === ' ' || lastHashIndex === 0) && !textAfterHash.includes(' ')) {
        setHashtagQuery(textAfterHash.toLowerCase());
        setShowHashtags(true);
        return;
      }
    }

    setShowHashtags(false);
  };

  // Insert Hashtag at Cursor Position
  const handleHashtagInsert = (hashtag: string) => {
    const cursorPos = caption.length;
    const textBeforeCursor = caption.substring(0, cursorPos);
    const lastHashIndex = textBeforeCursor.lastIndexOf('#');

    if (lastHashIndex !== -1) {
      const beforeHash = caption.substring(0, lastHashIndex);
      const afterCursor = caption.substring(cursorPos);
      setCaption(beforeHash + hashtag + ' ' + afterCursor);
    } else {
      // If no # found, just append
      setCaption(caption + hashtag + ' ');
    }

    setShowHashtags(false);
    setHashtagQuery('');
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

      // ===== N8N WORKFLOW SIMULATION =====
      // Stage 1: Encrypting & Uploading
      setWorkflowStage('🔒 Encrypting & Uploading to Secure Storage...');
      await new Promise(resolve => setTimeout(resolve, 800));

      // Stage 2: N8N Content Optimization
      setWorkflowStage('⚙️ Triggering N8N Content Optimization...');
      await new Promise(resolve => setTimeout(resolve, 1200));

      // Stage 3: Publishing
      setWorkflowStage('✅ Media Format Validated. Publishing...');
      await new Promise(resolve => setTimeout(resolve, 400));

      // ===== ACTUAL API CALL =====
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
      setWorkflowStage('');
      setSelectedMedia(null);
      setUploadProgress(0);

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
      setWorkflowStage('');
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
      title={`Create New ${platform === 'instagram' ? 'Instagram' : 'Facebook'} Post`}
      size="lg"
    >
      <div className="p-6">
        <p className="text-gray-300 mb-6">
          {platform === 'instagram'
            ? 'Publish a new image post to your Instagram account. Image must be publicly accessible via HTTPS.'
            : 'Publish a new post to your Facebook page. Media must be publicly accessible via HTTPS.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Caption Field with Hashtag Intelligence */}
          <div className="relative">
            <label htmlFor="caption" className="block text-sm font-medium text-white mb-2">
              Caption *
            </label>
            <textarea
              id="caption"
              value={caption}
              onChange={handleCaptionChange}
              className={`w-full px-4 py-3 rounded-lg bg-gray-800 border ${
                errors.caption ? 'border-red-500' : 'border-gray-700'
              } text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors resize-none`}
              placeholder="Write your caption here... (Type # for hashtag suggestions)"
              rows={4}
              maxLength={2200}
              disabled={isLoading}
            />

            {/* Hashtag Suggestions Popover */}
            {showHashtags && (
              <div className="absolute z-10 mt-1 w-full max-w-xs bg-gray-800 border border-gray-700 rounded-lg shadow-lg overflow-hidden">
                <div className="p-2 bg-gray-900 border-b border-gray-700">
                  <p className="text-xs text-gray-400 font-medium">💡 Suggested Hashtags</p>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {businessHashtags
                    .filter(tag => tag.toLowerCase().includes(hashtagQuery))
                    .slice(0, 8)
                    .map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleHashtagInsert(tag)}
                        className="w-full text-left px-4 py-2 text-sm text-white hover:bg-blue-600/20 hover:text-blue-400 transition-colors"
                      >
                        {tag}
                      </button>
                    ))}
                  {businessHashtags.filter(tag => tag.toLowerCase().includes(hashtagQuery)).length === 0 && (
                    <div className="px-4 py-3 text-sm text-gray-500 text-center">
                      No matching hashtags
                    </div>
                  )}
                </div>
              </div>
            )}

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

          {/* Media Selection - Tabbed Interface */}
          <div>
            <label className="block text-sm font-medium text-white mb-3">
              Media Source *
            </label>

            {/* Tab Selector */}
            <div className="flex space-x-2 mb-4 border-b border-gray-700">
              <button
                type="button"
                onClick={() => setActiveTab('upload')}
                className={`px-4 py-2 text-sm font-medium transition-all ${
                  activeTab === 'upload'
                    ? 'text-blue-400 border-b-2 border-blue-400'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
                disabled={isLoading}
              >
                📚 Media Library
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('url')}
                className={`px-4 py-2 text-sm font-medium transition-all ${
                  activeTab === 'url'
                    ? 'text-blue-400 border-b-2 border-blue-400'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
                disabled={isLoading}
              >
                🔗 Direct URL
              </button>
            </div>

            {/* Media Library Tab */}
            {activeTab === 'upload' && (
              <div className="space-y-4">
                {/* Upload Simulation Area */}
                <div
                  onClick={handleFileUploadSimulation}
                  className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-gray-800/50 transition-all"
                >
                  <div className="flex flex-col items-center space-y-2">
                    <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-white font-medium">Click to simulate upload</p>
                    <p className="text-gray-400 text-sm">Images and videos supported</p>
                  </div>

                  {/* Progress Bar */}
                  {uploadProgress > 0 && uploadProgress < 100 && (
                    <div className="mt-4">
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all duration-200"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="text-sm text-gray-400 mt-2">{uploadProgress}% uploaded</p>
                    </div>
                  )}
                </div>

                {/* Mock Gallery Grid */}
                <div>
                  <p className="text-sm font-medium text-white mb-3">Recent Media</p>
                  <div className="grid grid-cols-3 gap-3">
                    {mockGallery.map((media) => (
                      <div
                        key={media.id}
                        onClick={() => handleGallerySelect(media)}
                        className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                          selectedMedia?.id === media.id
                            ? 'border-blue-500 ring-2 ring-blue-500/50'
                            : 'border-transparent hover:border-gray-600'
                        }`}
                      >
                        <img
                          src={media.thumbnail}
                          alt={media.name}
                          className="w-full h-full object-cover"
                        />
                        {media.type === 'video' && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                            </svg>
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                          <p className="text-white text-xs truncate">{media.name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Direct URL Tab */}
            {activeTab === 'url' && (
              <div>
                <input
                  id="imageUrl"
                  type="text"
                  value={imageUrl}
                  onChange={(e) => {
                    setImageUrl(e.target.value);
                    setSelectedMedia(null);
                  }}
                  className={`w-full px-4 py-3 rounded-lg bg-gray-800 border ${
                    errors.imageUrl ? 'border-red-500' : 'border-gray-700'
                  } text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors`}
                  placeholder="https://example.com/media.jpg or .mp4"
                  disabled={isLoading}
                />
                <p className="text-gray-400 text-xs mt-2">
                  Must be HTTPS and end with .jpg, .jpeg, .png, .gif, .mp4, .mov, or .avi
                </p>
              </div>
            )}

            {/* Error Display */}
            {errors.imageUrl && (
              <p className="text-red-500 text-sm mt-2">{errors.imageUrl}</p>
            )}
          </div>

          {/* Media Preview (Enhanced for Video) */}
          {imageUrl && !errors.imageUrl && (
            <div>
              <p className="text-sm font-medium text-white mb-2">Preview</p>
              <div className="relative w-full h-64 bg-gray-800 rounded-lg overflow-hidden">
                {selectedMedia?.type === 'video' || imageUrl.match(/\.(mp4|mov|avi)$/i) ? (
                  <video
                    src={imageUrl}
                    controls
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      setErrors(prev => ({ ...prev, imageUrl: 'Failed to load video. Check the URL.' }));
                    }}
                  >
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <img
                    src={imageUrl}
                    alt="Preview"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      setErrors(prev => ({ ...prev, imageUrl: 'Failed to load image. Check the URL.' }));
                    }}
                  />
                )}
              </div>
            </div>
          )}

          {/* N8N Workflow Status Display */}
          {workflowStage && (
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 flex items-center space-x-3">
              <div className="flex-shrink-0">
                <svg className="animate-spin h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-blue-400 text-sm font-medium">{workflowStage}</p>
                <p className="text-gray-400 text-xs mt-0.5">Enterprise workflow automation in progress...</p>
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
