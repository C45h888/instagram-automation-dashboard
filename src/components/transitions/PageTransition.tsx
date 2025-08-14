import React from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { useLocation } from 'react-router-dom';

interface PageTransitionProps {
  children: React.ReactNode;
  type?: 'slide' | 'fade' | 'scale' | 'slideUp';
  duration?: number;
}

// Separate variants without transitions
const pageVariants: Record<string, Variants> = {
  slide: {
    initial: { opacity: 0, x: 300 },
    in: { opacity: 1, x: 0 },
    out: { opacity: 0, x: -300 }
  },
  fade: {
    initial: { opacity: 0 },
    in: { opacity: 1 },
    out: { opacity: 0 }
  },
  scale: {
    initial: { opacity: 0, scale: 0.95 },
    in: { opacity: 1, scale: 1 },
    out: { opacity: 0, scale: 1.05 }
  },
  slideUp: {
    initial: { opacity: 0, y: 50 },
    in: { opacity: 1, y: 0 },
    out: { opacity: 0, y: -50 }
  }
};

// Separate transition definitions
const pageTransitions: Record<string, any> = {
  slide: {
    type: 'tween',
    ease: [0.68, -0.55, 0.265, 1.55],
    duration: 0.5
  },
  fade: {
    type: 'tween',
    ease: [0.4, 0, 0.2, 1],
    duration: 0.3
  },
  scale: {
    type: 'tween',
    ease: [0.68, -0.55, 0.265, 1.55],
    duration: 0.4
  },
  slideUp: {
    type: 'tween',
    ease: [0.25, 0.1, 0.25, 1],
    duration: 0.4
  }
};

const PageTransition: React.FC<PageTransitionProps> = ({ 
  children, 
  type = 'slide',
  duration 
}) => {
  const location = useLocation();
  
  // Create transition with optional duration override
  const transition = duration 
    ? { ...pageTransitions[type], duration }
    : pageTransitions[type];

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial="initial"
        animate="in"
        exit="out"
        variants={pageVariants[type]}
        transition={transition}
        className="w-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

export default PageTransition;