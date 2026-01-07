// =====================================
// USE DM INBOX HOOK - PRODUCTION
// Fetches REAL Instagram DM conversations from Meta Graph API v23.0
// NO MOCK DATA, NO FALLBACKS
// Handles 24-hour window validation and message sending
//
// ✅ UPDATED: Uses useInstagramAccount hook
// ✅ UPDATED: Passes userId + businessAccountId query params
// ✅ UPDATED: No Authorization header (backend handles tokens)
// ✅ UPDATED: Uses VITE_API_BASE_URL
// =====================================

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useInstagramAccount } from './useInstagramAccount';
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

/**
 * Hook to fetch and manage DM conversations
 * ✅ UPDATED: No longer takes businessAccountId parameter (gets from useInstagramAccount)
 */
export const useDMInbox = (): UseDMInboxResult => {
  // ✅ NEW: Get user ID from auth store (no token needed)
  const { user } = useAuthStore();

  // ✅ NEW: Get Instagram account IDs from useInstagramAccount hook
  const { businessAccountId, instagramBusinessId } = useInstagramAccount();

  const [conversations, setConversations] = useState<ConversationData[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    // ✅ UPDATED: Validate user ID and business account ID
    if (!user?.id || !businessAccountId || !instagramBusinessId) {
      setError('No Instagram Business Account connected.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // ✅ UPDATED: Use VITE_API_BASE_URL from environment
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://api.888intelligenceautomation.in';

      // ✅ UPDATED: Build URL with full base URL and required query parameters
      const response = await fetch(
        `${apiBaseUrl}/api/instagram/conversations/${instagramBusinessId}?userId=${user.id}&businessAccountId=${businessAccountId}`,
        {
          headers: {
            // ✅ REMOVED: Authorization header (backend retrieves token internally)
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API Error: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch conversations');
      }

      setConversations(result.data || []);

      // Auto-select first conversation if none selected
      if (result.data?.length > 0 && !selectedConversationId) {
        setSelectedConversationId(result.data[0].id);
      }

      console.log('✅ Conversations fetched:', result.data?.length || 0);

    } catch (err: any) {
      console.error('❌ Conversations fetch failed:', err);
      setError(err.message || 'Failed to fetch conversations');
      setConversations([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, businessAccountId, instagramBusinessId, selectedConversationId]); // ✅ UPDATED: Removed token, added user.id and instagramBusinessId

  const fetchMessages = useCallback(async (conversationId: string) => {
    // ✅ UPDATED: Validate authentication
    if (!user?.id || !businessAccountId) {
      console.error('❌ Cannot fetch messages: No authentication');
      return;
    }

    try {
      // ✅ UPDATED: Use VITE_API_BASE_URL and add required query parameters
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://api.888intelligenceautomation.in';
      const response = await fetch(
        `${apiBaseUrl}/api/instagram/conversations/${conversationId}/messages?userId=${user.id}&businessAccountId=${businessAccountId}`,
        {
          headers: {
            // ✅ REMOVED: Authorization header (backend retrieves token internally)
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const result = await response.json();
        setMessages(result.data || []);
        console.log('✅ Messages fetched:', result.data?.length || 0);
      }
    } catch (err: any) {
      console.error('❌ Failed to fetch messages:', err);
    }
  }, [user?.id, businessAccountId]); // ✅ UPDATED: Removed token, added user.id and businessAccountId

  const selectConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    fetchMessages(conversationId);
  };

  const sendMessage = async (messageText: string): Promise<void> => {
    // ✅ UPDATED: Validate authentication
    if (!user?.id || !businessAccountId) {
      throw new Error('No Instagram Business Account connected');
    }

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
      // ✅ UPDATED: Use VITE_API_BASE_URL and add required query parameters
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://api.888intelligenceautomation.in';
      const response = await fetch(
        `${apiBaseUrl}/api/instagram/conversations/${selectedConversationId}/send?userId=${user.id}&businessAccountId=${businessAccountId}`,
        {
          method: 'POST',
          headers: {
            // ✅ REMOVED: Authorization header (backend retrieves token internally)
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ message: messageText })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send message');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to send message');
      }

      // Refresh messages to show the new message
      await fetchMessages(selectedConversationId);

      // Update conversation's last message time in local state
      setConversations(prev =>
        prev.map(conv =>
          conv.id === selectedConversationId
            ? {
                ...conv,
                last_message_at: new Date().toISOString(),
                message_count: conv.message_count + 1
              }
            : conv
        )
      );

      console.log('✅ Message sent successfully');
    } catch (err: any) {
      throw new Error(err.message || 'Failed to send message');
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (selectedConversationId) {
      fetchMessages(selectedConversationId);
    }
  }, [selectedConversationId, fetchMessages]);

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
