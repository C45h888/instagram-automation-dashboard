// =====================================
// DM INBOX PAGE
// Full page for Instagram Direct Messages management
// Demonstrates instagram_manage_messages permission
// =====================================

import React, { useState } from 'react';
import { useDMInbox } from '../hooks/useDMInbox';
import {
  DMConversationList,
  MessageThread,
  WindowStatusIndicator
} from '../components/permissions/DMInbox';
import { PermissionBadge } from '../components/permissions/shared/PermissionBadge';
import { FeatureHighlight } from '../components/permissions/shared/FeatureHighlight';
import AsyncWrapper from '../components/ui/AsyncWrapper';
import { MessageSquare, Send, Clock, Shield, Bot } from 'lucide-react';
import { useToast } from '../hooks/useToast';

const DMInbox: React.FC = () => {
  const {
    conversations,
    selectedConversation,
    messages,
    isLoading,
    error,
    selectConversation,
    sendMessage
  } = useDMInbox();

  const toast = useToast();
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSendMessage = async () => {
    if (!messageInput.trim()) {
      toast.error('Message cannot be empty', { title: 'Error' });
      return;
    }

    if (!selectedConversation) {
      toast.error('No conversation selected', { title: 'Error' });
      return;
    }

    try {
      setIsSending(true);
      await sendMessage(messageInput);
      setMessageInput(''); // Clear input on success
      toast.success('Message sent successfully!', { title: 'Success' });
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message', { title: 'Error', duration: 5000 });
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter or Cmd+Enter to send
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="space-y-6">
      {/* Demo Mode Toggle */}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <MessageSquare className="w-8 h-8 text-pink-400" />
            <div>
              <h1 className="text-3xl font-bold text-white">Direct Messages</h1>
              <p className="text-gray-400 text-sm">Manage Instagram direct message conversations</p>
            </div>
          </div>
          <PermissionBadge
            permission="instagram_manage_messages"
            status="granted"
            size="lg"
          />
        </div>

        {/* Feature Highlights */}
        <FeatureHighlight
          features={[
            {
              icon: Clock,
              title: '24-Hour Window',
              description: 'Automatic tracking of messaging windows',
              color: 'pink'
            },
            {
              icon: Shield,
              title: 'Policy Compliance',
              description: 'Built-in Meta Platform Policy enforcement',
              color: 'green'
            },
            {
              icon: Bot,
              title: 'Automation Support',
              description: 'Auto-reply and message templates',
              color: 'blue'
            },
            {
              icon: MessageSquare,
              title: 'Real-time Updates',
              description: 'Live message status and read receipts',
              color: 'purple'
            }
          ]}
          columns={4}
          className="mb-6"
        />
      </div>

      {/* Main Inbox Layout */}
      <AsyncWrapper
        loading={isLoading}
        error={error ? new Error(error) : null}
        data={conversations}
        skeleton={() => (
          <div className="glass-morphism-card p-6 rounded-xl animate-pulse">
            <div className="h-96 bg-white/5 rounded-lg"></div>
          </div>
        )}
      >
        {(data) => (
          <div className="glass-morphism-card rounded-xl border border-gray-700 overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
              {/* Left: Conversation List */}
              <div className="lg:col-span-1 border-r border-gray-700 p-4">
                <h3 className="text-white font-semibold mb-4 flex items-center justify-between">
                  Conversations
                  <span className="text-xs text-gray-400 font-normal">
                    {data.length} total
                  </span>
                </h3>
                <DMConversationList
                  conversations={data}
                  selectedConversationId={selectedConversation?.id || null}
                  onSelectConversation={selectConversation}
                />
              </div>

              {/* Right: Message Thread + Input */}
              <div className="lg:col-span-2 flex flex-col">
                {selectedConversation ? (
                  <>
                    {/* Conversation Header */}
                    <div className="p-4 border-b border-gray-700">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-white font-semibold">
                            {selectedConversation.customer_name || 'Unknown'}
                          </h3>
                          <p className="text-gray-400 text-sm">
                            @{selectedConversation.customer_username}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Window Status */}
                    <div className="p-4 border-b border-gray-700">
                      <WindowStatusIndicator
                        windowExpiresAt={selectedConversation.window_expires_at || new Date().toISOString()}
                        withinWindow={selectedConversation.within_window}
                        lastUserMessageAt={selectedConversation.last_user_message_at || new Date().toISOString()}
                      />
                    </div>

                    {/* Message Thread */}
                    <MessageThread
                      messages={messages}
                      businessAccountId="demo_account_123"
                      className="flex-1"
                    />

                    {/* Message Input */}
                    <div className="p-4 border-t border-gray-700 bg-gray-900/50">
                      <div className="flex space-x-3">
                        <textarea
                          value={messageInput}
                          onChange={(e) => setMessageInput(e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder={
                            selectedConversation.can_send_messages
                              ? 'Type your message... (Ctrl+Enter to send)'
                              : 'Cannot send message - 24-hour window expired'
                          }
                          disabled={!selectedConversation.can_send_messages || isSending}
                          className={`
                            flex-1 p-3 rounded-lg resize-none
                            bg-gray-800/50 text-white placeholder-gray-500
                            border ${
                              selectedConversation.can_send_messages
                                ? 'border-gray-700'
                                : 'border-red-500/50'
                            }
                            focus:outline-none focus:ring-2 focus:ring-purple-500/50
                            disabled:opacity-50 disabled:cursor-not-allowed
                          `}
                          rows={3}
                        />
                        <button
                          onClick={handleSendMessage}
                          disabled={
                            !selectedConversation.can_send_messages ||
                            isSending ||
                            !messageInput.trim()
                          }
                          className={`
                            px-6 py-3 rounded-lg font-medium
                            flex items-center space-x-2 transition-all
                            ${
                              !selectedConversation.can_send_messages ||
                              isSending ||
                              !messageInput.trim()
                                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                : 'bg-pink-500 hover:bg-pink-600 text-white'
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
                              <span>Send</span>
                            </>
                          )}
                        </button>
                      </div>

                      {!selectedConversation.can_send_messages && (
                        <div className="mt-2 text-xs text-red-400">
                          The 24-hour window has expired. Message templates are required to continue
                          messaging.
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center p-12">
                    <div className="text-center">
                      <MessageSquare className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400 text-lg">Select a conversation to view messages</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </AsyncWrapper>

      {/* Meta Review Note */}
      <div className="mt-8 p-4 bg-pink-500/10 rounded-xl border border-pink-500/30">
        <p className="text-xs text-pink-300 text-center">
          ✓ Demonstrates{' '}
          <span className="font-mono font-bold">instagram_manage_messages</span>{' '}
          permission: Send and receive direct messages, manage conversations within 24-hour window
        </p>
      </div>
    </div>
  );
};

export default DMInbox;
