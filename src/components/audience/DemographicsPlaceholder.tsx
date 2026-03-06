/**
 * DemographicsPlaceholder.tsx
 *
 * Placeholder card for upcoming demographic features.
 * Uses glass-morphism styling matching the project aesthetic.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Lock, Users, Calendar, MapPin } from 'lucide-react';
import AnimatedCard from '../ui/AnimatedCard';

interface DemographicsPlaceholderProps {
  title: string;
  description?: string;
  icon?: 'gender' | 'age' | 'location' | 'activity';
  etaVersion?: string;
}

const iconMap = {
  gender: Users,
  age: Calendar,
  location: MapPin,
  activity: Users,
};

const DemographicsPlaceholder: React.FC<DemographicsPlaceholderProps> = ({
  title,
  description = 'Advanced analytics coming soon',
  icon = 'gender',
  etaVersion = 'v2.0',
}) => {
  const IconComponent = iconMap[icon];

  return (
    <AnimatedCard className="glass-morphism-card p-6" hoverEffect="lift">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <motion.div 
            className="p-2 rounded-lg bg-yellow-400/20 text-yellow-400"
            whileHover={{ scale: 1.1, rotate: 5 }}
          >
            <IconComponent className="w-5 h-5" />
          </motion.div>
          <span className="text-white font-medium">
            {title}
          </span>
        </div>
        <div className="p-1.5 rounded-full bg-white/10">
          <Lock className="w-4 h-4 text-gray-400" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-yellow-400/10 border border-yellow-400/30">
          <span className="text-yellow-400 text-xs font-medium">
            Coming Soon
          </span>
        </div>
        
        <p className="text-gray-400 text-sm leading-relaxed">
          {description}
        </p>
        
        <div className="pt-3 border-t border-white/10">
          <span className="text-gray-500 text-xs">
            ETA: <span className="text-blue-400">{etaVersion}</span>
          </span>
        </div>
      </div>

      {/* Visual placeholder bars */}
      <div className="mt-4 space-y-2">
        <div className="h-2 bg-white/10 rounded-full w-full"></div>
        <div className="h-2 bg-white/10 rounded-full w-3/4"></div>
        <div className="h-2 bg-white/10 rounded-full w-1/2"></div>
      </div>
    </AnimatedCard>
  );
};

export default DemographicsPlaceholder;
