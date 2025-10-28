// =====================================
// DM CONVERSATION LIST COMPONENT
// Displays list of all DM conversations
// Shows preview, unread count, and window status
// =====================================

import React from 'react';
import { Clock, AlertCircle, CheckCircle, User } from 'lucide-react';
import { motion } from 'framer-motion';
import type { ConversationData } from '../../../types/permissions';

interface DMConversationListProps {
  conversations: ConversationData[];
  selectedConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  className?: string;
}

export const DMConversationList: React.FC<DMConversationListProps> = ({
  conversations,
  selectedConversationId,
  onSelectConversation,
  className = ''
}) => {
  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className={`space-y-2 overflow-y-auto ${className}`} style={{ maxHeight: '600px' }}>
      {conversations.length === 0 ? (
        <div className="text-center py-12">
          <User className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No conversations yet</p>
        </div>
      ) : (
        conversations.map((conversation, index) => {
          const isSelected = conversation.id === selectedConversationId;
          const hasUnread = conversation.unread_count > 0;

          return (
            <motion.div
              key={conversation.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
              onClick={() => onSelectConversation(conversation.id)}
              className={`
                p-4 rounded-lg border cursor-pointer transition-all
                ${
                  isSelected
                    ? 'bg-purple-500/20 border-purple-500/50'
                    : 'bg-gray-900/50 border-gray-700 hover:border-purple-500/30'
                }
              `}
            >
              {/* Header: Avatar + Name + Time */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-sm">
                      {conversation.customer_username?.charAt(0).toUpperCase() || '?'}
                    </span>
                  </div>

                  {/* Name + Username */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm truncate">
                      {conversation.customer_name || 'Unknown'}
                    </p>
                    <p className="text-gray-400 text-xs truncate">
                      @{conversation.customer_username}
                    </p>
                  </div>
                </div>

                {/* Timestamp */}
                <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                  {formatTime((conversation.last_message_at || conversation.last_user_message_at) || new Date().toISOString())}
                </span>
              </div>

              {/* Message Count + Unread Badge */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">{conversation.message_count} messages</span>
                {hasUnread && (
                  <span className="px-2 py-0.5 bg-purple-500 text-white text-xs rounded-full font-bold">
                    {conversation.unread_count}
                  </span>
                )}
              </div>

              {/* Window Status Indicator */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-700">
                <div className="flex items-center space-x-1.5">
                  {conversation.within_window ? (
                    <>
                      <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                      <span className="text-xs text-green-400 font-medium">Can send</span>
                      <Clock className="w-3 h-3 text-green-400 ml-1" />
                      <span className="text-xs text-green-300">
                        {conversation.window_remaining_hours}h left
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                      <span className="text-xs text-red-400 font-medium">Window closed</span>
                    </>
                  )}
                </div>

                {/* Priority Badge */}
                {conversation.priority && conversation.priority !== 'normal' && (
                  <span
                    className={`
                      px-2 py-0.5 rounded text-xs font-medium
                      ${
                        conversation.priority === 'urgent'
                          ? 'bg-red-500/20 text-red-400'
                          : conversation.priority === 'high'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-blue-500/20 text-blue-400'
                      }
                    `}
                  >
                    {conversation.priority.toUpperCase()}
                  </span>
                )}
              </div>

              {/* Conversation Status */}
              {conversation.conversation_status && conversation.conversation_status !== 'active' && (
                <div className="mt-2 pt-2 border-t border-gray-700">
                  <span
                    className={`
                      inline-block px-2 py-0.5 rounded text-xs
                      ${
                        conversation.conversation_status === 'resolved'
                          ? 'bg-green-500/20 text-green-400'
                          : conversation.conversation_status === 'escalated'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-gray-500/20 text-gray-400'
                      }
                    `}
                  >
                    {conversation.conversation_status}
                  </span>
                </div>
              )}
            </motion.div>
          );
        })
      )}
    </div>
  );
};

export default DMConversationList;
