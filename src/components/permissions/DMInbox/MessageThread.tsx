// =====================================
// MESSAGE THREAD COMPONENT
// Displays conversation messages
// Differentiates sender/recipient with visual styling
// =====================================

import React, { useRef, useEffect } from 'react';
import { Bot, Check, CheckCheck, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Database } from '../../../lib/database.types';

type DMMessage = Database['public']['Tables']['instagram_dm_messages']['Row'];

interface MessageThreadProps {
  messages: DMMessage[];
  businessAccountId?: string;
  className?: string;
}

export const MessageThread: React.FC<MessageThreadProps> = ({
  messages,
  className = ''
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const formatTime = (timestamp: string): string => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (timestamp: string): string => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
  };

  // Group messages by date
  const messagesByDate: Record<string, DMMessage[]> = {};
  messages.forEach((message) => {
    const dateKey = formatDate(message.sent_at);
    if (!messagesByDate[dateKey]) {
      messagesByDate[dateKey] = [];
    }
    messagesByDate[dateKey].push(message);
  });

  return (
    <div
      ref={scrollRef}
      className={`flex-1 overflow-y-auto p-4 space-y-4 ${className}`}
      style={{ maxHeight: '600px' }}
    >
      {Object.entries(messagesByDate).map(([date, dateMessages]) => (
        <div key={date}>
          {/* Date Separator */}
          <div className="flex items-center justify-center my-4">
            <div className="px-3 py-1 bg-gray-800/50 rounded-full">
              <span className="text-xs text-gray-400">{date}</span>
            </div>
          </div>

          {/* Messages for this date */}
          {dateMessages.map((message, index) => {
            const isFromBusiness = message.is_from_business;

            return (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
                className={`flex ${isFromBusiness ? 'justify-end' : 'justify-start'} mb-3`}
              >
                <div
                  className={`
                    max-w-[70%] rounded-lg p-3
                    ${
                      isFromBusiness
                        ? 'bg-blue-500/20 border border-blue-500/30'
                        : 'bg-gray-800/50 border border-gray-700'
                    }
                  `}
                >
                  {/* Sender Name (for business messages) */}
                  {isFromBusiness && message.sender_username && (
                    <div className="flex items-center space-x-1 mb-1">
                      <span className="text-xs text-blue-400 font-medium">
                        {message.sender_username}
                      </span>
                      {message.was_automated && (
                        <Bot className="w-3 h-3 text-blue-400" />
                      )}
                    </div>
                  )}

                  {/* Message Text */}
                  <p className="text-gray-200 text-sm break-words">{message.message_text}</p>

                  {/* Timestamp + Status */}
                  <div className="flex items-center justify-end space-x-1 mt-2">
                    <span className="text-xs text-gray-500">{formatTime(message.sent_at)}</span>

                    {/* Delivery Status (only for business messages) */}
                    {isFromBusiness && (
                      <>
                        {message.send_status === 'sent' && (
                          <Check className="w-3 h-3 text-gray-500" />
                        )}
                        {message.send_status === 'delivered' && (
                          <CheckCheck className="w-3 h-3 text-gray-400" />
                        )}
                        {message.send_status === 'read' && (
                          <CheckCheck className="w-3 h-3 text-blue-400" />
                        )}
                        {message.send_status === 'failed' && (
                          <Clock className="w-3 h-3 text-red-400" />
                        )}
                      </>
                    )}

                    {/* Automated Indicator */}
                    {isFromBusiness && message.was_automated && (
                      <Bot className="w-3 h-3 text-blue-400" />
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ))}

      {/* Empty State */}
      {messages.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p>No messages yet</p>
        </div>
      )}
    </div>
  );
};

export default MessageThread;
