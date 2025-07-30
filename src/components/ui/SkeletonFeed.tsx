import React from 'react';
import Skeleton from './Skeleton';

interface SkeletonFeedProps {
  itemCount?: number;
  className?: string;
}

const SkeletonFeed: React.FC<SkeletonFeedProps> = ({ 
  itemCount = 5, 
  className = '' 
}) => {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: itemCount }).map((_, index) => (
        <div 
          key={index} 
          className="flex items-start space-x-4 p-4 rounded-lg bg-white/5"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <Skeleton variant="avatar" width={32} height={32} />
          <div className="flex-1 space-y-2">
            <Skeleton width="60%" height={16} />
            <Skeleton width="80%" height={14} />
            <Skeleton width="40%" height={12} />
          </div>
        </div>
      ))}
    </div>
  );
};

export default SkeletonFeed;