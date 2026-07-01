/**
 * contracts/ipc/frontend-config.contract.ts
 *
 * TS mirror of the Rust `FrontendConfigDTO` — the WebView-facing subset
 * of runtime configuration exposed via `config_get_runtime_config`.
 *
 * This contract travels across the IPC boundary. The Rust side guarantees
 * field shapes via `serde`. This file is the canonical TS mirror.
 *
 * If the Rust DTO adds/removes/renames a field, this file must be updated
 * in the same commit as the Rust change.
 */

export interface FrontendConfigDTO {
  api_base_url: string;
  supabase_url: string;
  supabase_tunnel_url: string | null;
  supabase_direct_url: string | null;
  supabase_anon_key: string;
  admin_email: string | null;
}
