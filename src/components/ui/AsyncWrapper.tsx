import React from 'react';
import LoadingSpinner from './LoadingSpinner';

interface AsyncWrapperProps<T> {
  loading: boolean;
  error: Error | null;
  data: T | null;
  skeleton?: React.ComponentType<any>;
  onRetry?: () => void;
  children: (data: T) => React.ReactNode;
  className?: string;
}

function AsyncWrapper<T>({
  loading,
  error,
  data,
  skeleton: SkeletonComponent,
  onRetry,
  children,
  className = ''
}: AsyncWrapperProps<T>) {
  if (loading) {
    if (SkeletonComponent) {
      return <SkeletonComponent />;
    }
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <LoadingSpinner size="lg" label="Loading..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`glass-morphism-card p-8 rounded-2xl text-center ${className}`}>
        <div className="text-red-400 mb-4">
          <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">Something went wrong</h3>
        <p className="text-gray-400 mb-4">{error.message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            Try Again
          </button>
        )}
      </div>
    );
  }

  if (!data) {
    return (
      <div className={`glass-morphism-card p-8 rounded-2xl text-center ${className}`}>
        <p className="text-gray-400">No data available</p>
      </div>
    );
  }

  return <>{children(data)}</>;
}

export default AsyncWrapper;