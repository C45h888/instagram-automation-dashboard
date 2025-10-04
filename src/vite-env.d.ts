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
  
  // =====================================
  // WEBHOOK & META API CONFIGURATION
  // =====================================
  
  /** Webhook URL for Instagram events */
  readonly VITE_WEBHOOK_URL?: string;
  
  /** Webhook verification token for Instagram webhooks */
  readonly VITE_WEBHOOK_VERIFY_TOKEN?: string;
  
  /** Meta/Facebook App ID for Instagram API integration */
  readonly VITE_META_APP_ID?: string;
  
  /** Meta/Facebook App Secret for Instagram API integration */
  readonly VITE_META_APP_SECRET?: string;
  
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