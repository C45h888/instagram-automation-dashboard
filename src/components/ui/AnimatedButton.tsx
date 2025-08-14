import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

interface AnimatedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'destructive';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  hoverEffect?: 'scale' | 'magnetic' | 'glow' | 'lift';
  clickEffect?: 'ripple' | 'scale' | 'bounce';
  loading?: boolean;
  success?: boolean;
  children: React.ReactNode;
}

const buttonVariants = {
  primary: 'bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white',
  secondary: 'bg-white/10 text-white hover:bg-white/20',
  ghost: 'bg-transparent text-white hover:bg-white/10',
  outline: 'border border-white/20 text-white hover:bg-white/10',
  destructive: 'bg-red-600 text-white hover:bg-red-700',
};

const sizeVariants = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-5 py-2 text-base',
  lg: 'px-7 py-3 text-lg',
  icon: 'p-2',
};

// Separate hover animations (no complex transitions)
const getHoverAnimation = (effect: string) => {
  switch (effect) {
    case 'scale':
      return { scale: 1.05 };
    case 'magnetic':
      return { scale: 1.02, y: -2 };
    case 'glow':
      return { boxShadow: '0 0 20px rgba(139, 92, 246, 0.5)' };
    case 'lift':
      return { y: -3, boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)' };
    default:
      return { scale: 1.05 };
  }
};

const getClickAnimation = (effect: string) => {
  switch (effect) {
    case 'ripple':
      return { scale: 0.95 };
    case 'scale':
      return { scale: 0.98 };
    case 'bounce':
      return { scale: 1.1 };
    default:
      return { scale: 0.98 };
  }
};

// Simple transition
const hoverTransition = {
  duration: 0.2,
  ease: [0.25, 0.1, 0.25, 1] as const
};

const AnimatedButton: React.FC<AnimatedButtonProps> = ({
  variant = 'primary',
  size = 'md',
  hoverEffect = 'scale',
  clickEffect = 'scale',
  loading = false,
  success = false,
  children,
  className = '',
  disabled,
  onClick,
  // ✅ SEPARATION: Extract conflicting HTML drag events
  onDrag,
  onDragStart,
  onDragEnd,
  onDragEnter,
  onDragExit,
  onDragLeave,
  onDragOver,
  onDrop,
  // ✅ SEPARATION: Extract other potentially conflicting events
  onAnimationStart,
  onAnimationEnd,
  onTransitionEnd,
  // Safe props that don't conflict with Framer Motion
  ...safeProps
}) => {
  const [isClicked, setIsClicked] = useState(false);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || loading) return;
    
    setIsClicked(true);
    setTimeout(() => setIsClicked(false), 150);
    
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <motion.button
      className={`
        rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50
        ${buttonVariants[variant]} ${sizeVariants[size]} ${className}
        ${disabled || loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
      whileHover={disabled || loading ? undefined : getHoverAnimation(hoverEffect)}
      whileTap={disabled || loading ? undefined : getClickAnimation(clickEffect)}
      animate={isClicked ? getClickAnimation(clickEffect) : undefined}
      transition={hoverTransition}
      disabled={disabled || loading}
      onClick={handleClick}
      // ✅ CLEAN SPREAD: Only safe props reach motion.button
      {...safeProps}
    >
      <motion.div
        className="flex items-center justify-center space-x-2"
        animate={loading ? { opacity: 0.7 } : { opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        {loading && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <Loader2 className="w-4 h-4" />
          </motion.div>
        )}
        {success && !loading && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          >
            ✓
          </motion.div>
        )}
        <span>{children}</span>
      </motion.div>
    </motion.button>
  );
};

export default AnimatedButton;