/**
 * Tauri IPC barrel export — Phase 2 contract.
 *
 * The Svelte layer (Phase 7) imports everything from this barrel so
 * the import surface is stable even as individual files evolve.
 *
 * Phase 2 constraint: this barrel contains only the typed wrappers
 * and shared DTOs. No business logic, no Supabase, no agent calls.
 * Those stay in the preserved TypeScript layer.
 */

export * from './runtime';
export { window, type WindowApi } from './window';
export { settings, type SettingsApi } from './settings';
export { session, type SessionApi } from './session';
export { log, type LogApi } from './log';
export { config, type ConfigApi } from './config';
export type { RuntimeApi } from './runtime';
