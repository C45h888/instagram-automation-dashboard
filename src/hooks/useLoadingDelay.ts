import { useState, useEffect } from 'react';

interface UseLoadingDelayOptions {
  delay?: number;
  minDuration?: number;
}

export function useLoadingDelay(
  actualLoading: boolean,
  options: UseLoadingDelayOptions = {}
): boolean {
  const { delay = 200, minDuration = 500 } = options;
  const [delayedLoading, setDelayedLoading] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);

  useEffect(() => {
    let delayTimer: NodeJS.Timeout;
    let minDurationTimer: NodeJS.Timeout;

    if (actualLoading) {
      // Start the delay timer
      delayTimer = setTimeout(() => {
        setDelayedLoading(true);
        setStartTime(Date.now());
      }, delay);
    } else {
      // Clear delay timer if loading stops before delay
      clearTimeout(delayTimer);
      
      if (delayedLoading && startTime) {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, minDuration - elapsed);
        
        if (remaining > 0) {
          minDurationTimer = setTimeout(() => {
            setDelayedLoading(false);
            setStartTime(null);
          }, remaining);
        } else {
          setDelayedLoading(false);
          setStartTime(null);
        }
      }
    }

    return () => {
      clearTimeout(delayTimer);
      clearTimeout(minDurationTimer);
    };
  }, [actualLoading, delay, minDuration, delayedLoading, startTime]);

  return delayedLoading;
}