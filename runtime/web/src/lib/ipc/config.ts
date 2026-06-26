/**
 * Tauri IPC configuration — type stubs (Phase 2).
 */

import { invoke } from './runtime';
import type { ConfigDTO, Environment } from './runtime';

export const config = {
  getEnv: () => invoke<Environment>('config_get_env'),
  getRuntimeConfig: () => invoke<ConfigDTO>('config_get_runtime_config'),
} as const;

export type ConfigApi = typeof config;
