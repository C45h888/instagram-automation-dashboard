/// <reference types="vite/client" />

/**
 * Vite environment variable type declarations for the runtime/web/src/lib/ tree.
 *
 * Mirrors the same ImportMetaEnv shape declared in src/vite-env.d.ts.
 * Both trees need the same env-var typings because both consume Vite-built
 * code. Keeping two copies is intentional: a single shared declaration in a
 * shared location would require either:
 *   - moving src/vite-env.d.ts up one level (breaks src/main.tsx import path), or
 *   - adding a triple-slash reference from every substrate file.
 *
 * If a new VITE_ env var is added, declare it in BOTH files.
 */

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_ENVIRONMENT?: string;
  readonly VITE_SUPABASE_TUNNEL_URL?: string;
  readonly VITE_SUPABASE_DIRECT_URL?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_INSTAGRAM_CLIENT_ID?: string;
  readonly VITE_INSTAGRAM_REDIRECT_URI?: string;
  readonly VITE_N8N_WEBHOOK_URL?: string;
  readonly VITE_N8N_BASE_URL?: string;
  readonly VITE_DEBUG?: string;
  readonly VITE_ENABLE_ANALYTICS?: string;
  readonly VITE_ENABLE_INSTAGRAM_OAUTH?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_GA_TRACKING_ID?: string;
  readonly VITE_ADMIN_EMAIL?: string;
  readonly VITE_ADMIN_PASSWORD?: string;
  readonly VITE_AUTH_MODE?: 'facebook' | 'instagram' | 'both';
  readonly VITE_SHOW_ADMIN_LINK?: string;
  readonly VITE_WEBHOOK_URL?: string;
  readonly VITE_WEBHOOK_VERIFY_TOKEN?: string;
  readonly VITE_META_APP_ID?: string;
  readonly VITE_META_APP_SECRET?: string;
  readonly VITE_OAUTH_REDIRECT_URI?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
