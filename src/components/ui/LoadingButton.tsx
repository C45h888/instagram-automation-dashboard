import React from 'react';
import LoadingSpinner from './LoadingSpinner';

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  leftIcon?: React.ReactNode;
  children: React.ReactNode;
}

const LoadingButton: React.FC<LoadingButtonProps> = ({
  loading = false,
  variant = 'primary',
  size = 'md',
  leftIcon,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const getVariantClasses = () => {
    switch (variant) {
      case 'primary':
        return 'bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white hover:opacity-90';
      case 'secondary':
        return 'bg-white/10 text-white hover:bg-white/20 border border-white/20';
      case 'danger':
        return 'bg-red-600 text-white hover:bg-red-700';
      case 'ghost':
        return 'bg-transparent text-white hover:bg-white/10';
      default:
        return 'bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white hover:opacity-90';
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-3 py-1.5 text-sm';
      case 'md':
        return 'px-5 py-2 text-base';
      case 'lg':
        return 'px-7 py-3 text-lg';
      default:
        return 'px-5 py-2 text-base';
    }
  };

  const isDisabled = disabled || loading;

  return (
    <button
      {...props}
      disabled={isDisabled}
      className={`
        relative rounded-lg font-medium transition-all duration-200 
        focus:outline-none focus:ring-2 focus:ring-purple-500/50
        disabled:opacity-50 disabled:cursor-not-allowed
        ${getVariantClasses()} ${getSizeClasses()} ${className}
      `}
      aria-label={loading ? 'Loading...' : undefined}
    >
      <span className={`flex items-center justify-center space-x-2 ${loading ? 'opacity-0' : 'opacity-100'}`}>
        {leftIcon && <span>{leftIcon}</span>}
        <span>{children}</span>
      </span>
      
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <LoadingSpinner size="sm" />
        </div>
      )}
    </button>
  );
};

export default LoadingButton;