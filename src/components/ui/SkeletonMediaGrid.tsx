import React from 'react';
import Skeleton from './Skeleton';

interface SkeletonMediaGridProps {
  itemCount?: number;
  className?: string;
}

const SkeletonMediaGrid: React.FC<SkeletonMediaGridProps> = ({ 
  itemCount = 6, 
  className = '' 
}) => {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 ${className}`}>
      {Array.from({ length: itemCount }).map((_, index) => (
        <div 
          key={index} 
          className="relative aspect-square rounded-lg overflow-hidden"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <Skeleton width="100%" height="100%" className="absolute inset-0" />
          <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 transition-opacity">
            <div className="absolute bottom-2 left-2 right-2 space-y-1">
              <Skeleton width="60%" height={12} />
              <Skeleton width="40%" height={10} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SkeletonMediaGrid;