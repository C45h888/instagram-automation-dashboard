import React from 'react';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  variant?: 'text' | 'title' | 'avatar' | 'button' | 'card';
  animate?: boolean;
}

const Skeleton: React.FC<SkeletonProps> = ({
  width,
  height,
  className = '',
  variant = 'text',
  animate = true
}) => {
  const getVariantClasses = () => {
    switch (variant) {
      case 'text':
        return 'h-4 bg-white/10 rounded';
      case 'title':
        return 'h-6 bg-white/15 rounded';
      case 'avatar':
        return 'rounded-full bg-white/10';
      case 'button':
        return 'h-10 bg-white/10 rounded-lg';
      case 'card':
        return 'bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl';
      default:
        return 'bg-white/10 rounded';
    }
  };

  const animationClass = animate ? 'animate-shimmer' : '';
  
  const style = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  };

  return (
    <div
      className={`${getVariantClasses()} ${animationClass} ${className}`}
      style={style}
      aria-label="Loading content"
      role="status"
    />
  );
};

export default Skeleton;