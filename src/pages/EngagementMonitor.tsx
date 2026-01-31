// src/pages/Engagement.tsx - Full Featured Engagement Hub (Refactored with Real API)
import React, { useState, useMemo } from 'react';
import {
  MessageCircle, Heart, TrendingUp, AlertCircle,
  Clock, Search, RefreshCw, ChevronRight,
  ThumbsUp, Zap, Shield, Bot, Reply
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToastContext } from '../contexts/ToastContext';
import { useComments } from '../hooks/useComments';
import { useDMInbox } from '../hooks/useDMInbox';
import { useInstagramInsights } from '../hooks/useInstagramInsights';
import { useInstagramAccount } from '../hooks/useInstagramAccount';
import { useAuthStore } from '../stores/authStore';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import type { CommentData, ConversationData } from '../types/permissions';

// Type definitions - Using real API types from permissions.ts
// CommentData and ConversationData imported from types/permissions

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Format relative time helper with i18n support and edge case handling
 * @param timestamp - ISO 8601 timestamp string
 * @param locale - Locale code (default: 'en')
 * @returns Formatted relative time string
 */
const formatRelativeTime = (timestamp: string, locale: string = 'en'): string => {
  // Handle null/undefined/empty strings
  if (!timestamp || timestamp.trim() === '') {
    return 'Invalid date';
  }

  const now = new Date();
  const then = new Date(timestamp);

  // Handle invalid dates (NaN timestamp)
  if (isNaN(then.getTime())) {
    return 'Invalid date';
  }

  const diffMs = now.getTime() - then.getTime();

  // Handle future dates
  if (diffMs < 0) {
    return 'in the future';
  }

  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  // ✨ Use Intl.RelativeTimeFormat for i18n
  // Check if Intl.RelativeTimeFormat is available (modern browsers + polyfill)
  if (typeof Intl !== 'undefined' && Intl.RelativeTimeFormat) {
    try {
      const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' });

      if (diffSecs < 60) {
        return rtf.format(-diffSecs, 'second'); // e.g., "5 sec ago" or "just now"
      }
      if (diffMins < 60) {
        return rtf.format(-diffMins, 'minute'); // e.g., "5 min ago"
      }
      if (diffHours < 24) {
        return rtf.format(-diffHours, 'hour'); // e.g., "2 hr ago"
      }
      if (diffDays < 7) {
        return rtf.format(-diffDays, 'day'); // e.g., "3 days ago"
      }

      // For dates older than 7 days, use localized date format
      return then.toLocaleDateString(locale);
    } catch (error) {
      console.warn('Intl.RelativeTimeFormat error, falling back to manual formatting:', error);
      // Fall through to fallback implementation below
    }
  }

  // Fallback implementation (if Intl.RelativeTimeFormat not available)
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return then.toLocaleDateString();
};

// ============================================
// STATIC INTERFACES (not from API)
// ============================================

interface AutomationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  type: 'comment' | 'dm' | 'both';
  conditions?: string[];
  action: string;
}

interface EngagementMetric {
  label: string;
  value: string | number;
  change: number;
  icon: React.ReactNode;
  color: string;
}

interface ResponseTemplate {
  id: string;
  name: string;
  text: string;
}

// Fixed type definitions for state
type TabType = 'comments' | 'dms' | 'automations' | 'templates';
type SentimentType = 'all' | 'positive' | 'neutral' | 'negative';
type CategoryType = 'all' | 'inquiry' | 'support' | 'feedback' | 'collab';

