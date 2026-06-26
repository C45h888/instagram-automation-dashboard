/**
 * Tauri IPC session (window session — NOT auth) — type stubs (Phase 2).
 */

import { invoke } from './runtime';
import type { ViewMetadataDTO } from './runtime';

export const session = {
  getCurrentView: () =>
    invoke<ViewMetadataDTO | null>('session_get_current_view'),
  mountView: (view: ViewMetadataDTO) =>
    invoke<void>('session_mount_view', { view }),
  unmountView: () => invoke<void>('session_unmount_view'),
} as const;

export type SessionApi = typeof session;
