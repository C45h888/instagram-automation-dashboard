import React, { useEffect, useState, useRef } from 'react';
import { motion, useInView, useMotionValue, useSpring } from 'framer-motion';

interface CountUpAnimationProps {
  end: number;
  start?: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  triggerOnMount?: boolean;
  className?: string;
}

const CountUpAnimation: React.FC<CountUpAnimationProps> = ({
  end,
  start = 0,
  duration = 1000,
  suffix = '',
  prefix = '',
  decimals = 0,
  triggerOnMount = false,
  className = ''
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const [hasAnimated, setHasAnimated] = useState(false);
  
  const motionValue = useMotionValue(start);
  const springValue = useSpring(motionValue, {
    duration: duration,
    bounce: 0
  });
  
  const [displayValue, setDisplayValue] = useState(start);

  useEffect(() => {
    const unsubscribe = springValue.on('change', (latest) => {
      setDisplayValue(latest);
    });

    return unsubscribe;
  }, [springValue]);

  useEffect(() => {
    if ((triggerOnMount || isInView) && !hasAnimated) {
      motionValue.set(end);
      setHasAnimated(true);
    }
  }, [isInView, triggerOnMount, hasAnimated, end, motionValue]);

  const formatNumber = (value: number) => {
    const formatted = value.toFixed(decimals);
    return `${prefix}${formatted}${suffix}`;
  };

  return (
    <motion.span
      ref={ref}
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {formatNumber(displayValue)}
    </motion.span>
  );
};

export default CountUpAnimation;