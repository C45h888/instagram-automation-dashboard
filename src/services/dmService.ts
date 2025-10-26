// =====================================
// INSTAGRAM DM MANAGEMENT SERVICE
// =====================================
// File: src/services/dmService.ts
// Version: 1.0.0
// Purpose: Instagram Direct Message management with 24-hour window tracking
//
// Features:
//   - 24-hour messaging window validation (Instagram Platform Policy 4.2)
//   - Conversation thread management
//   - Message sending with automatic window checks
//   - Window statistics and monitoring
//   - Real-time window expiration tracking
//
// CRITICAL: Always call canSendMessage() before sending business messages
// to ensure compliance with Instagram's 24-hour messaging window policy.
//
// IMPORTANT: After running migration 004_add_dm_tables.sql,
// regenerate types with: npm run db:types
// =====================================

import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

// =====================================
// TYPE DEFINITIONS
// =====================================

/**
 * Service response wrapper for consistent error handling
 * Matches pattern from consentService.ts
 */
export interface ServiceResponse<T> {
  success: boolean;
  data: T | null;
  error?: string;
  count?: number;
}

/**
 * 24-hour window status information
 * Returned by canSendMessage() to validate message sending
 */
export interface WindowStatus {
  canSend: boolean;
  withinWindow: boolean;
  hoursRemaining: number;
  minutesRemaining: number;
  expiresAt: string | null;
  reason: string;
}

/**
 * Aggregate window statistics for business dashboard
 */
export interface WindowStatistics {
  totalConversations: number;
  activeWindows: number;
  expiredWindows: number;
  noWindow: number;
  avgHoursRemaining: number | null;
  expiringSoon: number;
}

/**
 * DM conversation status enum
 */
export type ConversationStatus = 'active' | 'archived' | 'muted' | 'blocked' | 'pending';

/**
 * Message type enum
 */
export type MessageType =
  | 'text'
  | 'media'
  | 'story_reply'
  | 'story_mention'
  | 'post_share'
  | 'voice_note'
  | 'reel_share'
  | 'icebreaker';

/**
 * Message send status enum
 */
export type SendStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'rejected';

/**
 * Type aliases from auto-generated schema
 * These will be available after running npm run db:types
 */
export type DMConversation = Database['public']['Tables']['instagram_dm_conversations']['Row'];
export type DMMessage = Database['public']['Tables']['instagram_dm_messages']['Row'];

/**
 * Request structure for sending a message
 */
export interface SendMessageRequest {
  conversationId: string;
  messageText: string;
  messageType?: MessageType;
  mediaUrl?: string;
  mediaType?: string;
  senderId: string;
  senderInstagramId: string;
  senderUsername?: string;
}

/**
 * Request structure for creating a conversation
 */
export interface CreateConversationRequest {
  instagramThreadId: string;
  businessAccountId: string;
  customerInstagramId: string;
  customerUsername?: string;
  customerName?: string;
  customerProfilePicUrl?: string;
}

/**
 * Conversation filters for getConversations
 */
export interface ConversationFilters {
  status?: ConversationStatus;
  withinWindow?: boolean;
  hasUnread?: boolean;
}

/**
 * Active window conversation info
 */
export interface ActiveWindowConversation {
  conversationId: string;
  customerUsername: string;
  hoursRemaining: number;
  unreadCount: number;
  lastMessageAt: string;
}

// =====================================
// DM SERVICE CLASS
// =====================================

/**
 * DMService
 *
 * Manages Instagram Direct Message conversations and messages
 * with automated 24-hour window tracking for platform compliance.
 *
 * @example
 * ```typescript
 * // Check if can send message
 * const windowCheck = await DMService.canSendMessage(conversationId);
 * if (windowCheck.data?.canSend) {
 *   await DMService.sendMessage({
 *     conversationId,
 *     messageText: 'Hello!',
 *     senderId: userId,
 *     senderInstagramId: igId
 *   });
 * }
 * ```
 */
