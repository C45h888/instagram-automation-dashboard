import React from 'react';
import { CheckCircle, AlertCircle, MessageSquare, Camera } from 'lucide-react';

interface ActivityItem {
  type: 'success' | 'warning' | 'info' | 'error';
  title: string;
  description: string;
  timestamp: string;
  icon: React.ReactNode;
}

const ActivityFeed: React.FC = () => {
  const activities: ActivityItem[] = [
    {
      type: 'success',
      title: 'Post Published Successfully',
      description: 'Summer Collection Launch reached 2.3K users',
      timestamp: '2 minutes ago',
      icon: <Camera className="w-4 h-4" />
    },
    {
      type: 'info',
      title: 'Auto-Reply Sent',
      description: 'Responded to customer inquiry about sizing',
      timestamp: '5 minutes ago',
      icon: <MessageSquare className="w-4 h-4" />
    },
    {
      type: 'error',
      title: 'Story Upload Failed',
      description: 'Video format not supported, converted and retried',
      timestamp: '12 minutes ago',
      icon: <AlertCircle className="w-4 h-4" />
    },
    {
      type: 'success',
      title: 'Engagement Milestone',
      description: 'Reached 1000 likes on latest post',
      timestamp: '1 hour ago',
      icon: <CheckCircle className="w-4 h-4" />
    }
  ];

  const getStatusColor = (type: string) => {
    switch (type) {
      case 'success': return 'text-green-400 bg-green-400/10';
      case 'warning': return 'text-yellow-400 bg-yellow-400/10';
      case 'error': return 'text-red-400 bg-red-400/10';
      default: return 'text-blue-400 bg-blue-400/10';
    }
  };

  return (
    <div className="glass-morphism-card p-6 rounded-2xl">
      <h2 className="text-xl font-bold text-white mb-6">Recent Activity</h2>
      <div className="space-y-4">
        {activities.map((activity, index) => (
          <div key={index} className="flex items-start space-x-4 p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
            <div className={`p-2 rounded-lg ${getStatusColor(activity.type)}`}>
              {activity.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-medium">{activity.title}</h3>
              <p className="text-gray-400 text-sm mt-1">{activity.description}</p>
              <span className="text-gray-500 text-xs mt-2 block">{activity.timestamp}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActivityFeed;