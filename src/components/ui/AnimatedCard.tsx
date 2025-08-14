import React from 'react';
import { motion, type Variants } from 'framer-motion';

interface AnimatedCardProps {
  children: React.ReactNode;
  className?: string;
  hoverEffect?: 'lift' | 'glow' | 'tilt' | 'scale';
  staggerChildren?: boolean;
  onClick?: () => void;
}

// Separate variants without transitions
const cardVariants: Variants = {
  hidden: { 
    opacity: 0, 
    y: 20, 
    scale: 0.95 
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1
  }
};

const containerVariants: Variants = {
  hidden: { 
    opacity: 0 
  },
  visible: {
    opacity: 1
  }
};

// Separate transition definitions
const cardTransition = {
  duration: 0.3,
  ease: [0.25, 0.1, 0.25, 1] as const
};

const containerTransition = {
  staggerChildren: 0.1,
  delayChildren: 0.2
};

// Separate hover animations (no variants)
const getHoverAnimation = (effect: string) => {
  switch (effect) {
    case 'lift':
      return {
        y: -8,
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)'
      };
    case 'glow':
      return {
        boxShadow: '0 0 30px rgba(139, 92, 246, 0.3)'
      };
    case 'tilt':
      return {
        rotateX: 5,
        rotateY: 5,
        scale: 1.02
      };
    case 'scale':
      return {
        scale: 1.03
      };
    default:
      return {
        y: -8,
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)'
      };
  }
};

const AnimatedCard: React.FC<AnimatedCardProps> = ({
  children,
  className = '',
  hoverEffect = 'lift',
  staggerChildren = false,
  onClick
}) => {
  const variants = staggerChildren ? containerVariants : cardVariants;
  const transition = staggerChildren ? containerTransition : cardTransition;
  
  return (
    <motion.div
      className={`glass-morphism-card rounded-2xl ${onClick ? 'cursor-pointer' : ''} ${className}`}
      variants={variants}
      initial="hidden"
      animate="visible"
      transition={transition}
      whileHover={getHoverAnimation(hoverEffect)}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      onClick={onClick}
      style={{ 
        transformStyle: 'preserve-3d'
      }}
    >
      {staggerChildren ? (
        <motion.div 
          variants={containerVariants}
          transition={containerTransition}
        >
          {children}
        </motion.div>
      ) : (
        children
      )}
    </motion.div>
  );
};

export default AnimatedCard;