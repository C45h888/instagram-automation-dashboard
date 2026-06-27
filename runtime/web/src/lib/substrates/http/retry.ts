/**
 * substrates/http/retry.ts
 *
 * Canonical fetch retry primitive. Used by:
 *   - substrates/supabase/client.ts (every Supabase HTTP call)
 *   - domains that need to wrap raw HTTP calls in exponential backoff
 *
 * Why this lives in substrates/http/ and not in each consumer:
 *   The bridge controllers reinvented `fetchWithRetry` at least five times
 *   during Phase 2 (agentHealth.ts, analyticsReports.ts, contentAnalytics.ts,
 *   queueMonitor.ts, the supabase.ts client itself). This file is the one
 *   canonical implementation. Future consumers MUST import from here, not
 *   redefine. Phase 3g will collapse the duplicates.
 *
 * Behaviour (preserved verbatim from src/lib/supabase.ts:86-117):
 *   - 3 retries (MAX_RETRIES + 1 = 4 total attempts)
 *   - Exponential backoff: 1s, 2s, 4s
 *   - Only retries on network errors (TypeError "Failed to fetch",
 *     ERR_NETWORK_CHANGED). Auth/server errors propagate immediately.
 */

export const MAX_RETRIES = 3;
export const INITIAL_DELAY_MS = 1000;

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
