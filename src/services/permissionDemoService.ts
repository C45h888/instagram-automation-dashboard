// =====================================
// PERMISSION DEMO SERVICE
// Generates realistic demo data for screencast
// Integrates with existing DatabaseService patterns
// =====================================

import type {
  InstagramProfileData,
  CommentData,
  MediaData,
  ConversationData,
  GeneratedDemoData,
  DemoDataOptions
} from '../types/permissions';
import type { VisitorPost, UGCStats } from '../types/ugc';

class PermissionDemoService {

  /**
   * Generate complete demo dataset for screencast
   * @param options - Configuration for data generation
   * @returns Complete set of demo data
   */
  static generateDemoData(options: DemoDataOptions): GeneratedDemoData {
    const {
      realistic: _realistic = true, // Prefixed with _ to indicate intentionally unused
      volume = 'medium',
      includeEdgeCases = true,
      timeRange = 'week'
    } = options;

    // Volume multipliers
    const volumeMultiplier = {
      low: 0.5,
      medium: 1,
      high: 2
    }[volume];

    return {
      profiles: this.generateProfiles(volumeMultiplier),
      comments: this.generateComments(volumeMultiplier, includeEdgeCases, timeRange),
      media: this.generateMedia(volumeMultiplier, timeRange),
      conversations: this.generateConversations(volumeMultiplier, includeEdgeCases),
      messages: [] // Generated separately based on conversations
    };
  }

  /**
   * Generate Instagram profile data
   * Demonstrates instagram_basic permission
   */
  private static generateProfiles(_multiplier: number): InstagramProfileData[] {
    const baseProfile: InstagramProfileData = {
      id: 'demo_account_123',
      username: 'modern_boutique',
      name: 'Modern Boutique',
      account_type: 'business',
      profile_picture_url: undefined,
      followers_count: 12483,
      following_count: 856,
      media_count: 342,
      biography: 'Your destination for contemporary fashion 👗 • Free shipping over $50 • DM us for styling tips',
      website: 'https://modernboutique.com',
      is_verified: true
    };

    return [baseProfile];
  }

  /**
   * Generate comment data with sentiment
   * Demonstrates instagram_manage_comments permission
   */
  private static generateComments(
    multiplier: number,
    _includeEdgeCases: boolean,
    timeRange: string
  ): CommentData[] {
    const baseComments: Partial<CommentData>[] = [
      {
        text: "Love this dress! Is it available in size M? 😍",
        author_username: "sarah_style",
        author_name: "Sarah Johnson",
        sentiment: 'positive',
        priority_level: 'high',
        requires_response: true,
        like_count: 3,
        processed_by_automation: false
      },
      {
        text: "Still waiting for my order from 2 weeks ago. Order #12345. Please help!",
        author_username: "frustrated_customer",
        author_name: "Mike Davis",
        sentiment: 'negative',
        priority_level: 'urgent',
        requires_response: true,
        like_count: 0,
        processed_by_automation: false
      },
      {
        text: "Beautiful collection! 🔥",
        author_username: "fashion_lover_23",
        author_name: "Emma Wilson",
        sentiment: 'positive',
        priority_level: 'low',
        requires_response: false,
        like_count: 8,
        processed_by_automation: true,
        automated_response_sent: true,
        response_text: "Thank you! We appreciate your support! 💕"
      },
      {
        text: "What material is this made from? Any eco-friendly options?",
        author_username: "eco_conscious_buyer",
        author_name: "Alex Green",
        sentiment: 'neutral',
        priority_level: 'medium',
        requires_response: true,
        like_count: 2,
        processed_by_automation: false
      },
      {
        text: "Scam! Never received my package!",
        author_username: "angry_buyer99",
        author_name: "Anonymous",
        sentiment: 'negative',
        priority_level: 'urgent',
        requires_response: true,
        like_count: 1,
        processed_by_automation: false
      }
    ];

    // Generate more comments based on volume
    const count = Math.floor(baseComments.length * multiplier);
    const comments: CommentData[] = baseComments.slice(0, count).map((comment, index) => ({
      id: `comment_${index + 1}`,
      instagram_comment_id: `ig_comment_${Date.now()}_${index}`,
      media_id: `post_${(index % 3) + 1}`,
      business_account_id: 'demo_account_123',
      text: comment.text!,
      author_instagram_id: `user_${index + 100}`,
      author_username: comment.author_username!,
      author_name: comment.author_name!,
      sentiment: comment.sentiment as any,
      priority: comment.priority_level as any,
      priority_level: comment.priority_level!,
      requires_response: comment.requires_response!,
      like_count: comment.like_count ?? 0, // Coalesce undefined to 0
      reply_count: 0,
      processed_by_automation: comment.processed_by_automation!,
      automated_response_sent: comment.automated_response_sent || false,
      response_text: comment.response_text ?? null,
      response_sent_at: comment.automated_response_sent ? new Date().toISOString() : null,
      published_at: this.getRandomDate(timeRange),
      post_title: `Product Showcase #${(index % 3) + 1}`,
      post_thumbnail: undefined,
      sentiment_score: this.getSentimentScore(comment.sentiment as any),
      parent_comment_id: null,
      category: null
    }));

    return comments;
  }

