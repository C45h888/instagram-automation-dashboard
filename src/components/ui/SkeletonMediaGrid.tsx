import React from 'react';

interface SkeletonMediaGridProps {
  count?: number;
}

export const SkeletonMediaGrid: React.FC<SkeletonMediaGridProps> = ({ count = 8 }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="glass-morphism-card rounded-2xl overflow-hidden border border-gray-700/50 animate-pulse"
        >
          {/* Image skeleton */}
          <div className="w-full h-48 bg-gray-700/50" />

          {/* Content skeleton */}
          <div className="p-4 space-y-2">
            <div className="h-4 bg-gray-700/50 rounded w-3/4" />
            <div className="h-4 bg-gray-700/50 rounded w-1/2" />
            <div className="h-3 bg-gray-700/50 rounded w-1/4 mt-2" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default SkeletonMediaGrid;