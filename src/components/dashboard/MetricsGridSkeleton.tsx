// ====================================
// FILE: src/components/dashboard/MetricsGridSkeleton.tsx
// ====================================
import React from 'react';

// Create the SkeletonCard component directly in this file
const SkeletonCard: React.FC<{ 
  className?: string; 
  style?: React.CSSProperties 
}> = ({ className = '', style }) => {
  return (
    <div className={`glass-morphism-card p-6 rounded-xl ${className}`} style={style}>
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 bg-white/10 rounded-lg animate-pulse"></div>
        <div className="w-16 h-4 bg-white/10 rounded animate-pulse"></div>
      </div>
      <div className="w-20 h-8 bg-white/10 rounded mb-2 animate-pulse"></div>
      <div className="w-24 h-4 bg-white/10 rounded animate-pulse"></div>
    </div>
  );
};

const MetricsGridSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {Array.from({ length: 4 }).map((_, index) => (
        <SkeletonCard 
          key={index}
          className="animate-pulse"
          style={{ animationDelay: `${index * 100}ms` } as React.CSSProperties}
        />
      ))}
    </div>
  );
};

export default MetricsGridSkeleton;