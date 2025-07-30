import React from 'react';
import Skeleton from './Skeleton';

interface FormSkeletonProps {
  fieldCount?: number;
  className?: string;
}

const FormSkeleton: React.FC<FormSkeletonProps> = ({
  fieldCount = 4,
  className = ''
}) => {
  return (
    <div className={`glass-morphism-card p-6 rounded-2xl space-y-6 ${className}`}>
      <Skeleton variant="title" width={200} />
      
      {Array.from({ length: fieldCount }).map((_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton width={100} height={16} />
          <Skeleton width="100%" height={40} className="rounded-lg" />
        </div>
      ))}
      
      <div className="flex space-x-4 pt-4">
        <Skeleton variant="button" width={100} />
        <Skeleton variant="button" width={80} />
      </div>
    </div>
  );
};

export default FormSkeleton;