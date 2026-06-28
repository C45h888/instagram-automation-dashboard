/**
 * substrates/http/retry.ts
 *
 * Canonical retry primitives for HTTP calls. Two layers:
 *
 * 1. fetchWithRetry — low-level: wraps fetch() with exponential backoff
 *    for transient network errors. Every raw HTTP call should go through this.
 *
 * 2. retryWithBackoff — high-level: wraps an async callable that returns
 *    {success, data, error} (ServiceResponse shape) with retry + response
 *    unwrapping. Used by bridge controllers and domain services.
 *
 * Why two primitives instead of one:
 *   fetchWithRetry operates at the fetch() level (network errors only).
 *   retryWithBackoff operates at the ServiceResponse level (handles
 *   application-level errors too). They compose: retryWithBackoff can call
 *   fetchWithRetry underneath if the callable wraps a network request, but
 *   they're independent utilities for different abstraction levels.
 *
 * Both honour AbortSignal for graceful cancellation.
 */

export const MAX_RETRIES = 3;
export const INITIAL_DELAY_MS = 1000;
export const RETRY_CAP_MS = 30_000;

// ─────────────────────────────────────────────────────────────────────────────
// Layer 1: fetchWithRetry — raw fetch() with exponential backoff
// ─────────────────────────────────────────────────────────────────────────────

export interface RetryConfig {
  maxRetries?: number;
  initialDelayMs?: number;
  /**
   * Optional classifier. Return true if the error is transient and worth
   * retrying. Default: classifies network errors only.
   */
  isRetryable?: (error: unknown) => boolean;
}

const defaultIsRetryable = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const message = error.message ?? '';
  return (
    message.includes('network') ||
    message.includes('ERR_NETWORK_CHANGED') ||
    message.includes('Failed to fetch') ||
    (error.name === 'TypeError' && message === 'Failed to fetch')
  );
};

/**
 * Fetch with exponential backoff for transient network errors.
 * Non-network errors throw immediately without consuming retry budget.
 */
export const fetchWithRetry = async (
  url: RequestInfo | URL,
  options: RequestInit = {},
  config: RetryConfig = {},
): Promise<Response> => {
  const maxRetries = config.maxRetries ?? MAX_RETRIES;
  const initialDelayMs = config.initialDelayMs ?? INITIAL_DELAY_MS;
  const isRetryable = config.isRetryable ?? defaultIsRetryable;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetch(url, options);
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;
      if (!isRetryable(error) || isLastAttempt) {
        throw error;
      }
      const delayMs = initialDelayMs * Math.pow(2, attempt);
      // eslint-disable-next-line no-console
      console.log(
        `🔄 Network error detected (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delayMs}ms...`,
      );
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }
  }

  // Unreachable: the loop either returns or throws on the last attempt.
  throw new Error('fetchWithRetry: unreachable');
};

// ─────────────────────────────────────────────────────────────────────────────
// Layer 2: retryWithBackoff — callable retry with ServiceResponse unwrapping
// ─────────────────────────────────────────────────────────────────────────────

export interface RetryCallableConfig {
  maxRetries?: number;
  baseDelayMs?: number;
  capDelayMs?: number;
}

/**
 * Wraps an async callable that returns {success, data, error} with
 * exponential backoff retry. Unwraps the ServiceResponse shape: on success
 * returns the data payload; on failure throws with the error message.
 *
 * Accepts an optional AbortSignal for cancellation during backoff delays.
 *
 * This is the bridge-controller primitive. Use instead of redefining
 * fetchWithRetry in each controller.
 */
export async function retryWithBackoff<T>(
  fetchFn: () => Promise<{ success: boolean; data?: T | null; error?: string }>,
  signal?: AbortSignal,
  config: RetryCallableConfig = {},
): Promise<T> {
  const maxRetries = config.maxRetries ?? MAX_RETRIES;
  const baseDelayMs = config.baseDelayMs ?? INITIAL_DELAY_MS;
  const capDelayMs = config.capDelayMs ?? RETRY_CAP_MS;

  let lastErr: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      const result = await fetchFn();
      if (result.success && result.data !== undefined && result.data !== null) {
        return result.data;
      }
      lastErr = new Error(result.error ?? 'fetch returned null');
    } catch (err) {
      lastErr = err;
    }
    if (attempt < maxRetries - 1) {
      const delay = Math.min(baseDelayMs * 2 ** attempt, capDelayMs);
      await sleepWithSignal(delay, signal);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

function sleepWithSignal(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}
