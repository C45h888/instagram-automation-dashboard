export interface MetricData {
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  icon: string;
  color: string;
}

export interface ActivityItem {
  id: string;
  type: 'post_published' | 'auto_reply' | 'error' | 'milestone' | 'schedule';
  title: string;
  description: string;
  timestamp: string;
  status: 'success' | 'error' | 'warning' | 'info';
}

export interface MediaItem {
  id: string;
  imageUrl: string;
  likes: number;
  comments: number;
  engagement: string;
  timestamp: string;
  type: 'post' | 'story' | 'reel';
}

export interface ChartDataPoint {
  date: string;
  followers: number;
  engagement: number;
  posts: number;
}

export const mockMetrics: MetricData[] = [
  {
    title: 'Total Followers',
    value: '24.5K',
    change: '+12.5%',
    trend: 'up',
    icon: 'users',
    color: 'text-blue-400'
  },
  {
    title: 'Engagement Rate',
    value: '4.2%',
    change: '-2.1%',
    trend: 'down',
    icon: 'heart',
    color: 'text-pink-400'
  },
  {
    title: 'Posts Today',
    value: '12',
    change: '0%',
    trend: 'neutral',
    icon: 'image',
    color: 'text-green-400'
  },
  {
    title: 'Revenue',
    value: '$3,240',
    change: '+18.7%',
    trend: 'up',
    icon: 'dollar-sign',
    color: 'text-yellow-400'
  }
];

export const mockActivities: ActivityItem[] = [
  {
    id: '1',
    type: 'post_published',
    title: 'Post Published Successfully',
    description: 'Summer Collection Launch reached 2.3K users',
    timestamp: '2 minutes ago',
    status: 'success'
  },
  {
    id: '2',
    type: 'auto_reply',
    title: 'Auto-Reply Sent',
    description: 'Responded to customer inquiry about sizing',
    timestamp: '5 minutes ago',
    status: 'success'
  },
  {
    id: '3',
    type: 'error',
    title: 'Story Upload Failed',
    description: 'Video format not supported, converted and retried',
    timestamp: '12 minutes ago',
    status: 'error'
  },
  {
    id: '4',
    type: 'milestone',
    title: 'Engagement Milestone',
    description: 'Reached 1000 likes on latest post',
    timestamp: '1 hour ago',
    status: 'success'
  },
  {
    id: '5',
    type: 'schedule',
    title: 'Content Scheduled',
    description: '3 posts scheduled for tomorrow morning',
    timestamp: '2 hours ago',
    status: 'info'
  }
];

export const mockRecentMedia: MediaItem[] = [
  {
    id: '1',
    imageUrl: 'https://images.pexels.com/photos/1036623/pexels-photo-1036623.jpeg?auto=compress&cs=tinysrgb&w=300',
    likes: 245,
    comments: 18,
    engagement: '4.2%',
    timestamp: '2 hours ago',
    type: 'post'
  },
  {
    id: '2',
    imageUrl: 'https://images.pexels.com/photos/1183266/pexels-photo-1183266.jpeg?auto=compress&cs=tinysrgb&w=300',
    likes: 189,
    comments: 12,
    engagement: '3.8%',
    timestamp: '4 hours ago',
    type: 'post'
  },
  {
    id: '3',
    imageUrl: 'https://images.pexels.com/photos/1040881/pexels-photo-1040881.jpeg?auto=compress&cs=tinysrgb&w=300',
    likes: 312,
    comments: 24,
    engagement: '5.1%',
    timestamp: '6 hours ago',
    type: 'reel'
  },
  {
    id: '4',
    imageUrl: 'https://images.pexels.com/photos/1043474/pexels-photo-1043474.jpeg?auto=compress&cs=tinysrgb&w=300',
    likes: 156,
    comments: 8,
    engagement: '3.2%',
    timestamp: '8 hours ago',
    type: 'post'
  },
  {
    id: '5',
    imageUrl: 'https://images.pexels.com/photos/1055691/pexels-photo-1055691.jpeg?auto=compress&cs=tinysrgb&w=300',
    likes: 278,
    comments: 19,
    engagement: '4.6%',
    timestamp: '10 hours ago',
    type: 'post'
  },
  {
    id: '6',
    imageUrl: 'https://images.pexels.com/photos/1065084/pexels-photo-1065084.jpeg?auto=compress&cs=tinysrgb&w=300',
    likes: 203,
    comments: 15,
    engagement: '3.9%',
    timestamp: '12 hours ago',
    type: 'story'
  }
];

export const mockChartData: ChartDataPoint[] = [
  { date: 'Jan 1', followers: 23800, engagement: 3.8, posts: 8 },
  { date: 'Jan 2', followers: 24000, engagement: 4.1, posts: 10 },
  { date: 'Jan 3', followers: 24100, engagement: 3.9, posts: 9 },
  { date: 'Jan 4', followers: 24200, engagement: 4.3, posts: 11 },
  { date: 'Jan 5', followers: 24350, engagement: 4.0, posts: 12 },
  { date: 'Jan 6', followers: 24400, engagement: 4.2, posts: 10 },
  { date: 'Jan 7', followers: 24500, engagement: 4.2, posts: 12 }
];