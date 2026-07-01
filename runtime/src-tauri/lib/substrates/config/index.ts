/**
 * substrates/config/index.ts
 *
 * IPC-backed runtime config substrate. Fetches config from the Rust kernel
 * on module initialization so all WebView code reads from one place
 * instead of scattering `import.meta.env.VITE_*` calls.
 *
 * Usage:
 *   import { configReady, getApiBaseUrl, getSupabaseConfig } from '@/substrates/config';
 *
 *   // At app startup (e.g. main.ts):
 *   await configReady;
 *
 *   // Anywhere else:
 *   const apiBase = getApiBaseUrl();
 *   const { url, anonKey } = getSupabaseConfig();
 */

import { invoke } from '../../ipc/client';
import type { ConfigDTO } from '../../ipc/types';
import type { FrontendConfigDTO } from '../../contracts/ipc/frontend-config.contract';

// ─────────────────────────────────────────────────────────────────
// Internal state
// ─────────────────────────────────────────────────────────────────

let cachedConfig: FrontendConfigDTO | null = null;
let initPromise: Promise<void> | null = null;

// ─────────────────────────────────────────────────────────────────
// Fallback for browser-dev / non-Tauri environments
// ─────────────────────────────────────────────────────────────────

function buildFallback(): FrontendConfigDTO {
  return {
    api_base_url:
      (import.meta.env as Record<string, string | undefined>)?.VITE_API_BASE_URL ??
      'https://api.888intelligenceautomation.in',
    supabase_url:
      (import.meta.env as Record<string, string | undefined>)?.VITE_SUPABASE_URL ?? '',
    supabase_tunnel_url:
      (import.meta.env as Record<string, string | undefined>)?.VITE_SUPABASE_TUNNEL_URL ?? null,
    supabase_direct_url:
      (import.meta.env as Record<string, string | undefined>)?.VITE_SUPABASE_DIRECT_URL ?? null,
    supabase_anon_key:
      (import.meta.env as Record<string, string | undefined>)?.VITE_SUPABASE_ANON_KEY ?? '',
    admin_email:
      (import.meta.env as Record<string, string | undefined>)?.VITE_ADMIN_EMAIL ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────

/**
 * Resolves when config has been fetched from the kernel.
 *
 * In Tauri: calls `config_get_runtime_config` IPC command.
 * Outside Tauri: immediately resolves with the fallback values.
 */
export const configReady: Promise<void> = (async () => {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const dto = await invoke<ConfigDTO>('config_get_runtime_config', {});
      cachedConfig = dto.frontend;
    } catch {
      // Outside Tauri runtime (browser dev mode, unit tests): fall back
      // to import.meta.env so developers can run without a kernel.
      cachedConfig = buildFallback();
    }
  })();

  return initPromise;
})();

/**
 * Get the backend REST API base URL.
 * Throws if called before `configReady` has resolved.
 */
export function getApiBaseUrl(): string {
  if (!cachedConfig) {
    throw new Error(
      '[config substrate] configReady not awaited — call `await configReady` at app boot before using config getters',
    );
  }
  return cachedConfig.api_base_url;
}

/**
 * Get Supabase connection config.
 * Throws if called before `configReady` has resolved.
 */
export function getSupabaseConfig(): {
  url: string;
  tunnelUrl: string | null;
  directUrl: string | null;
  anonKey: string;
} {
  if (!cachedConfig) {
    throw new Error('[config substrate] configReady not awaited');
  }
  return {
    url: cachedConfig.supabase_url,
    tunnelUrl: cachedConfig.supabase_tunnel_url,
    directUrl: cachedConfig.supabase_direct_url,
    anonKey: cachedConfig.supabase_anon_key,
  };
}

/**
 * Get the admin email for dev-admin policy gating.
 * Returns null if not configured.
 * Throws if called before `configReady` has resolved.
 */
export function getAdminEmail(): string | null {
  if (!cachedConfig) {
    throw new Error('[config substrate] configReady not awaited');
  }
  return cachedConfig.admin_email;
}
