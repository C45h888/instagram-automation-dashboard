import React from 'react';
import { CheckCircle, AlertCircle, MessageSquare, Camera, Calendar, TrendingUp, Clock } from 'lucide-react';
import type { ActivityItem } from '../../data/mockData';

interface ActivityFeedProps {
  activities: ActivityItem[];
  isLoading?: boolean;
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({ activities, isLoading = false }) => {
  const getActivityIcon = (type: ActivityItem['type']) => {
    const icons = {
      'post_published': Camera,
      'auto_reply': MessageSquare,
      'error': AlertCircle,
      'milestone': TrendingUp,
      'schedule': Calendar
    };
    const IconComponent = icons[type] || CheckCircle;
    return <IconComponent className="w-4 h-4" />;
  };

  const getStatusColor = (type: string) => {
    switch (type) {
      case 'success': return 'text-green-400 bg-green-400/10';
      case 'warning': return 'text-yellow-400 bg-yellow-400/10';
      case 'error': return 'text-red-400 bg-red-400/10';
      case 'info': return 'text-blue-400 bg-blue-400/10';
      default: return 'text-blue-400 bg-blue-400/10';
    }
  };

  if (isLoading) {
    return (
      <div className="glass-morphism-card p-6 rounded-2xl">
        <h2 className="text-xl font-bold text-white mb-6">Recent Activity</h2>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-start space-x-4 p-4 rounded-lg bg-white/5 animate-pulse">
              <div className="w-8 h-8 bg-white/10 rounded-lg"></div>
              <div className="flex-1">
                <div className="w-48 h-4 bg-white/10 rounded mb-2"></div>
                <div className="w-64 h-3 bg-white/10 rounded mb-2"></div>
                <div className="w-20 h-3 bg-white/10 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-morphism-card p-6 rounded-2xl">
      <h2 className="text-xl font-bold text-white mb-6">Recent Activity</h2>
      <div className="space-y-4 max-h-96 overflow-y-auto scrollbar-hide">
        {activities.map((activity, index) => (
          <div key={activity.id} className="flex items-start space-x-4 p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-all duration-200 hover:scale-[1.02]">
            <div className={`p-2 rounded-lg ${getStatusColor(activity.status)}`}>
              {getActivityIcon(activity.type)}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-medium">{activity.title}</h3>
              <p className="text-gray-400 text-sm mt-1">{activity.description}</p>
              <div className="flex items-center mt-2 text-gray-500 text-xs">
                <Clock className="w-3 h-3 mr-1" />
                <span>{activity.timestamp}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActivityFeed;