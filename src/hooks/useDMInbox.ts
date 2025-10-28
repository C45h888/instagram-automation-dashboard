// =====================================
// USE DM INBOX HOOK
// Fetches and manages Instagram DM conversations and messages
// Handles 24-hour window validation and message sending
// =====================================

import { useState, useEffect } from 'react';
import { usePermissionDemoStore } from '../stores/permissionDemoStore';
import PermissionDemoService from '../services/permissionDemoService';
import type { ConversationData } from '../types/permissions';
import type { Database } from '../lib/database.types';

type DMMessage = Database['public']['Tables']['instagram_dm_messages']['Row'];

interface UseDMInboxResult {
  conversations: ConversationData[];
  selectedConversation: ConversationData | null;
  messages: DMMessage[];
  isLoading: boolean;
  error: string | null;
  selectConversation: (conversationId: string) => void;
  sendMessage: (messageText: string) => Promise<void>;
  refetch: () => void;
}

export const useDMInbox = (): UseDMInboxResult => {
  const { demoMode } = usePermissionDemoStore();
  const [conversations, setConversations] = useState<ConversationData[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (demoMode) {
        // Use demo data generator
        await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate API delay
        const demoData = PermissionDemoService.generateDemoData({
          realistic: true,
          volume: 'medium',
          includeEdgeCases: true,
          timeRange: 'week'
        });
        setConversations(demoData.conversations);

        // Auto-select first conversation if none selected
        if (!selectedConversationId && demoData.conversations.length > 0) {
          setSelectedConversationId(demoData.conversations[0].id);
        }
      } else {
        // Fetch real data from Supabase
        // TODO: Implement real data fetching from instagram_dm_conversations table
        // const { data, error } = await supabase
        //   .from('instagram_dm_conversations')
        //   .select('*')
        //   .order('last_message_at', { ascending: false });

        // For now, fallback to demo data
        const demoData = PermissionDemoService.generateDemoData({
          realistic: true,
          volume: 'medium',
          includeEdgeCases: true,
          timeRange: 'week'
        });
        setConversations(demoData.conversations);

        if (!selectedConversationId && demoData.conversations.length > 0) {
          setSelectedConversationId(demoData.conversations[0].id);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch conversations');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    try {
      if (demoMode) {
        // Generate demo messages for this conversation
        await new Promise((resolve) => setTimeout(resolve, 300)); // Simulate API delay
        const demoMessages = PermissionDemoService.generateMessagesForConversation(
          conversationId,
          5
        );
        setMessages(demoMessages);
      } else {
        // Fetch real messages from Supabase
        // TODO: Implement real data fetching from instagram_dm_messages table
        // const { data, error } = await supabase
        //   .from('instagram_dm_messages')
        //   .select('*')
        //   .eq('conversation_id', conversationId)
        //   .order('sent_at', { ascending: true });

        // For now, use demo data
        const demoMessages = PermissionDemoService.generateMessagesForConversation(
          conversationId,
          5
        );
        setMessages(demoMessages);
      }
    } catch (err: any) {
      console.error('Failed to fetch messages:', err);
    }
  };

  const selectConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    fetchMessages(conversationId);
  };

  const sendMessage = async (messageText: string): Promise<void> => {
    if (!selectedConversationId) {
      throw new Error('No conversation selected');
    }

    const selectedConv = conversations.find((c) => c.id === selectedConversationId);
    if (!selectedConv) {
      throw new Error('Selected conversation not found');
    }

    // Validate 24-hour window
    if (!selectedConv.within_window || !selectedConv.can_send_messages) {
      throw new Error(
        'Cannot send message: 24-hour window has expired. Message templates required.'
      );
    }

    // Validate message
    if (!messageText.trim()) {
      throw new Error('Message cannot be empty');
    }

    try {
      if (demoMode) {
        // Simulate sending message
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Add message to local state
        const newMessage: DMMessage = {
          id: `message_${Date.now()}`,
          conversation_id: selectedConversationId,
          instagram_message_id: `ig_msg_${Date.now()}`,
          message_text: messageText,
          sender_instagram_id: 'demo_account_123',
          sender_username: 'modern_boutique',
          is_from_business: true,
          sent_by_user_id: 'agent_123',
          was_automated: false,
          send_status: 'sent',
          sent_at: new Date().toISOString(),
          delivered_at: null,
          read_at: null,
          is_read: false,
          message_type: 'text',
          media_type: null,
          media_url: null,
          automation_workflow_id: null,
          ai_generated: false,
          error_code: null,
          error_message: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        setMessages((prev) => [...prev, newMessage]);

        // Update conversation's last message time
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === selectedConversationId
              ? {
                  ...conv,
                  last_message_at: new Date().toISOString(),
                  message_count: conv.message_count + 1
                }
              : conv
          )
        );
      } else {
        // Send real message via Supabase function
        // TODO: Implement real message sending
        // const { error } = await supabase.rpc('send_dm_message', {
        //   conversation_id: selectedConversationId,
        //   message_text: messageText
        // });

        // For now, simulate success
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const newMessage: DMMessage = {
          id: `message_${Date.now()}`,
          conversation_id: selectedConversationId,
          instagram_message_id: `ig_msg_${Date.now()}`,
          message_text: messageText,
          sender_instagram_id: 'demo_account_123',
          sender_username: 'modern_boutique',
          is_from_business: true,
          sent_by_user_id: 'agent_123',
          was_automated: false,
          send_status: 'sent',
          sent_at: new Date().toISOString(),
          delivered_at: null,
          read_at: null,
          is_read: false,
          message_type: 'text',
          media_type: null,
          media_url: null,
          automation_workflow_id: null,
          ai_generated: false,
          error_code: null,
          error_message: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        setMessages((prev) => [...prev, newMessage]);
      }
    } catch (err: any) {
      throw new Error(err.message || 'Failed to send message');
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [demoMode]);

  useEffect(() => {
    if (selectedConversationId) {
      fetchMessages(selectedConversationId);
    }
  }, [selectedConversationId]);

  const selectedConversation =
    conversations.find((c) => c.id === selectedConversationId) || null;

  return {
    conversations,
    selectedConversation,
    messages,
    isLoading,
    error,
    selectConversation,
    sendMessage,
    refetch: fetchConversations
  };
};

export default useDMInbox;
