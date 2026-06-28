/**
 * src/lib/bridge/domains.ts
 *
 * Thin React-side bridge to the runtime kernel domain services.
 *
 * WHY THIS FILE EXISTS:
 *   The hard-cutover rule says the React/Vite layer (src/) is FROZEN as
 *   the Svelte migration skeleton. Body content is untouched; only
 *   single-line import-path updates are permitted when phase 3 migrates
 *   files imported by the React layer.
 *
 *   Reaching across 3 `..` levels directly into
 *   `runtime/src-tauri/lib/domains/...` from the React layer violates
 *   the constitutional boundary — the React layer should not import from
 *   the kernel path directly.
 *
 *   This bridge file is the single allowed entry point. React code
 *   imports from `src/lib/bridge/domains`. When the Tauri-IPC shell
 *   wrapping pass lands, this file's bodies get replaced with
 *   `invoke('...')` calls without touching any React consumer again.
 *
 * SCOPE:
 *   Re-exports ONLY the two kernel functions the React layer currently
 *   uses. As more functions are migrated in subsequent passes, add them
 *   here in the same pattern.
 */

export { deleteUserData } from '../../../runtime/src-tauri/lib/domains/gdpr/privacy.service';
export { getBusinessAccounts } from '../../../runtime/src-tauri/lib/domains/instagram/business-accounts.service';