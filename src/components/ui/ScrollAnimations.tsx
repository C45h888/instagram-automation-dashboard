import React, { useRef } from 'react';
import { motion, useInView, useScroll, useTransform } from 'framer-motion';

interface ScrollFadeInProps {
  children: React.ReactNode;
  direction?: 'up' | 'down' | 'left' | 'right';
  delay?: number;
  className?: string;
}

export const ScrollFadeIn: React.FC<ScrollFadeInProps> = ({
  children,
  direction = 'up',
  delay = 0,
  className = ''
}) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const directionVariants = {
    up: { y: 50, opacity: 0 },
    down: { y: -50, opacity: 0 },
    left: { x: 50, opacity: 0 },
    right: { x: -50, opacity: 0 }
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={directionVariants[direction]}
      animate={isInView ? { x: 0, y: 0, opacity: 1 } : directionVariants[direction]}
      transition={{ 
        duration: 0.6, 
        delay,
        ease: 'easeOut'
      }}
    >
      {children}
    </motion.div>
  );
};

interface ParallaxProps {
  children: React.ReactNode;
  speed?: number;
  className?: string;
}

export const Parallax: React.FC<ParallaxProps> = ({
  children,
  speed = 0.5,
  className = ''
}) => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start']
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, speed * 100]);

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ y }}
    >
      {children}
    </motion.div>
  );
};

interface ScrollProgressProps {
  className?: string;
}

export const ScrollProgress: React.FC<ScrollProgressProps> = ({ className = '' }) => {
  const { scrollYProgress } = useScroll();

  return (
    <motion.div
      className={`fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500 transform-gpu z-50 ${className}`}
      style={{ scaleX: scrollYProgress, transformOrigin: '0%' }}
    />
  );
};