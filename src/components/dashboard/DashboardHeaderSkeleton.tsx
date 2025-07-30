import React from 'react';
import Skeleton from '../ui/Skeleton';

const DashboardHeaderSkeleton: React.FC = () => {
  return (
    <div className="glass-morphism-card p-6 rounded-2xl mb-8">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
        {/* Welcome Section */}
        <div className="mb-6 lg:mb-0">
          <Skeleton variant="title" width={300} className="mb-2" />
          <Skeleton width={400} height={20} />
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="text-center">
              <div className="flex items-center justify-center mb-2">
                <Skeleton variant="avatar" width={20} height={20} className="mr-2" />
                <Skeleton width={40} height={24} />
              </div>
              <Skeleton width={60} height={12} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DashboardHeaderSkeleton;