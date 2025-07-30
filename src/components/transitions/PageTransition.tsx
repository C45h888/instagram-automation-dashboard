import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';

interface PageTransitionProps {
  children: React.ReactNode;
  type?: 'slide' | 'fade' | 'scale' | 'slideUp';
  duration?: number;
}

const pageVariants = {
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

const pageTransitions = {
  slide: {
    type: 'tween',
    ease: 'anticipate',
    duration: 0.5
  },
  fade: {
    type: 'tween',
    ease: 'easeInOut',
    duration: 0.3
  },
  scale: {
    type: 'tween',
    ease: [0.68, -0.55, 0.265, 1.55],
    duration: 0.4
  },
  slideUp: {
    type: 'tween',
    ease: 'easeOut',
    duration: 0.4
  }
};

const PageTransition: React.FC<PageTransitionProps> = ({ 
  children, 
  type = 'slide',
  duration 
}) => {
  const location = useLocation();
  
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