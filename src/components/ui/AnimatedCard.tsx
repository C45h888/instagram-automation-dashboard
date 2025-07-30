import React from 'react';
import { motion } from 'framer-motion';

interface AnimatedCardProps {
  children: React.ReactNode;
  className?: string;
  hoverEffect?: 'lift' | 'glow' | 'tilt' | 'scale';
  staggerChildren?: boolean;
  delay?: number;
  onClick?: () => void;
}

const cardVariants = {
  hidden: { 
    opacity: 0, 
    y: 20, 
    scale: 0.95 
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: 'easeOut'
    }
  }
};

const hoverVariants = {
  lift: {
    y: -8,
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
    transition: { duration: 0.2, ease: 'easeOut' }
  },
  glow: {
    boxShadow: '0 0 30px rgba(139, 92, 246, 0.3)',
    transition: { duration: 0.2 }
  },
  tilt: {
    rotateX: 5,
    rotateY: 5,
    scale: 1.02,
    transition: { duration: 0.2 }
  },
  scale: {
    scale: 1.03,
    transition: { duration: 0.2, ease: 'easeOut' }
  }
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
};

const AnimatedCard: React.FC<AnimatedCardProps> = ({
  children,
  className = '',
  hoverEffect = 'lift',
  staggerChildren = false,
  delay = 0,
  onClick
}) => {
  const variants = staggerChildren ? containerVariants : cardVariants;
  
  return (
    <motion.div
      className={`glass-morphism-card rounded-2xl ${onClick ? 'cursor-pointer' : ''} ${className}`}
      variants={variants}
      initial="hidden"
      animate="visible"
      whileHover={hoverVariants[hoverEffect]}
      whileTap={onClick ? { scale: 0.98 } : {}}
      onClick={onClick}
      style={{ 
        transformStyle: 'preserve-3d',
        transition: `all 0.2s ease-out ${delay}s`
      }}
    >
      {staggerChildren ? (
        <motion.div variants={containerVariants}>
          {children}
        </motion.div>
      ) : (
        children
      )}
    </motion.div>
  );
};

export default AnimatedCard;