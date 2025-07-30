import React from 'react';
import Skeleton from './Skeleton';

interface SkeletonCardProps {
  className?: string;
}

const SkeletonCard: React.FC<SkeletonCardProps> = ({ className = '' }) => {
  return (
    <div className={`glass-morphism-card p-6 rounded-xl ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <Skeleton variant="avatar" width={40} height={40} />
        <Skeleton width={60} height={16} />
      </div>
      <Skeleton variant="title" width={80} className="mb-2" />
      <Skeleton width={120} height={14} />
    </div>
  );
};

export default SkeletonCard;