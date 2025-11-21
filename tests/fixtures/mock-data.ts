/**
 * Mock Data Fixtures for Playwright Tests
 *
 * Provides realistic mock data for testing dashboard features
 */

export const mockInstagramProfile = {
  id: '17841400123456789',
  username: 'test_instagram_account',
  name: 'Test Instagram Account',
  profile_picture_url: 'https://example.com/profile.jpg',
  followers_count: 12500,
  follows_count: 450,
  media_count: 234,
  biography: 'Test Instagram Business Account for Automation',
  website: 'https://example.com'
};

export const mockMetrics = {
  followers: 12500,
  following: 450,
  posts: 234,
  engagement_rate: 4.5,
  avg_likes: 567,
  avg_comments: 45,
  reach: 45000,
  impressions: 67000
};

export const mockActivityFeed = [
  {
    id: '1',
    type: 'comment',
    username: 'user1',
    text: 'Great post!',
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 minutes ago
    post_id: 'post123'
  },
  {
    id: '2',
    type: 'like',
    username: 'user2',
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 minutes ago
    post_id: 'post456'
  },
  {
    id: '3',
    type: 'message',
    username: 'user3',
    text: 'Hello! I have a question about your product.',
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
  },
  {
    id: '4',
    type: 'mention',
    username: 'user4',
    text: 'Check out @test_instagram_account',
    timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour ago
    post_id: 'post789'
  }
];

export const mockRecentMedia = [
  {
    id: 'post1',
    media_type: 'IMAGE',
    media_url: 'https://picsum.photos/400/400?random=1',
    caption: 'Beautiful sunset at the beach! #nature #photography',
    like_count: 1234,
    comments_count: 56,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    permalink: 'https://instagram.com/p/post1'
  },
  {
    id: 'post2',
    media_type: 'VIDEO',
    media_url: 'https://picsum.photos/400/400?random=2',
    thumbnail_url: 'https://picsum.photos/400/400?random=2',
    caption: 'New product launch! 🚀',
    like_count: 2345,
    comments_count: 123,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
    permalink: 'https://instagram.com/p/post2'
  },
  {
    id: 'post3',
    media_type: 'CAROUSEL_ALBUM',
    media_url: 'https://picsum.photos/400/400?random=3',
    caption: 'Swipe to see more!',
    like_count: 890,
    comments_count: 34,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(), // 3 days ago
    permalink: 'https://instagram.com/p/post3'
  }
];

export const mockPerformanceData = [
  { date: '2025-01-14', reach: 3500, impressions: 5200, engagement: 4.2 },
  { date: '2025-01-15', reach: 4200, impressions: 6100, engagement: 4.5 },
  { date: '2025-01-16', reach: 3800, impressions: 5800, engagement: 4.1 },
  { date: '2025-01-17', reach: 5100, impressions: 7300, engagement: 4.8 },
  { date: '2025-01-18', reach: 4700, impressions: 6900, engagement: 4.6 },
  { date: '2025-01-19', reach: 5500, impressions: 8100, engagement: 5.0 },
  { date: '2025-01-20', reach: 6200, impressions: 9200, engagement: 5.2 }
];

export const mockComments = [
  {
    id: 'comment1',
    username: 'follower1',
    text: 'Amazing content! Keep it up!',
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    post_id: 'post1'
  },
  {
    id: 'comment2',
    username: 'follower2',
    text: 'Where can I buy this?',
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    post_id: 'post1'
  },
  {
    id: 'comment3',
    username: 'follower3',
    text: '❤️❤️❤️',
    timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    post_id: 'post2'
  }
];

export const mockDirectMessages = [
  {
    id: 'dm1',
    sender_id: 'user123',
    sender_username: 'customer1',
    text: 'Hi! I have a question about your product.',
    timestamp: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    read: false
  },
  {
    id: 'dm2',
    sender_id: 'user456',
    sender_username: 'customer2',
    text: 'Thanks for the quick response!',
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    read: true
  }
];

/**
 * Mock API responses for intercepting network requests
 */
export const mockAPIResponses = {
  '/api/instagram/profile': {
    success: true,
    data: mockInstagramProfile
  },
  '/api/instagram/metrics': {
    success: true,
    data: mockMetrics
  },
  '/api/instagram/activity': {
    success: true,
    data: mockActivityFeed
  },
  '/api/instagram/media': {
    success: true,
    data: mockRecentMedia
  },
  '/api/instagram/performance': {
    success: true,
    data: mockPerformanceData
  },
  '/api/instagram/comments': {
    success: true,
    data: mockComments
  },
  '/api/instagram/messages': {
    success: true,
    data: mockDirectMessages
  }
};
