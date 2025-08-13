// Replace the entire hook with:
import { useState, useEffect } from 'react';

export const useLoadingDelay = (loading: boolean, delay: number = 300) => {
  const [delayedLoading, setDelayedLoading] = useState(false);

  useEffect(() => {
    let delayTimer: NodeJS.Timeout | undefined;

    if (loading) {
      delayTimer = setTimeout(() => {
        setDelayedLoading(true);
      }, delay);
    } else {
      setDelayedLoading(false);
      if (delayTimer) {
        clearTimeout(delayTimer);
      }
    }

    return () => {
      if (delayTimer) {
        clearTimeout(delayTimer);
      }
    };
  }, [loading, delay]);

  return delayedLoading;
};