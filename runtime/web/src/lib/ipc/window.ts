/**
 * Tauri IPC window — type stubs (Phase 2).
 * See runtime/web/src/lib/ipc/runtime.ts for the IPC primitive and
 * shared DTOs. The shape must stay byte-identical to
 * runtime/src-tauri/src/ipc/types.rs.
 */

import { invoke } from './runtime';
import type { WindowSizeDTO } from './runtime';

export const window = {
  minimize: () => invoke<void>('window_minimize'),
  maximize: () => invoke<void>('window_maximize'),
  unmaximize: () => invoke<void>('window_unmaximize'),
  close: () => invoke<void>('window_close'),
  setTitle: (title: string) => invoke<void>('window_set_title', { title }),
  focus: () => invoke<void>('window_focus'),
  getInnerSize: () => invoke<WindowSizeDTO>('window_inner_size'),
} as const;

export type WindowApi = typeof window;
