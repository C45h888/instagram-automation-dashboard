/**
 * Tauri IPC logging — type stubs (Phase 2).
 */

import { invoke } from './runtime';
import type { LogEmitDTO } from './runtime';

export const log = {
  emitEvent: (event: LogEmitDTO) => invoke<void>('log_emit_event', { event }),
  getSessionLogPath: () =>
    invoke<string | null>('log_get_session_log_path'),
} as const;

export type LogApi = typeof log;
