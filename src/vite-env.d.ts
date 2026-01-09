/// <reference types="vite/client" />

/**
 * Type declarations for Vite environment variables
 * This file makes TypeScript aware of all custom VITE_ prefixed environment variables
 * used in the Instagram Automation Dashboard application.
 * 
 * @see https://vitejs.dev/guide/env-and-mode.html#env-files
 * 
 * @updated 2025-10-04 - Added missing environment variables for admin, N8N, and Meta API
 */

interface ImportMetaEnv {
  // =====================================
  // REQUIRED ENVIRONMENT VARIABLES
  // =====================================
  
  /** Main Supabase project URL */
  readonly VITE_SUPABASE_URL: string;
  
  /** Supabase anonymous/public API key */
  readonly VITE_SUPABASE_ANON_KEY: string;
  
  // =====================================
  // OPTIONAL ENVIRONMENT VARIABLES
  // =====================================
  
  /** Application environment (development, staging, production) */
  readonly VITE_ENVIRONMENT?: string;
  
  /** Legacy: Cloudflare tunnel URL for Supabase connection */
  readonly VITE_SUPABASE_TUNNEL_URL?: string;
  
  /** Direct connection URL to Supabase (alternative to tunnel) */
  readonly VITE_SUPABASE_DIRECT_URL?: string;
  
  /** Backend API base URL (Express server endpoint) */
  readonly VITE_API_URL?: string;
  
  /** Backend API base URL (alternative naming convention) */
  readonly VITE_API_BASE_URL?: string;
  
  /** Instagram OAuth client ID */
  readonly VITE_INSTAGRAM_CLIENT_ID?: string;
  
  /** Instagram OAuth redirect URI */
  readonly VITE_INSTAGRAM_REDIRECT_URI?: string;
  
  /** N8N webhook base URL for automation workflows */
  readonly VITE_N8N_WEBHOOK_URL?: string;
  
  /** N8N base URL for workflow automation platform */
  readonly VITE_N8N_BASE_URL?: string;
  
  /** Feature flag: Enable debug mode */
  readonly VITE_DEBUG?: string;
  
  /** Feature flag: Enable analytics tracking */
  readonly VITE_ENABLE_ANALYTICS?: string;
  
  /** Feature flag: Enable Instagram OAuth flow */
  readonly VITE_ENABLE_INSTAGRAM_OAUTH?: string;
  
  /** Sentry DSN for error tracking */
  readonly VITE_SENTRY_DSN?: string;
  
  /** Google Analytics tracking ID */
  readonly VITE_GA_TRACKING_ID?: string;
  
  // =====================================
  // ADMIN & AUTHENTICATION
  // =====================================

  /** Admin user email for dashboard access */
  readonly VITE_ADMIN_EMAIL?: string;

  /** Admin user password for dashboard access */
  readonly VITE_ADMIN_PASSWORD?: string;

  /**
   * Authentication mode selector - controls which login methods are displayed
   *
   * @type {'facebook' | 'instagram' | 'both'}
   * @default 'both'
   *
   * Options:
   * - `'facebook'`: Shows only Facebook Login (Meta review mode)
   * - `'instagram'`: Shows only Instagram OAuth (legacy mode)
   * - `'both'`: Shows both login options (development/flexible)
   *
   * @example
   * // Development - show both options
   * VITE_AUTH_MODE=both
   *
   * @example
   * // Production - Meta compliant
   * VITE_AUTH_MODE=facebook
   *
   * @see {@link Login.tsx} for implementation
   */
  readonly VITE_AUTH_MODE?: 'facebook' | 'instagram' | 'both';

  /** Feature flag: Show admin portal link on login page */
  readonly VITE_SHOW_ADMIN_LINK?: string;
  
  // =====================================
  // WEBHOOK & META API CONFIGURATION
  // =====================================

  /** Webhook URL for Instagram events */
  readonly VITE_WEBHOOK_URL?: string;

  /** Webhook verification token for Instagram webhooks */
  readonly VITE_WEBHOOK_VERIFY_TOKEN?: string;

  /**
   * Meta/Facebook App ID for Instagram Business API integration
   *
   * @type {string}
   * @required true (for Facebook OAuth to work)
   *
   * Obtain from: https://developers.facebook.com/apps
   *
   * This value is safe to expose client-side as it's used in OAuth URLs.
   * The App ID identifies your application to Meta's authentication servers.
   *
   * @security Client-side safe - can be committed to version control
   *
   * @example
   * VITE_META_APP_ID=123456789012345
   *
   * @throws {Error} If not set when Facebook login is attempted
   *
   * @see {@link https://developers.facebook.com/docs/development/create-an-app}
   */
  readonly VITE_META_APP_ID?: string;

  /**
   * Meta/Facebook App Secret for server-side token exchange
   *
   * @type {string}
   * @required true (for backend token validation)
   *
   * Obtain from: https://developers.facebook.com/apps
   *
   * ⚠️ SECURITY WARNING:
   * This value should ONLY be used server-side (backend).
   * Do NOT expose this in client-side code or commit real values.
   * Vite will include this in the bundle, so treat as potentially exposed.
   *
   * Best Practice: Store in backend environment only, not frontend.
   *
   * @security HIGH SENSITIVITY - Never commit real values
   *
   * @example
   * // Development/testing only - use placeholder
   * VITE_META_APP_SECRET=your_meta_app_secret_here
   *
   * @see {@link backend.api/config} for server-side usage
   */
  readonly VITE_META_APP_SECRET?: string;

  /**
   * Custom OAuth redirect URI override
   *
   * @type {string}
   * @required false
   * @default 'https://888intelligenceautomation.in/auth/callback'
   *
   * The URL where Supabase redirects after OAuth authentication completes.
   * CRITICAL: NEVER use window.location.origin as it could be localhost in dev.
   * Must match exactly with URLs configured in Meta Developer Console and Supabase.
   *
   * Format: Must be a complete HTTPS URL (HTTP allowed for localhost only)
   *
   * @example
   * // Production callback (RECOMMENDED)
   * VITE_OAUTH_REDIRECT_URI=https://888intelligenceautomation.in/auth/callback
   *
   * @example
   * // Local development (use only for local testing)
   * VITE_OAUTH_REDIRECT_URI=http://localhost:5173/auth/callback
   *
   * @validation Must match Meta Developer Console configuration
   *
   * @see {@link https://developers.facebook.com/docs/facebook-login/redirect}
   */
  readonly VITE_OAUTH_REDIRECT_URI?: string;
  
  // =====================================
  // ADD ANY ADDITIONAL VITE_ VARIABLES HERE
  // =====================================
  
  // Example for future use:
  // readonly VITE_CUSTOM_FEATURE_FLAG?: string;
}

/**
 * Augment the ImportMeta interface to include our custom env
 */
interface ImportMeta {
  readonly env: ImportMetaEnv;
}