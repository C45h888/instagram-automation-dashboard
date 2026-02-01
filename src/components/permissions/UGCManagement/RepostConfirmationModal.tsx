// =====================================
// REPOST CONFIRMATION MODAL
// =====================================
// Purpose: Custom modal for confirming UGC repost with image preview
// Critical for Meta App Review: Demonstrates "Human Oversight"
// Replaces generic window.confirm() with deliberate, visual confirmation
// ✅ PHASE 1 FIX: Moved caption generation inside conditional to prevent null crash
// =====================================

import React from 'react';
import { X, Share2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { VisitorPost } from '../../../types/ugc';

interface RepostConfirmationModalProps {
  isOpen: boolean;
  post: VisitorPost;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const RepostConfirmationModal: React.FC<RepostConfirmationModalProps> = ({
  isOpen,
  post,
  onConfirm,
  onCancel,
  isLoading = false
}) => {
  return (
    <AnimatePresence>
      {isOpen && post && (
        <>
          {(() => {
            // ✅ PHASE 1 FIX: Generate credit caption ONLY when modal is open and post exists
            // This prevents crash when post is null during initial render
            const generateCreditCaption = () => {
              const originalCaption = post.message || '';
              const authorUsername = post.author_username || 'creator';

              return originalCaption
                ? `${originalCaption}\n\n📸 Credit: @${authorUsername}\n\n#UGC #UserGeneratedContent`
                : `📸 Credit: @${authorUsername}\n\n#UGC #UserGeneratedContent`;
            };

            const creditCaption = generateCreditCaption();

            return (
              <>
                {/* Backdrop */}
                <motion.div
                  className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={onCancel}
                />

                {/* Modal */}
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  <motion.div
                    className="relative glass-morphism-card rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-700/50">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                          <Share2 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-white">
                            Confirm Repost
                          </h2>
                          <p className="text-sm text-gray-400">
                            Review before posting to your Instagram
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={onCancel}
                        disabled={isLoading}
                        className="p-2 rounded-lg hover:bg-gray-700/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <X className="w-5 h-5 text-gray-400" />
                      </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                      {/* Warning Banner */}
                      <div className="flex items-start space-x-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 text-sm">
                          <p className="text-blue-300 font-medium mb-1">
                            Human Oversight Confirmation
                          </p>
                          <p className="text-blue-200/80">
                            You are about to repost user-generated content from{' '}
                            <span className="font-semibold">@{post.author_username || 'creator'}</span>.
                            The original creator will be credited in the caption.
                          </p>
                        </div>
                      </div>

                      {/* Image Preview */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Content Preview
                        </label>
                        <div className="relative aspect-square bg-gray-800 rounded-xl overflow-hidden">
                          {post.media_type === 'VIDEO' ? (
                            <video
                              src={post.media_url || undefined}
                              className="w-full h-full object-cover"
                              poster={post.thumbnail_url || undefined}
                              controls
                            />
                          ) : (
                            <img
                              src={post.media_url || 'https://via.placeholder.com/600?text=No+Image'}
                              alt="Content preview"
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                      </div>

                      {/* Caption Preview */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Caption (with credit)
                        </label>
                        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                          <p className="text-gray-300 text-sm whitespace-pre-wrap">
                            {creditCaption}
                          </p>
                          <div className="mt-3 pt-3 border-t border-gray-700/50 flex items-center justify-between text-xs">
                            <span className="text-gray-400">
                              {creditCaption.length} / 2,200 characters
                            </span>
                            <span className="text-green-400">
                              ✓ Original creator credited
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Metadata */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-700/30">
                          <p className="text-xs text-gray-400 mb-1">Original Author</p>
                          <p className="text-sm text-white font-medium truncate">
                            @{post.author_username || 'unknown'}
                          </p>
                        </div>
                        <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-700/30">
                          <p className="text-xs text-gray-400 mb-1">Media Type</p>
                          <p className="text-sm text-white font-medium">
                            {post.media_type || 'IMAGE'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-700/50 bg-gray-900/50">
                      <button
                        onClick={onCancel}
                        disabled={isLoading}
                        className="px-6 py-2.5 rounded-lg font-medium text-gray-300 hover:bg-gray-700/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className="px-6 py-2.5 rounded-lg font-medium bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 shadow-lg shadow-green-500/25"
                      >
                        {isLoading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Posting...</span>
                          </>
                        ) : (
                          <>
                            <Share2 className="w-4 h-4" />
                            <span>Confirm & Repost</span>
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                </div>
              </>
            );
          })()}
        </>
      )}
    </AnimatePresence>
  );
};
