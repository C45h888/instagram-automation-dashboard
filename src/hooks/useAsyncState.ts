import { useState, useCallback, useEffect } from 'react';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

interface UseAsyncStateReturn<T> extends AsyncState<T> {
  execute: (asyncFunction: () => Promise<T>) => Promise<void>;
  reset: () => void;
  retry: () => void;
}

export function useAsyncState<T>(
  asyncFunction?: () => Promise<T>,
  immediate = true
): UseAsyncStateReturn<T> {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: immediate && !!asyncFunction,
    error: null,
  });

  const [lastAsyncFunction, setLastAsyncFunction] = useState<(() => Promise<T>) | null>(
    asyncFunction || null
  );

  const execute = useCallback(async (fn: () => Promise<T>) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    setLastAsyncFunction(() => fn);

    try {
      const result = await fn();
      setState({ data: result, loading: false, error: null });
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: error instanceof Error ? error : new Error('An error occurred') 
      }));
    }
  }, []);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
    setLastAsyncFunction(null);
  }, []);

  const retry = useCallback(() => {
    if (lastAsyncFunction) {
      execute(lastAsyncFunction);
    }
  }, [execute, lastAsyncFunction]);

  useEffect(() => {
    if (immediate && asyncFunction) {
      execute(asyncFunction);
    }
  }, []);

  return {
    ...state,
    execute,
    reset,
    retry,
  };
}