  /**
   * Generate media/content data
   * Demonstrates instagram_content_publish permission
   */
  private static generateMedia(multiplier: number, timeRange: string): MediaData[] {
    const baseMedia: Partial<MediaData>[] = [
      {
        instagram_media_id: 'media_001',
        media_type: 'IMAGE',
        caption: '✨ New Arrival: Summer Collection 2024! Shop the look in bio',
        like_count: 342,
        comments_count: 28,
        shares_count: 12,
        reach: 5420,
        impressions: 8234,
        engagement_rate: 8.2,
        performance_tier: 'high'
      },
      {
        instagram_media_id: 'media_002',
        media_type: 'CAROUSEL_ALBUM',
        caption: '5 Ways to Style Your Favorite Dress 👗',
        like_count: 198,
        comments_count: 15,
        shares_count: 8,
        reach: 3210,
        impressions: 4567,
        engagement_rate: 6.5,
        performance_tier: 'average'
      },
      {
        instagram_media_id: 'media_003',
        media_type: 'VIDEO',
        caption: 'Behind the scenes of our latest photoshoot! 📸',
        like_count: 567,
        comments_count: 42,
        shares_count: 23,
        reach: 8920,
        impressions: 12456,
        engagement_rate: 11.3,
        performance_tier: 'viral'
      }
    ];

    const count = Math.floor(baseMedia.length * multiplier);
    const media: MediaData[] = baseMedia.slice(0, count).map((item, index) => ({
      id: `post_${index + 1}`,
      business_account_id: 'demo_account_123',
      instagram_media_id: item.instagram_media_id!,
      media_type: item.media_type as any,
      media_url: null,
      thumbnail_url: null,
      permalink: `https://instagram.com/p/demo${index + 1}`,
      caption: item.caption!,
      hashtags: ['fashion', 'style', 'boutique'],
      mentions: [],
      like_count: item.like_count!,
      comments_count: item.comments_count!,
      shares_count: item.shares_count!,
      reach: item.reach!,
      impressions: item.impressions!,
      published_at: this.getRandomDate(timeRange),
      last_updated_at: new Date().toISOString(),
      engagement_rate: item.engagement_rate!,
      performance_tier: item.performance_tier!,
      best_time_posted: item.engagement_rate! > 7
    }));

    return media;
  }

  /**
   * Generate DM conversation data
   * Demonstrates instagram_business_manage_messages permission
   */
  private static generateConversations(
    multiplier: number,
    _includeEdgeCases: boolean // Prefixed with _ to indicate intentionally unused
  ): ConversationData[] {
    const now = new Date();
    const nowISO = now.toISOString();

    const baseConversations = [
      {
        customer_instagram_id: 'user_301',
        customer_username: 'jennifer_r',
        customer_name: 'Jennifer Rodriguez',
        conversation_status: 'active',
        within_window: true,
        last_user_message_at: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
        window_expires_at: new Date(now.getTime() + 22 * 60 * 60 * 1000).toISOString(),
        message_count: 3,
        unread_count: 1,
        priority: 'normal' as const,
        window_remaining_hours: 22,
        can_send_messages: true,
        requires_template: false
      },
      {
        customer_instagram_id: 'user_302',
        customer_username: 'urgent_customer',
        customer_name: 'Michael Chen',
        conversation_status: 'escalated',
        within_window: false,
        last_user_message_at: new Date(now.getTime() - 30 * 60 * 60 * 1000).toISOString(),
        window_expires_at: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
        message_count: 7,
        unread_count: 2,
        priority: 'urgent' as const,
        window_remaining_hours: 0,
        can_send_messages: false,
        requires_template: true
      },
      {
        customer_instagram_id: 'user_303',
        customer_username: 'happy_shopper',
        customer_name: 'Emily Watson',
        conversation_status: 'resolved',
        within_window: true,
        last_user_message_at: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),
        window_expires_at: new Date(now.getTime() + 23 * 60 * 60 * 1000).toISOString(),
        message_count: 5,
        unread_count: 0,
        priority: 'normal' as const,
        window_remaining_hours: 23,
        can_send_messages: true,
        requires_template: false
      }
    ];