export class DMService {
  /**
   * Check if business can send message to conversation
   *
   * CRITICAL: Always call this before sending a business message
   * to ensure compliance with Instagram's 24-hour messaging window.
   *
   * @param conversationId - The conversation UUID
   * @returns Service response with window status details
   *
   * @example
   * ```typescript
   * const result = await DMService.canSendMessage('conversation-uuid');
   * if (result.success && result.data?.canSend) {
   *   console.log(`Can send! ${result.data.minutesRemaining} minutes remaining`);
   * } else {
   *   console.log(`Cannot send: ${result.data?.reason}`);
   * }
   * ```
   */
  static async canSendMessage(
    conversationId: string
  ): Promise<ServiceResponse<WindowStatus>> {
    try {
      const { data, error } = await supabase.rpc('can_send_message', {
        p_conversation_id: conversationId
      });

      if (error) {
        console.error('Can send message check error:', error);
        throw error;
      }

      // Function returns array with single row
      const result = (data as any[])[0];

      if (!result) {
        throw new Error('Conversation not found');
      }

      return {
        success: true,
        data: {
          canSend: result.can_send,
          withinWindow: result.within_window,
          hoursRemaining: parseFloat(result.hours_remaining) || 0,
          minutesRemaining: result.minutes_remaining || 0,
          expiresAt: result.expires_at,
          reason: result.reason
        }
      };
    } catch (error: any) {
      console.error('DMService.canSendMessage failed:', error);
      return {
        success: false,
        data: null,
        error: error.message || 'Failed to check message window'
      };
    }
  }

