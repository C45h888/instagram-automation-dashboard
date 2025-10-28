// =====================================
// REPLY INTERFACE COMPONENT
// Comment reply interface with character limit
// Integrates with toast notifications
// =====================================

import React, { useState } from 'react';
import { Send, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface ReplyInterfaceProps {
  commentId: string;
  commentAuthor: string;
  onSendReply: (commentId: string, replyText: string) => Promise<void>;
  onCancel?: () => void;
  className?: string;
}

const MAX_CHARACTERS = 2200; // Instagram comment character limit

export const ReplyInterface: React.FC<ReplyInterfaceProps> = ({
  commentId,
  commentAuthor,
  onSendReply,
  onCancel,
  className = ''
}) => {
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remainingChars = MAX_CHARACTERS - replyText.length;
  const isOverLimit = remainingChars < 0;
  const isNearLimit = remainingChars < 100 && remainingChars >= 0;

  const handleSend = async () => {
    if (!replyText.trim()) {
      setError('Reply cannot be empty');
      return;
    }

    if (isOverLimit) {
      setError(`Reply exceeds character limit by ${Math.abs(remainingChars)} characters`);
      return;
    }

    try {
      setIsSending(true);
      setError(null);
      await onSendReply(commentId, replyText);
      setReplyText(''); // Clear on success
    } catch (err: any) {
      setError(err.message || 'Failed to send reply');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter or Cmd+Enter to send
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className={`bg-gray-900/50 rounded-lg p-4 border border-blue-500/30 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-300">
          Replying to <span className="font-semibold text-blue-400">@{commentAuthor}</span>
        </p>
        <p
          className={`text-xs font-mono ${
            isOverLimit
              ? 'text-red-400 font-bold'
              : isNearLimit
              ? 'text-yellow-400'
              : 'text-gray-400'
          }`}
        >
          {remainingChars.toLocaleString()} / {MAX_CHARACTERS.toLocaleString()}
        </p>
      </div>

      {/* Textarea */}
      <textarea
        value={replyText}
        onChange={(e) => setReplyText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type your reply... (Ctrl+Enter to send)"
        className={`
          w-full min-h-[100px] p-3 rounded-lg
          bg-gray-800/50 text-white placeholder-gray-500
          border ${isOverLimit ? 'border-red-500/50' : 'border-gray-700'}
          focus:outline-none focus:ring-2 focus:ring-blue-500/50
          resize-none
        `}
        disabled={isSending}
      />

      {/* Error Message */}
      {error && (
        <div className="mt-2 flex items-center space-x-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between mt-3">
        <p className="text-xs text-gray-500">
          Press <span className="font-mono bg-gray-800 px-1.5 py-0.5 rounded">Ctrl+Enter</span> to send
        </p>

        <div className="flex items-center space-x-2">
          {onCancel && (
            <button
              onClick={onCancel}
              disabled={isSending}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          )}

          <button
            onClick={handleSend}
            disabled={isSending || !replyText.trim() || isOverLimit}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium
              flex items-center space-x-2 transition-all
              ${
                isSending || !replyText.trim() || isOverLimit
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }
            `}
          >
            {isSending ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Sending...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Send Reply</span>
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default ReplyInterface;
