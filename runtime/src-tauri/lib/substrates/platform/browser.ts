/**
 * substrates/platform/browser.ts
 *
 * Browser-environment metadata helpers. Reads from `navigator` which is
 * browser-only. This is a substrate: it depends on the environment, but
 * it has no business semantics — domains that need userAgent or browser
 * language call into here instead of touching `navigator` directly.
 *
 * Why this lives in substrates and not in a domain file:
 *   - Domain code must be environment-agnostic. `navigator` is
 *     browser-only and breaks in Node/Tauri-Rust contexts.
 *   - Substrates own the I/O primitives. Reading `navigator` is I/O
 *     (against the window environment), so it belongs here.
 */

export interface BrowserMetadata {
  userAgent: string;
  browserLanguage: string;
}

/**
 * Returns the current browser's user agent string and primary language.
 * Returns `'unknown'` / `'en'` defaults if `navigator` is unavailable
 * (e.g. in non-browser environments like Tauri Rust commands or Node tests).
 */
export function getBrowserMetadata(): BrowserMetadata {
  return {
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    browserLanguage: typeof navigator !== 'undefined' ? navigator.language : 'en',
  };
}