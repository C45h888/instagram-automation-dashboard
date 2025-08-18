// src/pages/Engagement.tsx - Full Featured Engagement Hub
import React, { useState, useEffect } from 'react';
import { 
  MessageCircle, Heart, Send, TrendingUp, AlertCircle, 
  Clock, Filter, Search, RefreshCw, ChevronRight, User,
  ThumbsUp, ThumbsDown, Zap, Shield, Bot, Eye, Reply
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../hooks/useToast';

// Type definitions
interface Comment {
  id: string;
  username: string;
  avatar: string;
  message: string;
  timestamp: string;
  postId: string;
  postTitle: string;
  postImage?: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  replied: boolean;
  priority: 'high' | 'medium' | 'low';
  likes?: number;
  verified?: boolean;
}

interface DM {
  id: string;
  username: string;
  avatar: string;
  lastMessage: string;
  timestamp: string;
  unread: boolean;
  category: 'inquiry' | 'support' | 'feedback' | 'collab' | 'other';
  status: 'pending' | 'responded' | 'resolved';
  messageCount?: number;
  verified?: boolean;
}

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

const Engagement: React.FC = () => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'comments' | 'dms' | 'automations' | 'templates'>('comments');
  const [selectedSentiment, setSelectedSentiment] = useState<'all' | 'positive' | 'neutral' | 'negative'>('all');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'inquiry' | 'support' | 'feedback' | 'collab'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedComment, setSelectedComment] = useState<Comment | null>(null);
  const [selectedDM, setSelectedDM] = useState<DM | null>(null);
  const [replyText, setReplyText] = useState('');
  const [showAISuggestions, setShowAISuggestions] = useState(false);

  // Mock data - replace with real API calls
  const comments: Comment[] = [
    {
      id: '1',
      username: 'sarah_johnson',
      avatar: '👩',
      message: 'Love this product! When will it be back in stock? I've been waiting for weeks!',
      timestamp: '2 minutes ago',
      postId: 'post_1',
      postTitle: 'Summer Collection Launch',
      postImage: '🖼️',
      sentiment: 'positive',
      replied: false,
      priority: 'high',
      likes: 24,
      verified: true
    },
    {
      id: '2',
      username: 'mike_smith',
      avatar: '👨',
      message: 'The quality seems off compared to previous batches. Not happy with my purchase.',
      timestamp: '15 minutes ago',
      postId: 'post_2',
      postTitle: 'New Product Release',
      sentiment: 'negative',
      replied: false,
      priority: 'high',
      likes: 3
    },
    {
      id: '3',
      username: 'emma_davis',
      avatar: '👱‍♀️',
      message: 'Can you ship to Canada? What are the shipping costs?',
      timestamp: '1 hour ago',
      postId: 'post_1',
      postTitle: 'Summer Collection Launch',
      sentiment: 'neutral',
      replied: true,
      priority: 'medium',
      likes: 5
    },
    {
      id: '4',
      username: 'alex_chen',
      avatar: '🧑',
      message: 'Amazing quality! Already ordered 3 more! Best purchase ever! 🔥🔥🔥',
      timestamp: '2 hours ago',
      postId: 'post_3',
      postTitle: 'Customer Testimonials',
      sentiment: 'positive',
      replied: true,
      priority: 'low',
      likes: 156,
      verified: true
    }
  ];

  const dms: DM[] = [
    {
      id: '1',
      username: 'influencer_jane',
      avatar: '💫',
      lastMessage: 'Hey! I'd love to collaborate on your next campaign. I have 50K engaged followers...',
      timestamp: '5 minutes ago',
      unread: true,
      category: 'collab',
      status: 'pending',
      messageCount: 3,
      verified: true
    },
    {
      id: '2',
      username: 'customer_support_1',
      avatar: '💬',
      lastMessage: 'Hi, I need help with my order #12345. It hasn't arrived yet.',
      timestamp: '30 minutes ago',
      unread: true,
      category: 'support',
      status: 'pending',
      messageCount: 1
    },
    {
      id: '3',
      username: 'potential_buyer',
      avatar: '🛍️',
      lastMessage: 'Do you have size charts available? I'm interested in the blue dress.',
      timestamp: '1 hour ago',
      unread: true,
      category: 'inquiry',
      status: 'pending',
      messageCount: 2
    },
    {
      id: '4',
      username: 'happy_customer',
      avatar: '😊',
      lastMessage: 'Just wanted to say thanks for the great service! Will buy again!',
      timestamp: '2 hours ago',
      unread: false,
      category: 'feedback',
      status: 'responded',
      messageCount: 4
    }
  ];

  const metrics: EngagementMetric[] = [
    { label: 'Response Rate', value: '89%', change: 5, icon: <MessageCircle className="w-5 h-5" />, color: 'from-blue-500 to-cyan-500' },
    { label: 'Avg Response Time', value: '12m', change: -15, icon: <Clock className="w-5 h-5" />, color: 'from-green-500 to-emerald-500' },
    { label: 'Engagement Rate', value: '4.2%', change: 12, icon: <Heart className="w-5 h-5" />, color: 'from-pink-500 to-rose-500' },
    { label: 'Sentiment Score', value: '78', change: 3, icon: <TrendingUp className="w-5 h-5" />, color: 'from-purple-500 to-indigo-500' }
  ];

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

  const responseTemplates = [
    { id: '1', name: 'Thank You', text: 'Thank you so much for your support! We truly appreciate it! 💕' },
    { id: '2', name: 'Shipping Info', text: 'We ship worldwide! Standard shipping takes 5-7 business days. Express options available at checkout.' },
    { id: '3', name: 'Size Guide', text: 'You can find our detailed size guide at [link]. Need help choosing? DM us your measurements!' },
    { id: '4', name: 'Apology', text: "We're sorry to hear about your experience. Please DM us your order number so we can make this right." },
    { id: '5', name: 'Collaboration', text: 'Thanks for your interest! Please email our partnerships team at collab@brand.com with your media kit.' }
  ];

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Engagement data refreshed', { title: 'Success' });
    } catch (error) {
      toast.error('Failed to refresh data', { title: 'Error' });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleReply = (comment: Comment) => {
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

  const sendReply = async () => {
    try {
      console.log('Sending reply:', replyText, 'to comment:', selectedComment?.id);
      toast.success('Reply sent successfully', { title: 'Success' });
      setSelectedComment(null);
      setReplyText('');
      setShowAISuggestions(false);
    } catch (error) {
      toast.error('Failed to send reply', { title: 'Error' });
    }
  };

  const toggleAutomation = (ruleId: string) => {
    console.log('Toggling automation:', ruleId);
    toast.info('Automation rule updated', { title: 'Settings' });
  };

  const applyTemplate = (template: string) => {
    setReplyText(template);
    toast.info('Template applied', { title: 'Template' });
  };

  const filteredComments = comments.filter(comment => {
    const matchesSentiment = selectedSentiment === 'all' || comment.sentiment === selectedSentiment;
    const matchesSearch = comment.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          comment.username.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSentiment && matchesSearch;
  });

  const filteredDMs = dms.filter(dm => {
    const matchesCategory = selectedCategory === 'all' || dm.category === selectedCategory;
    const matchesSearch = dm.lastMessage.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          dm.username.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Engagement Hub</h1>
          <p className="text-gray-300 text-lg">Monitor and respond to your Instagram engagement in real-time</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleRefresh}
          className={`px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-all flex items-center gap-2 ${
            isRefreshing ? 'animate-spin' : ''
          }`}
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </motion.button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric, index) => (
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
              <span className={`text-sm ${metric.change > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {metric.change > 0 ? '+' : ''}{metric.change}%
              </span>
            </div>
            <div className="text-2xl font-bold text-white mb-1">{metric.value}</div>
            <div className="text-sm text-gray-400">{metric.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-700 pb-4 overflow-x-auto">
        {[
          { id: 'comments', label: 'Comments', count: comments.filter(c => !c.replied).length },
          { id: 'dms', label: 'Direct Messages', count: dms.filter(d => d.unread).length },
          { id: 'automations', label: 'Automations', count: automationRules.filter(r => r.enabled).length },
          { id: 'templates', label: 'Templates', count: responseTemplates.length }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
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
              <div className="flex gap-2">
                {(['all', 'positive', 'neutral', 'negative'] as const).map(sentiment => (
                  <button
                    key={sentiment}
                    onClick={() => setSelectedSentiment(sentiment)}
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
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search comments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-yellow-500/50 outline-none"
                />
              </div>
            </div>

            {/* Comments List */}
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
                      <div className="text-3xl">{comment.avatar}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-semibold text-white flex items-center gap-1">
                            @{comment.username}
                            {comment.verified && <Shield className="w-4 h-4 text-blue-400" />}
                          </span>
                          <span className="text-gray-400 text-sm">{comment.timestamp}</span>
                          {!comment.replied && (
                            <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
                              Needs Reply
                            </span>
                          )}
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            comment.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                            comment.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-gray-700 text-gray-400'
                          }`}>
                            {comment.priority} priority
                          </span>
                        </div>
                        <p className="text-gray-300 mb-3">{comment.message}</p>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-gray-500">
                            on <span className="text-gray-400">{comment.postTitle}</span>
                          </span>
                          {comment.likes && (
                            <span className="flex items-center gap-1 text-gray-400">
                              <ThumbsUp className="w-3 h-3" />
                              {comment.likes}
                            </span>
                          )}
                        </div>
                      </div>
                      {comment.postImage && (
                        <div className="text-4xl opacity-50">{comment.postImage}</div>
                      )}
                    </div>
                    {!comment.replied && (
                      <button
                        onClick={() => handleReply(comment)}
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

            {/* DMs List */}
            <div className="space-y-4">
              {filteredDMs.map(dm => (
                <motion.div
                  key={dm.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.01 }}
                  className={`bg-gray-800/50 backdrop-blur-sm border rounded-xl p-6 transition-all hover:bg-gray-800/70 cursor-pointer ${
                    dm.unread ? 'border-yellow-500/30' : 'border-gray-700'
                  }`}
                  onClick={() => setSelectedDM(dm)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="text-3xl">{dm.avatar}</div>
                        {dm.unread && (
                          <span className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full"></span>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-semibold text-white flex items-center gap-1">
                            @{dm.username}
                            {dm.verified && <Shield className="w-4 h-4 text-blue-400" />}
                          </span>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            dm.category === 'support' ? 'bg-red-500/20 text-red-400' :
                            dm.category === 'inquiry' ? 'bg-blue-500/20 text-blue-400' :
                            dm.category === 'feedback' ? 'bg-green-500/20 text-green-400' :
                            dm.category === 'collab' ? 'bg-purple-500/20 text-purple-400' :
                            'bg-gray-700 text-gray-400'
                          }`}>
                            {dm.category}
                          </span>
                          {dm.messageCount && dm.messageCount > 1 && (
                            <span className="text-gray-500 text-sm">
                              {dm.messageCount} messages
                            </span>
                          )}
                        </div>
                        <p className="text-gray-300 line-clamp-1">{dm.lastMessage}</p>
                        <span className="text-gray-500 text-sm">{dm.timestamp}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
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