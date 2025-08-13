import React from 'react';
import { motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { Home, Calendar, MessageCircle, BarChart3, Users, Settings } from 'lucide-react';

const navigationItems = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Content', href: '/content', icon: Calendar },
  { name: 'Engagement', href: '/engagement', icon: MessageCircle },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'UGC', href: '/ugc', icon: Users },
  { name: 'Settings', href: '/settings', icon: Settings },
];

const AnimatedNavigation: React.FC = () => {
  const location = useLocation();

  return (
    <nav className="hidden md:flex items-center space-x-1">
      {navigationItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.href;
        
        return (
          <motion.div
            key={item.name}
            className="relative"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link
              to={item.href}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 relative overflow-hidden ${
                isActive
                  ? 'text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              {/* Background animation */}
              {isActive && (
                <motion.div
                  className="absolute inset-0 bg-white/20 rounded-lg"
                  layoutId="activeBackground"
                  initial={false}
                  transition={{
                    type: 'spring',
                    stiffness: 500,
                    damping: 30
                  }}
                />
              )}
              
              {/* Icon with animation */}
              <motion.div
                animate={isActive ? { scale: 1.1 } : { scale: 1 }}
                transition={{ duration: 0.2 }}
              >
                <Icon className="w-4 h-4 relative z-10" />
              </motion.div>
              
              {/* Text */}
              <span className="font-medium relative z-10">{item.name}</span>
              
              {/* Hover effect */}
              <motion.div
                className="absolute inset-0 bg-white/10 rounded-lg opacity-0"
                whileHover={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              />
            </Link>
          </motion.div>
        );
      })}
    </nav>
  );
};

export default AnimatedNavigation;