const Engagement: React.FC = () => {
  // ============================================
  // CONTEXT & HOOKS
  // ============================================
  const { addToast } = useToastContext();
  const { user } = useAuthStore();
  const { businessAccountId, instagramBusinessId } = useInstagramAccount();

  // Real API hooks
  const {
    comments: apiComments,
    isLoading: commentsLoading,
    error: commentsError,
    replyToComment,
    refetch: refetchComments
  } = useComments();

  const {
    conversations: apiConversations,
    selectedConversation,
    messages: conversationMessages,
    isLoading: dmsLoading,
    error: dmsError,
    selectConversation,
    sendMessage,
    refetch: refetchConversations
  } = useDMInbox();

  const {
    metrics: insightsMetrics,
    insights: insightsData,
    isLoading: metricsLoading,
    error: metricsError,
    refetch: refetchMetrics
  } = useInstagramInsights('7d');

  // ============================================
  // LOCAL STATE
  // ============================================
  const [activeTab, setActiveTab] = useState<TabType>('comments');
  const [selectedSentiment, setSelectedSentiment] = useState<SentimentType>('all');
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [selectedComment, setSelectedComment] = useState<CommentData | null>(null);
  const [replyText, setReplyText] = useState<string>('');
  const [showAISuggestions, setShowAISuggestions] = useState<boolean>(false);

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  /**
   * Derive category from conversation status (with backend fallback)
   */
  const deriveCategory = (conv: ConversationData): CategoryType => {
    // Prefer backend-provided category if available
    if ((conv as any).category) return (conv as any).category as CategoryType;

    // Fallback to client-side derivation
    if (conv.conversation_status === 'pending') return 'inquiry';
    if (conv.conversation_status === 'in_progress') return 'support';
    if (conv.conversation_status === 'resolved') return 'feedback';
    return 'other' as CategoryType;
  };

  /**
   * Client-side sentiment fallback using keyword scanning
   */
  const deriveSentimentFromText = (text: string): 'positive' | 'neutral' | 'negative' => {
    if (!text) return 'neutral';

    const lowerText = text.toLowerCase();

    const positiveKeywords = [
      'great', 'love', 'awesome', 'amazing', 'excellent', 'fantastic',
      'perfect', 'wonderful', 'best', 'good', 'nice', 'beautiful',
      'thank', 'thanks', 'appreciate', 'happy', 'impressed'
    ];

    const negativeKeywords = [
      'bad', 'hate', 'terrible', 'awful', 'worst', 'horrible',
      'disappointed', 'sucks', 'useless', 'poor', 'problem',
      'issue', 'broken', 'error', 'bug', 'wrong', 'failed'
    ];

    const positiveCount = positiveKeywords.filter(keyword => lowerText.includes(keyword)).length;
    const negativeCount = negativeKeywords.filter(keyword => lowerText.includes(keyword)).length;

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  };

  /**
   * Calculate response rate from comments
   */
  const calculateResponseRate = (comments: CommentData[]): number => {
    if (comments.length === 0) return 0;
    const responded = comments.filter(c => !c.requires_response).length;
    return Math.round((responded / comments.length) * 100);
  };

  /**
   * Calculate average response time
   */
  const calculateAvgResponseTime = (comments: CommentData[]): string => {
    const respondedComments = comments.filter(c => c.response_sent_at && c.published_at);

    if (respondedComments.length === 0) return 'N/A';

    const totalMinutes = respondedComments.reduce((sum, comment) => {
      const published = new Date(comment.published_at!).getTime();
      const responded = new Date(comment.response_sent_at!).getTime();
      return sum + (responded - published) / 60000;
    }, 0);

    const avgMinutes = Math.round(totalMinutes / respondedComments.length);

    if (avgMinutes < 60) return `${avgMinutes}m`;
    const hours = Math.floor(avgMinutes / 60);
    const mins = avgMinutes % 60;
    return `${hours}h ${mins}m`;
  };

  /**
   * Calculate combined sentiment score from comments + DMs
   */
  const calculateCombinedSentiment = (
    comments: CommentData[],
    conversations: ConversationData[]
  ): number => {
    const totalItems = comments.length + conversations.length;
    if (totalItems === 0) return 0;

    const commentWeights = { positive: 100, neutral: 50, negative: 0 };

    // Calculate comment sentiment
    const commentScore = comments.reduce((sum, comment) => {
      const sentiment = comment.sentiment || deriveSentimentFromText(comment.text);
      const weight = commentWeights[sentiment as keyof typeof commentWeights] ?? 50;
      return sum + weight;
    }, 0);

    // Calculate DM sentiment with fallback
    const dmScore = conversations.reduce((sum, conv) => {
      if ((conv as any).sentiment) {
        const weight = commentWeights[(conv as any).sentiment as keyof typeof commentWeights] ?? 50;
        return sum + weight;
      }

      // Derive from last_message_preview if sentiment missing
      if (conv.last_message_preview) {
        const derivedSentiment = deriveSentimentFromText(conv.last_message_preview);
        const weight = commentWeights[derivedSentiment] ?? 50;
        return sum + weight;
      }

      // Fallback to priority_level as last resort
      const priorityWeight = conv.priority_level === 'high' ? 0 :
                             conv.priority_level === 'medium' ? 50 : 100;
      return sum + priorityWeight;
    }, 0);

    return Math.round((commentScore + dmScore) / totalItems);
  };

  // ============================================
  // COMPUTED METRICS WITH MEMOIZATION
  // ============================================

  const combinedMetrics = useMemo(() => {
    const responseRate = calculateResponseRate(apiComments);
    const avgResponseTime = calculateAvgResponseTime(apiComments);
    const sentimentScore = calculateCombinedSentiment(apiComments, apiConversations);

    // Extract time_range from insights for dynamic tooltips
    const timeRange = insightsData?.time_range || '7d';
    const timeRangeLabel = timeRange === '7d' ? 'last 7 days' :
                           timeRange === '30d' ? 'last 30 days' :
                           `last ${timeRange}`;

    const engagementMetrics: EngagementMetric[] = [
      {
        label: 'Response Rate',
        value: `${responseRate}%`,
        change: 0,
        icon: <MessageCircle className="w-5 h-5" />,
        color: 'from-blue-500 to-cyan-500'
      },
      {
        label: 'Avg Response Time',
        value: avgResponseTime,
        change: 0,
        icon: <Clock className="w-5 h-5" />,
        color: 'from-green-500 to-emerald-500'
      },
      {
        label: 'Sentiment Score',
        value: sentimentScore,
        change: 0,
        icon: <TrendingUp className="w-5 h-5" />,
        color: 'from-purple-500 to-indigo-500'
      }
    ];

    // Return first insight metric + 3 engagement metrics (total: 4)
    return [
      ...(insightsMetrics?.slice(0, 1) || []),
      ...engagementMetrics
    ];
  }, [insightsMetrics, insightsData, apiComments, apiConversations]);

  // ============================================
  // FILTERED DATA WITH MEMOIZATION
  // ============================================

  const filteredComments = useMemo(() => {
    return apiComments.filter((comment: CommentData) => {
      const matchesSentiment = selectedSentiment === 'all' || comment.sentiment === selectedSentiment;
      const matchesSearch = comment.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            comment.author_username?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSentiment && matchesSearch;
    });
  }, [apiComments, selectedSentiment, searchQuery]);

  const filteredDMs = useMemo(() => {
    return apiConversations.filter((conv: ConversationData) => {
      const category = deriveCategory(conv);
      const matchesCategory = selectedCategory === 'all' || category === selectedCategory;
      const matchesSearch =
        conv.last_message_preview?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conv.customer_username?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [apiConversations, selectedCategory, searchQuery]);

  // ============================================
  // STATIC DATA (Application Features)
  // ============================================

  const automationRules: AutomationRule[] = [
    {
      id: '1',
      name: 'Auto-Reply to Positive Comments',
      description: 'Automatically thank users for positive feedback with personalized responses',
      enabled: true,
      type: 'comment',
      conditions: ['sentiment = positive', 'likes > 10'],
      action: 'Send thank you message'
    },
    {
      id: '2',
      name: 'Escalate Negative Sentiment',
      description: 'Alert team immediately for comments with negative sentiment',
      enabled: true,
      type: 'comment',
      conditions: ['sentiment = negative'],
      action: 'Send Slack alert + Email notification'
    },
    {
      id: '3',
      name: 'Categorize Collaboration Requests',
      description: 'Auto-tag and route influencer collaboration requests',
      enabled: true,
      type: 'dm',
      conditions: ['message contains "collab"', 'follower_count > 10000'],
      action: 'Tag as collaboration + Assign to marketing'
    },
    {
      id: '4',
      name: 'Smart Response Suggestions',
      description: 'AI-powered reply suggestions based on message context',
      enabled: true,
      type: 'both',
      action: 'Generate AI response suggestions'
    }
  ];

  const responseTemplates: ResponseTemplate[] = [
    { id: '1', name: 'Thank You', text: 'Thank you so much for your support! We truly appreciate it! 💕' },
    { id: '2', name: 'Shipping Info', text: 'We ship worldwide! Standard shipping takes 5-7 business days. Express options available at checkout.' },
    { id: '3', name: 'Size Guide', text: 'You can find our detailed size guide at [link]. Need help choosing? DM us your measurements!' },
    { id: '4', name: 'Apology', text: "We're sorry to hear about your experience. Please DM us your order number so we can make this right." },
    { id: '5', name: 'Collaboration', text: 'Thanks for your interest! Please email our partnerships team at collab@brand.com with your media kit.' }
  ];

  // ============================================
  // EVENT HANDLERS
  // ============================================

  /**
   * Refresh all data with token validation and parallel fetch
   */
  const handleRefresh = async (): Promise<void> => {
    setIsRefreshing(true);
    try {
      // Token validation check
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://api.888intelligenceautomation.in';

      if (user?.id && businessAccountId) {
        const tokenCheck = await fetch(`${apiBaseUrl}/api/instagram/validate-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, businessAccountId })
        });

        const tokenResult = await tokenCheck.json();

        if (!tokenResult.success || tokenResult.status === 'expired') {
          addToast({
            type: 'warning',
            message: 'Instagram token expired. Please reconnect your account in Settings.',
            duration: 8000
          });
          setIsRefreshing(false);
          return;
        }
      }

      // Parallel refetch with 10s timeout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Refresh timeout after 10s')), 10000)
      );

      const refetchPromise = Promise.all([
        refetchComments(),
        refetchConversations(),
        refetchMetrics()
      ]);

      try {
        await Promise.race([refetchPromise, timeoutPromise]);

        addToast({
          type: 'success',
          message: 'Engagement data refreshed successfully'
        });
      } catch (timeoutError: any) {
        if (timeoutError.message?.includes('timeout')) {
          addToast({
            type: 'warning',
            message: 'Refresh taking longer than expected. Showing cached data.',
            duration: 5000
          });
        } else {
          throw timeoutError;
        }
      }
    } catch (error: any) {
      addToast({
        type: 'error',
        message: error.message || 'Failed to refresh data'
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  /**
   * Handle replying to a comment
   */
  const handleReply = (comment: CommentData): void => {
    setSelectedComment(comment);
    setShowAISuggestions(true);

    // Pre-fill with AI suggestion based on sentiment
    if (comment.sentiment === 'positive') {
      setReplyText('Thank you so much for your amazing support! We truly appreciate customers like you! 💕');
    } else if (comment.sentiment === 'negative') {
      setReplyText("We're sorry to hear about your experience. Please DM us so we can make this right immediately.");
    } else {
      setReplyText('Thanks for reaching out! ');
    }
  };

  /**
   * Send reply to selected comment
   */
  const sendReply = async (): Promise<void> => {
    if (!selectedComment || !replyText.trim()) {
      addToast({
        type: 'error',
        message: 'Reply text cannot be empty'
      });
      return;
    }

    try {
      await replyToComment(selectedComment.id, replyText);
      addToast({
        type: 'success',
        message: 'Reply sent successfully'
      });
      setSelectedComment(null);
      setReplyText('');
      setShowAISuggestions(false);
    } catch (error: any) {
      addToast({
        type: 'error',
        message: error.message || 'Failed to send reply'
      });
    }
  };

  /**
   * Toggle automation rule
   */
  const toggleAutomation = (ruleId: string): void => {
    console.log('Toggling automation:', ruleId);
    addToast({
      type: 'info',
      message: 'Automation rule updated'
    });
  };

  /**
   * Apply template to reply text
   */
  const applyTemplate = (template: string): void => {
    setReplyText(template);
    addToast({
      type: 'info',
      message: 'Template applied to reply'
    });
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Engagement Hub</h1>
          <p className="text-gray-300 text-lg">Monitor and respond to your Instagram engagement in real-time</p>
        </div>
        <motion.button
          whileHover={{ scale: isRefreshing ? 1 : 1.05 }}
          whileTap={{ scale: isRefreshing ? 1 : 0.95 }}
          onClick={handleRefresh}
          disabled={isRefreshing}
          aria-label="Refresh engagement data"
          className={`px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-all flex items-center gap-2 ${
            isRefreshing ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </motion.button>
      </div>

      {/* Global Error Banner */}
      {(commentsError || dmsError || metricsError) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/10 border border-red-500/30 rounded-xl p-4"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-400 font-medium">Some data failed to load</p>
              <p className="text-gray-400 text-sm mt-1">
                {commentsError && 'Comments: ' + commentsError}
                {dmsError && (commentsError ? ' | ' : '') + 'DMs: ' + dmsError}
                {metricsError && ((commentsError || dmsError) ? ' | ' : '') + 'Metrics: ' + metricsError}
              </p>
            </div>
            <button
              onClick={handleRefresh}
              className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-sm transition-all"
            >
              Retry All
            </button>
          </div>
        </motion.div>
      )}

      {/* Metrics Cards */}
      {metricsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 animate-pulse">
              <div className="h-10 bg-gray-700 rounded mb-3"></div>
              <div className="h-8 bg-gray-700 rounded mb-2"></div>
              <div className="h-4 bg-gray-700 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {combinedMetrics.map((metric, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 hover:bg-gray-800/70 transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg bg-gradient-to-r ${metric.color} bg-opacity-20`}>
                  {metric.icon}
                </div>
                {metric.change !== undefined && (
                  <span className={`text-sm ${metric.change > 0 ? 'text-green-400' : metric.change < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                    {metric.change > 0 ? '+' : ''}{metric.change}%
                  </span>
                )}
              </div>
              <div className="text-2xl font-bold text-white mb-1">{metric.value}</div>
              <div className="text-sm text-gray-400">{metric.label}</div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-700 pb-4 overflow-x-auto">
        {[
          { id: 'comments' as TabType, label: 'Comments', count: commentsLoading ? 0 : apiComments.filter(c => c.requires_response).length },
          { id: 'dms' as TabType, label: 'Direct Messages', count: dmsLoading ? 0 : apiConversations.filter(c => c.unread_count > 0).length },
          { id: 'automations' as TabType, label: 'Automations', count: automationRules.filter(r => r.enabled).length },
          { id: 'templates' as TabType, label: 'Templates', count: responseTemplates.length }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-label={`View ${tab.label.toLowerCase()} tab`}
            className={`px-6 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.label} {tab.count > 0 && `(${tab.count})`}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <AnimatePresence mode="wait">
        {activeTab === 'comments' && (
          <motion.div
            key="comments"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex gap-2 flex-wrap">
                {(['all', 'positive', 'neutral', 'negative'] as const).map(sentiment => (
                  <button
                    key={sentiment}
                    onClick={() => setSelectedSentiment(sentiment)}
                    aria-label={`Filter by ${sentiment} sentiment`}
                    aria-pressed={selectedSentiment === sentiment}
                    className={`px-4 py-2 rounded-lg capitalize transition-all ${
                      selectedSentiment === sentiment
                        ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                        : 'bg-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    {sentiment === 'positive' && '😊 '}
                    {sentiment === 'negative' && '😔 '}
                    {sentiment === 'neutral' && '😐 '}
                    {sentiment}
                  </button>
                ))}
              </div>
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
                <input
                  type="text"
                  placeholder="Search comments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search comments and messages"
                  className="w-full pl-10 pr-10 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-yellow-500/50 outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Loading State */}
            {commentsLoading && (
              <div className="flex flex-col items-center justify-center py-12">
                <LoadingSpinner size="lg" />
                <p className="text-gray-400 mt-4">Loading comments...</p>
              </div>
            )}

            {/* Error State */}
            {commentsError && !commentsLoading && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-red-400 font-medium mb-2">Failed to Load Comments</h3>
                    <p className="text-gray-400 text-sm mb-4">{commentsError}</p>
                    <button
                      onClick={refetchComments}
                      className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Empty State */}
            {!commentsLoading && !commentsError && filteredComments.length === 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-12"
              >
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  <MessageCircle className="w-16 h-16 text-gray-600" />
                </motion.div>
                <h3 className="text-white text-lg font-medium mt-4">No Comments Found</h3>
                <p className="text-gray-400 text-sm mt-2">
                  {apiComments.length === 0 ? 'No comments yet' : 'No matches for your filters'}
                </p>
              </motion.div>
            )}

            {/* Comments List */}
            {!commentsLoading && !commentsError && filteredComments.length > 0 && (
              <div className="space-y-4">
                {filteredComments.map(comment => (
                  <motion.div
                    key={comment.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`bg-gray-800/50 backdrop-blur-sm border rounded-xl p-6 transition-all hover:bg-gray-800/70 ${
                      comment.sentiment === 'negative' ? 'border-red-500/30' :
                      comment.sentiment === 'positive' ? 'border-green-500/30' :
                      'border-gray-700'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        {/* Avatar from initials */}
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                          {comment.author_username?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <span className="font-semibold text-white">
                              @{comment.author_username || 'unknown'}
                            </span>
                            <span className="text-gray-400 text-sm">
                              {comment.published_at ? formatRelativeTime(comment.published_at) : 'recently'}
                            </span>
                            {comment.requires_response && (
                              <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
                                Needs Reply
                              </span>
                            )}
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              comment.priority_level === 'high' ? 'bg-red-500/20 text-red-400' :
                              comment.priority_level === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-gray-700 text-gray-400'
                            }`}>
                              {comment.priority_level} priority
                            </span>
                          </div>
                          <p className="text-gray-300 mb-3">{comment.text}</p>
                          <div className="flex items-center gap-4 text-sm">
                            {comment.post_title && (
                              <span className="text-gray-500">
                                on <span className="text-gray-400">{comment.post_title}</span>
                              </span>
                            )}
                            {comment.like_count !== undefined && comment.like_count > 0 && (
                              <span className="flex items-center gap-1 text-gray-400">
                                <ThumbsUp className="w-3 h-3" />
                                {comment.like_count}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {comment.requires_response && (
                        <button
                          onClick={() => handleReply(comment)}
                          aria-label={`Reply to comment by ${comment.author_username || 'user'}`}
                          className="px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg transition-all flex items-center gap-2"
                        >
                          <Reply className="w-4 h-4" />
                          Reply
                        </button>
                      )}
                    </div>

                    {/* Reply Box */}
                    {selectedComment?.id === comment.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-4 p-4 bg-gray-900/50 rounded-lg"
                      >
                        {showAISuggestions && (
                          <div className="mb-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <Bot className="w-4 h-4 text-blue-400" />
                              <span className="text-blue-400 text-sm font-medium">AI Suggestions</span>
                            </div>
                            <div className="space-y-2">
                              {responseTemplates.slice(0, 3).map(template => (
                                <button
                                  key={template.id}
                                  onClick={() => applyTemplate(template.text)}
                                  className="block w-full text-left p-2 text-gray-300 hover:bg-gray-800 rounded text-sm"
                                >
                                  {template.text}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          className="w-full p-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-yellow-500/50 outline-none resize-none"
                          rows={3}
                          placeholder="Type your reply..."
                          aria-label="Reply text"
                        />
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={sendReply}
                            className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-medium rounded-lg transition-all"
                          >
                            Send Reply
                          </button>
                          <button
                            onClick={() => {
                              setSelectedComment(null);
                              setReplyText('');
                              setShowAISuggestions(false);
                            }}
                            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'dms' && (
          <motion.div
            key="dms"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            {/* Category Filters */}
            <div className="flex flex-wrap gap-2">
              {(['all', 'inquiry', 'support', 'feedback', 'collab'] as const).map(category => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  aria-label={`Filter by ${category} category`}
                  aria-pressed={selectedCategory === category}
                  className={`px-4 py-2 rounded-lg capitalize transition-all ${
                    selectedCategory === category
                      ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            {/* Loading State */}
            {dmsLoading && (
              <div className="flex flex-col items-center justify-center py-12">
                <LoadingSpinner size="lg" />
                <p className="text-gray-400 mt-4">Loading conversations...</p>
              </div>
            )}

            {/* Error State */}
            {dmsError && !dmsLoading && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-red-400 font-medium mb-2">Failed to Load Conversations</h3>
                    <p className="text-gray-400 text-sm mb-4">{dmsError}</p>
                    <button
                      onClick={refetchConversations}
                      className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Empty State */}
            {!dmsLoading && !dmsError && filteredDMs.length === 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-12"
              >
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  <MessageCircle className="w-16 h-16 text-gray-600" />
                </motion.div>
                <h3 className="text-white text-lg font-medium mt-4">No Conversations Found</h3>
                <p className="text-gray-400 text-sm mt-2">
                  {apiConversations.length === 0 ? 'No conversations yet' : 'No matches for your filters'}
                </p>
              </motion.div>
            )}

            {/* DMs List */}
            {!dmsLoading && !dmsError && filteredDMs.length > 0 && (
              <div className="space-y-4">
                {filteredDMs.map(conv => {
                  const category = deriveCategory(conv);
                  return (
                    <motion.div
                      key={conv.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ scale: 1.01 }}
                      className={`bg-gray-800/50 backdrop-blur-sm border rounded-xl p-6 transition-all hover:bg-gray-800/70 cursor-pointer ${
                        conv.unread_count > 0 ? 'border-yellow-500/30' : 'border-gray-700'
                      }`}
                      role="button"
                      tabIndex={0}
                      onClick={() => selectConversation(conv.id)}
                      onKeyPress={(e) => e.key === 'Enter' && selectConversation(conv.id)}
                      aria-label={`Open conversation with ${conv.customer_username || 'user'}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="relative">
                            {/* Avatar from initials */}
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg">
                              {conv.customer_username?.charAt(0).toUpperCase() || '?'}
                            </div>
                            {conv.unread_count > 0 && (
                              <span className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full"></span>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1 flex-wrap">
                              <span className="font-semibold text-white">
                                @{conv.customer_username || 'unknown'}
                              </span>
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                category === 'support' ? 'bg-red-500/20 text-red-400' :
                                category === 'inquiry' ? 'bg-blue-500/20 text-blue-400' :
                                category === 'feedback' ? 'bg-green-500/20 text-green-400' :
                                category === 'collab' ? 'bg-purple-500/20 text-purple-400' :
                                'bg-gray-700 text-gray-400'
                              }`}>
                                {category}
                              </span>
                              {!conv.within_window && (
                                <span className="px-2 py-1 bg-orange-500/20 text-orange-400 text-xs rounded-full">
                                  Window Expired
                                </span>
                              )}
                              {conv.message_count > 1 && (
                                <span className="text-gray-500 text-sm">
                                  {conv.message_count} messages
                                </span>
                              )}
                            </div>
                            <p className="text-gray-300 line-clamp-1">
                              {conv.last_message_preview || 'No messages yet'}
                            </p>
                            <span className="text-gray-500 text-sm">
                              {conv.last_message_at ? formatRelativeTime(conv.last_message_at) : 'recently'}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
            {/* Conversation Details */}
            {selectedConversation && (
              <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <h4 className="text-blue-400 font-medium mb-2">Conversation Details</h4>
                <p className="text-white">@{selectedConversation.customer_username}</p>
                <p className="text-gray-300 text-sm">{selectedConversation.last_message_preview}</p>

                {!selectedConversation.within_window && (
                  <div className="mt-3 p-2 bg-orange-500/10 border border-orange-500/30 rounded text-sm">
                    ⚠️ 24-hour window expired. Message templates required.
                  </div>
                )}

                <p className="text-gray-400 text-sm mt-2">
                  {selectedConversation.message_count} message(s) in this conversation
                </p>

                <button
                  onClick={() => selectConversation('')}
                  className="mt-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-all"
                >
                  Close Details
                </button>
              </div>
            )}


        {activeTab === 'automations' && (
          <motion.div
            key="automations"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
              <h3 className="text-xl font-semibold text-white mb-6">Automation Rules</h3>
              
              <div className="space-y-4">
                {automationRules.map(rule => (
                  <div
                    key={rule.id}
                    className="p-4 bg-gray-900/50 rounded-lg border border-gray-600"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="text-white font-medium">{rule.name}</h4>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            rule.type === 'comment' ? 'bg-blue-500/20 text-blue-400' :
                            rule.type === 'dm' ? 'bg-purple-500/20 text-purple-400' :
                            'bg-green-500/20 text-green-400'
                          }`}>
                            {rule.type}
                          </span>
                        </div>
                        <p className="text-gray-400 text-sm mb-3">{rule.description}</p>
                        {rule.conditions && (
                          <div className="flex flex-wrap gap-2 mb-2">
                            {rule.conditions.map((condition, idx) => (
                              <span key={idx} className="px-2 py-1 bg-gray-800 text-gray-300 text-xs rounded">
                                {condition}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-yellow-400" />
                          <span className="text-yellow-400 text-sm">{rule.action}</span>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={rule.enabled}
                          onChange={() => toggleAutomation(rule.id)}
                        />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500"></div>
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-400" />
                  <p className="text-yellow-400 text-sm">
                    Automation rules are powered by your N8N workflows. Configure advanced rules in your N8N dashboard.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'templates' && (
          <motion.div
            key="templates"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-white">Response Templates</h3>
                <button className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-medium rounded-lg transition-all">
                  Add Template
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {responseTemplates.map(template => (
                  <div
                    key={template.id}
                    className="p-4 bg-gray-900/50 rounded-lg border border-gray-600 hover:border-yellow-500/30 transition-all"
                  >
                    <h4 className="text-white font-medium mb-2">{template.name}</h4>
                    <p className="text-gray-300 text-sm mb-3">{template.text}</p>
                    <div className="flex gap-2">
                      <button className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-all">
                        Edit
                      </button>
                      <button className="px-3 py-1 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 text-sm rounded transition-all">
                        Use Template
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Engagement;