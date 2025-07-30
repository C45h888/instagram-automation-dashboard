import React from 'react';

interface LoadingSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  className = '',
  label
}) => {
  const getSizeClasses = () => {
    switch (size) {
      case 'xs':
        return 'w-3 h-3 border';
      case 'sm':
        return 'w-4 h-4 border';
      case 'md':
        return 'w-6 h-6 border-2';
      case 'lg':
        return 'w-8 h-8 border-2';
      default:
        return 'w-6 h-6 border-2';
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <div
        className={`animate-spin rounded-full border-transparent border-t-purple-500 border-r-pink-500 border-b-orange-500 ${getSizeClasses()} ${className}`}
        role="status"
        aria-label={label || 'Loading'}
      />
      {label && (
        <span className="text-sm text-white/70">{label}</span>
      )}
    </div>
  );
};

export default LoadingSpinner;