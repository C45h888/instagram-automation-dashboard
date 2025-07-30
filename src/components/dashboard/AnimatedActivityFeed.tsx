import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, MessageSquare, Camera, Calendar, TrendingUp, Clock } from 'lucide-react';
import AnimatedCard from '../ui/AnimatedCard';
import type { ActivityItem } from '../../data/mockData';

interface AnimatedActivityFeedProps {
  activities: ActivityItem[];
  isLoading?: boolean;
  onActivityClick?: (activity: ActivityItem) => void;
}

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

const getStatusColor = (status: string) => {
  switch (status) {
    case 'success': return 'text-green-400 bg-green-400/10';
    case 'warning': return 'text-yellow-400 bg-yellow-400/10';
    case 'error': return 'text-red-400 bg-red-400/10';
    case 'info': return 'text-blue-400 bg-blue-400/10';
    default: return 'text-blue-400 bg-blue-400/10';
  }
};

const itemVariants = {
  hidden: { 
    opacity: 0, 
    x: -20, 
    scale: 0.95 
  },
  visible: { 
    opacity: 1, 
    x: 0, 
    scale: 1,
    transition: {
      duration: 0.3,
      ease: 'easeOut'
    }
  },
  exit: { 
    opacity: 0, 
    x: 20, 
    scale: 0.95,
    transition: {
      duration: 0.2
    }
  }
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
};

const AnimatedActivityFeed: React.FC<AnimatedActivityFeedProps> = ({ 
  activities, 
  isLoading = false,
  onActivityClick
}) => {
  if (isLoading) {
    return (
      <AnimatedCard className="p-6">
        <h2 className="text-xl font-bold text-white mb-6">Recent Activity</h2>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <motion.div
              key={index}
              className="flex items-start space-x-4 p-4 rounded-lg bg-white/5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <div className="w-8 h-8 bg-white/10 rounded-lg animate-pulse"></div>
              <div className="flex-1">
                <div className="w-48 h-4 bg-white/10 rounded mb-2 animate-pulse"></div>
                <div className="w-64 h-3 bg-white/10 rounded mb-2 animate-pulse"></div>
                <div className="w-20 h-3 bg-white/10 rounded animate-pulse"></div>
              </div>
            </motion.div>
          ))}
        </div>
      </AnimatedCard>
    );
  }

  return (
    <AnimatedCard className="p-6" hoverEffect="glow">
      <motion.h2 
        className="text-xl font-bold text-white mb-6"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        Recent Activity
      </motion.h2>
      
      <motion.div 
        className="space-y-4 max-h-96 overflow-y-auto scrollbar-hide"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <AnimatePresence mode="popLayout">
          {activities.map((activity, index) => (
            <motion.div
              key={activity.id}
              variants={itemVariants}
              layout
              className="flex items-start space-x-4 p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-all duration-200 cursor-pointer group"
              onClick={() => onActivityClick?.(activity)}
              whileHover={{ 
                scale: 1.02,
                x: 4
              }}
              whileTap={{ scale: 0.98 }}
            >
              <motion.div 
                className={`p-2 rounded-lg ${getStatusColor(activity.status)}`}
                whileHover={{ 
                  scale: 1.1,
                  rotate: 5
                }}
                transition={{ duration: 0.2 }}
              >
                {getActivityIcon(activity.type)}
              </motion.div>
              
              <div className="flex-1 min-w-0 space-y-2">
                <motion.h3 
                  className="text-white font-medium group-hover:text-purple-300 transition-colors"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.05 }}
                >
                  {activity.title}
                </motion.h3>
                
                <motion.p 
                  className="text-gray-400 text-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.05 + 0.1 }}
                >
                  {activity.description}
                </motion.p>
                
                <motion.div 
                  className="flex items-center text-gray-500 text-xs"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.05 + 0.2 }}
                >
                  <Clock className="w-3 h-3 mr-1" />
                  <span>{activity.timestamp}</span>
                </motion.div>
              </div>
              
              <motion.div
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: index * 0.05 + 0.3 }}
              >
                <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
              </motion.div>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </AnimatedCard>
  );
};

export default AnimatedActivityFeed;