  /**
   * Get conversation with window status
   *
   * @param conversationId - The conversation UUID
   * @returns Service response with conversation and window details
   *
   * @example
   * ```typescript
   * const result = await DMService.getConversation('conversation-uuid');
   * if (result.success && result.data) {
   *   console.log(`Conversation with ${result.data.customer_username}`);
   *   console.log(`Unread: ${result.data.unread_count}, Within window: ${result.data.within_window}`);
   * }
   * ```
   */
  static async getConversation(
    conversationId: string
  ): Promise<ServiceResponse<DMConversation>> {
    try {
      const { data: conversation, error } = await supabase
        .from('instagram_dm_conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

      if (error) {
        console.error('Get conversation error:', error);
        throw error;
      }

      if (!conversation) {
        throw new Error('Conversation not found');
      }

      return {
        success: true,
        data: conversation
      };
    } catch (error: any) {
      console.error('DMService.getConversation failed:', error);
      return {
        success: false,
        data: null,
        error: error.message || 'Failed to get conversation'
      };
    }
  }

  /**
   * Get all conversations for a business account
   *
   * @param businessAccountId - The business account UUID
   * @param filters - Optional filters for status, window, unread
   * @returns Service response with array of conversations
   *
   * @example
   * ```typescript
   * // Get all active conversations
   * const active = await DMService.getConversations(businessId, {
   *   status: 'active',
   *   withinWindow: true
   * });
   *
   * // Get conversations with unread messages
   * const unread = await DMService.getConversations(businessId, {
   *   hasUnread: true
   * });
   * ```
   */
  static async getConversations(
    businessAccountId: string,
    filters?: ConversationFilters
  ): Promise<ServiceResponse<DMConversation[]>> {
    try {
      let query = supabase
        .from('instagram_dm_conversations')
        .select('*')
        .eq('business_account_id', businessAccountId)
        .order('last_message_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('conversation_status', filters.status);
      }

      if (filters?.withinWindow !== undefined) {
        query = query.eq('within_window', filters.withinWindow);
      }

      if (filters?.hasUnread) {
        query = query.gt('unread_count', 0);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('Get conversations error:', error);
        throw error;
      }

      return {
        success: true,
        data: data || [],
        count: count || data?.length || 0
      };
    } catch (error: any) {
      console.error('DMService.getConversations failed:', error);
      return {
        success: false,
        data: null,
        error: error.message || 'Failed to get conversations'
      };
    }
  }

  /**
   * Get conversations with active 24-hour windows
   * Sorted by expiration time (soonest first)
   *
   * @param businessAccountId - The business account UUID
   * @param limit - Maximum number of conversations to return
   * @returns Service response with active window conversations
   *
   * @example
   * ```typescript
   * const result = await DMService.getActiveWindowConversations(businessId, 10);
   * if (result.success) {
   *   result.data?.forEach(conv => {
   *     console.log(`${conv.customerUsername}: ${conv.hoursRemaining.toFixed(1)}h remaining`);
   *   });
   * }
   * ```
   */
  static async getActiveWindowConversations(
    businessAccountId: string,
    limit: number = 50
  ): Promise<ServiceResponse<ActiveWindowConversation[]>> {
    try {
      const { data, error } = await supabase.rpc('get_active_window_conversations', {
        p_business_account_id: businessAccountId,
        p_limit: limit
      });

      if (error) {
        console.error('Get active windows error:', error);
        throw error;
      }

      const conversations: ActiveWindowConversation[] = (data || []).map((row: any) => ({
        conversationId: row.conversation_id,
        customerUsername: row.customer_username,
        hoursRemaining: parseFloat(row.hours_remaining) || 0,
        unreadCount: row.unread_count || 0,
        lastMessageAt: row.last_message_at
      }));

      return {
        success: true,
        data: conversations,
        count: conversations.length
      };
    } catch (error: any) {
      console.error('DMService.getActiveWindowConversations failed:', error);
      return {
        success: false,
        data: null,
        error: error.message || 'Failed to get active windows'
      };
    }
  }

  /**
   * Create or update conversation (idempotent)
   *
   * @param request - Conversation creation details
   * @returns Service response with conversation ID
   *
   * @example
   * ```typescript
   * const result = await DMService.upsertConversation({
   *   instagramThreadId: 'ig_thread_12345',
   *   businessAccountId: 'business-uuid',
   *   customerInstagramId: 'customer_ig_67890',
   *   customerUsername: 'john_doe',
   *   customerName: 'John Doe'
   * });
   * if (result.success) {
   *   console.log('Conversation ID:', result.data?.id);
   * }
   * ```
   */
  static async upsertConversation(
    request: CreateConversationRequest
  ): Promise<ServiceResponse<{ id: string }>> {
    try {
      const { data, error } = await supabase.rpc('upsert_conversation', {
        p_instagram_thread_id: request.instagramThreadId,
        p_business_account_id: request.businessAccountId,
        p_customer_instagram_id: request.customerInstagramId,
        p_customer_username: request.customerUsername,
        p_customer_name: request.customerName
      });

      if (error) {
        console.error('Upsert conversation error:', error);
        throw error;
      }

      return {
        success: true,
        data: { id: data as string }
      };
    } catch (error: any) {
      console.error('DMService.upsertConversation failed:', error);
      return {
        success: false,
        data: null,
        error: error.message || 'Failed to create conversation'
      };
    }
  }

  /**
   * Get messages for a conversation (paginated)
   *
   * @param conversationId - The conversation UUID
   * @param limit - Maximum messages to return
   * @param offset - Pagination offset
   * @returns Service response with messages array
   *
   * @example
   * ```typescript
   * // Get most recent 50 messages
   * const messages = await DMService.getMessages('conversation-uuid', 50, 0);
   *
   * // Get next page
   * const moreMsgs = await DMService.getMessages('conversation-uuid', 50, 50);
   * ```
   */
  static async getMessages(
    conversationId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<ServiceResponse<any[]>> {
    try {
      const { data, error } = await supabase.rpc('get_conversation_messages', {
        p_conversation_id: conversationId,
        p_limit: limit,
        p_offset: offset
      });

      if (error) {
        console.error('Get messages error:', error);
        throw error;
      }

      return {
        success: true,
        data: data || [],
        count: data?.length || 0
      };
    } catch (error: any) {
      console.error('DMService.getMessages failed:', error);
      return {
        success: false,
        data: null,
        error: error.message || 'Failed to get messages'
      };
    }
  }

  /**
   * Send a message with automatic window validation
   *
   * CRITICAL: This method automatically checks the 24-hour window
   * before sending. If window is expired, send will fail.
   *
   * @param request - Message send details
   * @returns Service response with message ID
   *
   * @example
   * ```typescript
   * const result = await DMService.sendMessage({
   *   conversationId: 'conversation-uuid',
   *   messageText: 'Thanks for reaching out!',
   *   messageType: 'text',
   *   senderId: 'user-uuid',
   *   senderInstagramId: 'business_ig_id',
   *   senderUsername: 'my_business'
   * });
   *
   * if (!result.success) {
   *   console.error('Send failed:', result.error);
   *   // Error might be "Window expired - customer must send message first"
   * }
   * ```
   */
  static async sendMessage(
    request: SendMessageRequest
  ): Promise<ServiceResponse<{ id: string; messageId: string }>> {
    try {
      // CRITICAL: Check window before sending
      const windowCheck = await this.canSendMessage(request.conversationId);

      if (!windowCheck.success || !windowCheck.data) {
        throw new Error('Failed to check message window');
      }

      if (!windowCheck.data.canSend) {
        throw new Error(`Cannot send message: ${windowCheck.data.reason}`);
      }

      // Generate Instagram message ID (in production, this comes from Instagram API)
      const instagramMessageId = `msg_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      // Insert message (trigger will update conversation window)
      const { data, error } = await supabase
        .from('instagram_dm_messages')
        .insert({
          instagram_message_id: instagramMessageId,
          conversation_id: request.conversationId,
          sent_by_user_id: request.senderId,
          is_from_business: true,
          sender_instagram_id: request.senderInstagramId,
          sender_username: request.senderUsername,
          message_type: request.messageType || 'text',
          message_text: request.messageText,
          media_url: request.mediaUrl,
          media_type: request.mediaType,
          sent_at: new Date().toISOString(),
          send_status: 'sent'
        })
        .select('id')
        .single();

      if (error) {
        console.error('Send message error:', error);
        throw error;
      }

      return {
        success: true,
        data: {
          id: data.id,
          messageId: instagramMessageId
        }
      };
    } catch (error: any) {
      console.error('DMService.sendMessage failed:', error);
      return {
        success: false,
        data: null,
        error: error.message || 'Failed to send message'
      };
    }
  }

  /**
   * Record a customer message (usually from Instagram webhook)
   *
   * Customer messages automatically reset the 24-hour window via database trigger.
   *
   * @param request - Message details from Instagram
   * @returns Service response with message ID
   *
   * @example
   * ```typescript
   * // When webhook receives customer message
   * const result = await DMService.recordCustomerMessage({
   *   conversationId: 'conversation-uuid',
   *   messageText: 'Hi, I need help',
   *   senderInstagramId: 'customer_ig_id',
   *   senderUsername: 'customer_username',
   *   instagramMessageId: 'ig_msg_12345',
   *   messageType: 'text'
   * });
   * ```
   */
  static async recordCustomerMessage(request: {
    conversationId: string;
    instagramMessageId: string;
    messageText?: string;
    messageType?: MessageType;
    mediaUrl?: string;
    mediaType?: string;
    senderInstagramId: string;
    senderUsername?: string;
    sentAt?: string;
  }): Promise<ServiceResponse<{ id: string }>> {
    try {
      const { data, error } = await supabase
        .from('instagram_dm_messages')
        .insert({
          instagram_message_id: request.instagramMessageId,
          conversation_id: request.conversationId,
          is_from_business: false, // Customer message
          sender_instagram_id: request.senderInstagramId,
          sender_username: request.senderUsername,
          message_type: request.messageType || 'text',
          message_text: request.messageText,
          media_url: request.mediaUrl,
          media_type: request.mediaType,
          sent_at: request.sentAt || new Date().toISOString(),
          send_status: 'delivered'
        })
        .select('id')
        .single();

      if (error) {
        console.error('Record customer message error:', error);
        throw error;
      }

      return {
        success: true,
        data: { id: data.id }
      };
    } catch (error: any) {
      console.error('DMService.recordCustomerMessage failed:', error);
      return {
        success: false,
        data: null,
        error: error.message || 'Failed to record customer message'
      };
    }
  }

  /**
   * Mark message as read
   *
   * Automatically decrements unread count via database trigger.
   *
   * @param messageId - The message UUID
   * @returns Service response with success boolean
   *
   * @example
   * ```typescript
   * await DMService.markMessageRead('message-uuid');
   * ```
   */
  static async markMessageRead(messageId: string): Promise<ServiceResponse<boolean>> {
    try {
      const { error } = await supabase
        .from('instagram_dm_messages')
        .update({
          read_at: new Date().toISOString()
        })
        .eq('id', messageId);

      if (error) {
        console.error('Mark message read error:', error);
        throw error;
      }

      return {
        success: true,
        data: true
      };
    } catch (error: any) {
      console.error('DMService.markMessageRead failed:', error);
      return {
        success: false,
        data: false,
        error: error.message || 'Failed to mark message as read'
      };
    }
  }

  /**
   * Get window statistics for business account dashboard
   *
   * @param businessAccountId - The business account UUID
   * @returns Service response with aggregate statistics
   *
   * @example
   * ```typescript
   * const stats = await DMService.getWindowStatistics(businessId);
   * if (stats.success && stats.data) {
   *   console.log(`Active windows: ${stats.data.activeWindows}`);
   *   console.log(`Expired windows: ${stats.data.expiredWindows}`);
   *   console.log(`Expiring soon: ${stats.data.expiringSoon}`);
   * }
   * ```
   */
  static async getWindowStatistics(
    businessAccountId: string
  ): Promise<ServiceResponse<WindowStatistics>> {
    try {
      const { data, error } = await supabase.rpc('get_window_statistics', {
        p_business_account_id: businessAccountId
      });

      if (error) {
        console.error('Get window statistics error:', error);
        throw error;
      }

      const result = (data as any[])[0];

      if (!result) {
        // Return zero stats if no conversations exist
        return {
          success: true,
          data: {
            totalConversations: 0,
            activeWindows: 0,
            expiredWindows: 0,
            noWindow: 0,
            avgHoursRemaining: null,
            expiringSoon: 0
          }
        };
      }

      return {
        success: true,
        data: {
          totalConversations: result.total_conversations || 0,
          activeWindows: result.active_windows || 0,
          expiredWindows: result.expired_windows || 0,
          noWindow: result.no_window || 0,
          avgHoursRemaining: result.avg_hours_remaining
            ? parseFloat(result.avg_hours_remaining)
            : null,
          expiringSoon: result.expiring_soon || 0
        }
      };
    } catch (error: any) {
      console.error('DMService.getWindowStatistics failed:', error);
      return {
        success: false,
        data: null,
        error: error.message || 'Failed to get window statistics'
      };
    }
  }

  /**
   * Manually trigger window expiration check
   *
   * Usually run automatically by cron job every hour,
   * but can be called manually for testing or immediate updates.
   *
   * @returns Service response with expiration results
   *
   * @example
   * ```typescript
   * const result = await DMService.checkExpiredWindows();
   * console.log(`Expired ${result.data?.expiredCount} windows`);
   * ```
   */
  static async checkExpiredWindows(): Promise<
    ServiceResponse<{
      expiredCount: number;
      conversationIds: string[];
    }>
  > {
    try {
      const { data, error } = await supabase.rpc('check_expired_windows');

      if (error) {
        console.error('Check expired windows error:', error);
        throw error;
      }

      const result = (data as any[])[0];

      return {
        success: true,
        data: {
          expiredCount: result.expired_count || 0,
          conversationIds: result.conversation_ids || []
        }
      };
    } catch (error: any) {
      console.error('DMService.checkExpiredWindows failed:', error);
      return {
        success: false,
        data: null,
        error: error.message || 'Failed to check expired windows'
      };
    }
  }

  /**
   * Update conversation status
   *
   * @param conversationId - The conversation UUID
   * @param status - New conversation status
   * @returns Service response with success boolean
   *
   * @example
   * ```typescript
   * // Archive a conversation
   * await DMService.updateConversationStatus('conv-uuid', 'archived');
   *
   * // Mute notifications
   * await DMService.updateConversationStatus('conv-uuid', 'muted');
   * ```
   */
  static async updateConversationStatus(
    conversationId: string,
    status: ConversationStatus
  ): Promise<ServiceResponse<boolean>> {
    try {
      const { error } = await supabase
        .from('instagram_dm_conversations')
        .update({
          conversation_status: status
        })
        .eq('id', conversationId);

      if (error) {
        console.error('Update conversation status error:', error);
        throw error;
      }

      return {
        success: true,
        data: true
      };
    } catch (error: any) {
      console.error('DMService.updateConversationStatus failed:', error);
      return {
        success: false,
        data: false,
        error: error.message || 'Failed to update conversation status'
      };
    }
  }
}

// =====================================
// EXPORTS
// =====================================

export default DMService;

// Note: All types are already exported inline above with 'export interface' and 'export type'
