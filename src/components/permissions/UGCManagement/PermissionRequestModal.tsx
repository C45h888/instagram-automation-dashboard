// =====================================
// PERMISSION REQUEST MODAL
// Modal for requesting repost permission from content creators
// =====================================

import React, { useState } from 'react';
import { X, Shield, Send } from 'lucide-react';
import type { VisitorPost, PermissionRequestForm } from '../../../types/ugc';

interface PermissionRequestModalProps {
  isOpen: boolean;
  post: VisitorPost | null;
  onClose: () => void;
  onSubmit: (form: PermissionRequestForm) => Promise<void>;
}

export const PermissionRequestModal: React.FC<PermissionRequestModalProps> = ({
  isOpen,
  post,
  onClose,
  onSubmit
}) => {
  const [requestMessage, setRequestMessage] = useState(
    `Hi! We love your post featuring our brand. Would you give us permission to repost it on our Instagram account? We'll give you full credit! 🙏`
  );
  const [permissionType, setPermissionType] = useState<'one_time' | 'perpetual' | 'campaign_specific'>('one_time');
  const [requestedVia, setRequestedVia] = useState<'dm' | 'comment' | 'email' | 'manual'>('dm');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !post) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onSubmit({
        ugcContentId: post.id,
        requestMessage,
        permissionType,
        requestedVia
      });
      onClose();
    } catch (error) {
      console.error('Failed to request permission:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="glass-morphism-card max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-2xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Shield className="w-6 h-6 text-purple-400" />
            <h2 className="text-2xl font-bold text-white">Request Repost Permission</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Post Preview */}
        <div className="mb-6 p-4 bg-gray-800/50 rounded-lg">
          <div className="flex items-center space-x-3 mb-3">
            <img
              src={post.author_profile_picture_url || 'https://i.pravatar.cc/150?img=0'}
              alt={post.author_name || 'User'}
              className="w-10 h-10 rounded-full"
            />
            <div>
              <p className="text-white font-semibold">{post.author_name}</p>
              <p className="text-gray-400 text-sm">@{post.author_username}</p>
            </div>
          </div>
          {post.message && (
            <p className="text-gray-300 text-sm line-clamp-2">{post.message}</p>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Request Message */}
          <div>
            <label className="block text-white font-medium mb-2">
              Permission Request Message
            </label>
            <textarea
              value={requestMessage}
              onChange={(e) => setRequestMessage(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Write your permission request message..."
            />
          </div>

          {/* Permission Type */}
          <div>
            <label className="block text-white font-medium mb-2">
              Permission Type
            </label>
            <select
              value={permissionType}
              onChange={(e) => setPermissionType(e.target.value as any)}
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="one_time">One-Time Use</option>
              <option value="perpetual">Perpetual (Unlimited)</option>
              <option value="campaign_specific">Campaign-Specific</option>
            </select>
          </div>

          {/* Request Via */}
          <div>
            <label className="block text-white font-medium mb-2">
              Send Request Via
            </label>
            <select
              value={requestedVia}
              onChange={(e) => setRequestedVia(e.target.value as any)}
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="dm">Instagram DM (Recommended)</option>
              <option value="comment">Comment on Post</option>
              <option value="email">Email</option>
              <option value="manual">Manual (Track Only)</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 bg-gray-700/50 text-white rounded-lg hover:bg-gray-700/70 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              <Send className="w-5 h-5" />
              <span>{isSubmitting ? 'Sending...' : 'Send Request'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