    const count = Math.floor(baseConversations.length * multiplier);
    const conversations: ConversationData[] = baseConversations.slice(0, count).map((conv, index) => ({
      // Required database fields
      id: `conversation_${index + 1}`,
      business_account_id: 'demo_account_123',
      instagram_thread_id: `ig_thread_${Date.now()}_${index}`,
      customer_instagram_id: conv.customer_instagram_id,
      customer_username: conv.customer_username,
      customer_name: conv.customer_name,
      customer_profile_pic_url: null,
      customer_user_id: null,
      conversation_status: conv.conversation_status,
      ai_assistant_enabled: false,
      auto_reply_enabled: false,
      within_window: conv.within_window,
      last_user_message_at: conv.last_user_message_at,
      window_expires_at: conv.window_expires_at,
      message_count: conv.message_count,
      unread_count: conv.unread_count,
      last_message_at: conv.last_user_message_at,
      last_message_preview: null,
      first_message_at: conv.last_user_message_at,
      created_at: nowISO,
      updated_at: nowISO,
      // Additional demo-specific fields
      window_remaining_hours: conv.window_remaining_hours,
      can_send_messages: conv.can_send_messages,
      requires_template: conv.requires_template,
      priority: conv.priority
    }));

    return conversations;
  }

  /**
   * Helper: Get random date within time range
   */
  private static getRandomDate(timeRange: string): string {
    const now = new Date();
    const ranges = {
      today: 24,
      week: 7 * 24,
      month: 30 * 24
    };

    const hoursAgo = Math.random() * ranges[timeRange as keyof typeof ranges];
    const date = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
    return date.toISOString();
  }

  /**
   * Helper: Calculate sentiment score
   */
  private static getSentimentScore(sentiment: 'positive' | 'neutral' | 'negative'): number {
    const scores = {
      positive: 0.7 + Math.random() * 0.3,
      neutral: 0.4 + Math.random() * 0.2,
      negative: 0 + Math.random() * 0.3
    };
    return scores[sentiment];
  }

  /**
   * Generate messages for a conversation
   * @param conversationId - Conversation ID
   * @param count - Number of messages to generate
   * @returns Array of DM messages
   */
  static generateMessagesForConversation(
    conversationId: string,
    count: number
  ): any[] {
    const messages = [];
    const now = new Date();

    for (let i = 0; i < count; i++) {
      const isFromBusiness = i % 2 === 0;
      const hoursAgo = count - i;

      messages.push({
        id: `message_${conversationId}_${i + 1}`,
        conversation_id: conversationId,
        instagram_message_id: `ig_msg_${Date.now()}_${i}`,
        message_text: isFromBusiness
          ? "Hi! Thanks for reaching out. How can I help you today?"
          : "I'd like to know more about the summer dress from your latest post.",
        from_instagram_id: isFromBusiness ? 'demo_account_123' : 'user_301',
        from_username: isFromBusiness ? 'modern_boutique' : 'jennifer_r',
        is_from_business: isFromBusiness,
        sent_by_agent_id: isFromBusiness ? 'agent_123' : null,
        agent_name: isFromBusiness ? 'Support Agent' : null,
        is_automated: false,
        delivery_status: 'read',
        sent_at: new Date(now.getTime() - hoursAgo * 60 * 60 * 1000).toISOString(),
        delivered_at: new Date(now.getTime() - hoursAgo * 60 * 60 * 1000 + 5000).toISOString(),
        read_at: new Date(now.getTime() - hoursAgo * 60 * 60 * 1000 + 30000).toISOString(),
        attachments: []
      });
    }

    return messages;
  }

  /**
   * Refresh all demo data
   * Useful for screencast retakes
   */
  static refreshAllDemoData(): GeneratedDemoData {
    return this.generateDemoData({
      realistic: true,
      volume: 'medium',
      includeEdgeCases: true,
      timeRange: 'week'
    });
  }

  /**
   * Generate demo UGC data for testing
   * Returns realistic visitor posts with varied characteristics
   * Demonstrates pages_read_user_content permission
   */
  static generateUGCDemoData(): { data: VisitorPost[]; stats: UGCStats } {
    const now = new Date();

    const demoAuthors = [
      { name: 'Sarah Johnson', username: 'sarah_j_2025', avatar: 'https://i.pravatar.cc/150?img=1' },
      { name: 'Mike Chen', username: 'mike_tech', avatar: 'https://i.pravatar.cc/150?img=2' },
      { name: 'Emma Davis', username: 'emma_lifestyle', avatar: 'https://i.pravatar.cc/150?img=3' },
      { name: 'Carlos Rodriguez', username: 'carlos_fit', avatar: 'https://i.pravatar.cc/150?img=4' },
      { name: 'Aisha Patel', username: 'aisha_creates', avatar: 'https://i.pravatar.cc/150?img=5' },
      { name: 'Tom Anderson', username: 'tom_a_style', avatar: 'https://i.pravatar.cc/150?img=6' },
    ];

    const demoMessages = [
      { text: 'Absolutely love this brand! Best purchase ever 😍', sentiment: 'positive' as const },
      { text: 'Just received my order. Quality is amazing!', sentiment: 'positive' as const },
      { text: 'Has anyone tried their new product line?', sentiment: 'neutral' as const },
      { text: 'Great customer service, highly recommend!', sentiment: 'positive' as const },
      { text: 'Product arrived damaged, waiting for response...', sentiment: 'negative' as const },
      { text: 'Loving the new collection! #brandlove', sentiment: 'positive' as const },
    ];

    const visitorPosts: VisitorPost[] = demoMessages.map((msg, i) => {
      const author = demoAuthors[i % demoAuthors.length];
      const hoursAgo = Math.floor(Math.random() * 72) + 1;
      const createdTime = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);

      return {
        id: `demo-ugc-${i + 1}`,
        business_account_id: 'demo-account',
        visitor_post_id: `visitor_post_${i + 1}`,
        message: msg.text,
        author_id: `author_${i + 1}`,
        author_name: author.name,
        author_username: author.username,
        author_profile_picture_url: author.avatar,
        created_time: createdTime.toISOString(),
        permalink_url: `https://www.instagram.com/p/demo${i + 1}/`,
        media_type: i % 3 === 0 ? 'IMAGE' : i % 3 === 1 ? 'VIDEO' : 'TEXT',
        media_url: i % 3 === 0 ? `https://picsum.photos/600/600?random=${i}` : null,
        thumbnail_url: i % 3 === 0 ? `https://picsum.photos/300/300?random=${i}` : null,
        media_count: 1,
        like_count: Math.floor(Math.random() * 100) + 10,
        comment_count: Math.floor(Math.random() * 30) + 1,
        share_count: Math.floor(Math.random() * 20),
        sentiment: msg.sentiment,
        sentiment_score: msg.sentiment === 'positive' ? 0.8 : msg.sentiment === 'negative' ? -0.6 : 0.1,
        priority: msg.sentiment === 'positive' ? 'high' : msg.sentiment === 'negative' ? 'urgent' : 'medium',
        tags: ['testimonial', 'customer_content'],
        featured: i < 2,
        featured_at: i < 2 ? createdTime.toISOString() : null,
        repost_permission_requested: i === 0,
        repost_permission_granted: false,
        reposted: false,
        reposted_at: null,
        internal_notes: null,
        campaign_tag: null,
        fetched_at: now.toISOString(),
        updated_at: now.toISOString(),
      };
    });

    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const stats: UGCStats = {
      totalPosts: visitorPosts.length,
      postsThisWeek: visitorPosts.filter(p => {
        return new Date(p.created_time) > weekAgo;
      }).length,
      postsThisMonth: visitorPosts.filter(p => {
        return new Date(p.created_time) > monthAgo;
      }).length,
      sentimentBreakdown: {
        positive: visitorPosts.filter(p => p.sentiment === 'positive').length,
        neutral: visitorPosts.filter(p => p.sentiment === 'neutral').length,
        negative: visitorPosts.filter(p => p.sentiment === 'negative').length,
      },
      featuredCount: visitorPosts.filter(p => p.featured).length,
      permissionsPending: 1,
      permissionsGranted: 0,
      topTags: [
        { tag: 'testimonial', count: 6 },
        { tag: 'customer_content', count: 6 },
      ],
      engagementTotal: {
        likes: visitorPosts.reduce((sum, p) => sum + (p.like_count || 0), 0),
        comments: visitorPosts.reduce((sum, p) => sum + (p.comment_count || 0), 0),
        shares: visitorPosts.reduce((sum, p) => sum + (p.share_count || 0), 0),
      },
    };

    return { data: visitorPosts, stats };
  }
}

export default PermissionDemoService;
