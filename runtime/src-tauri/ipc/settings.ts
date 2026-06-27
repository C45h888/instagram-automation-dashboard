/**
 * Tauri IPC settings — type stubs (Phase 2).
 */

import { invoke } from './runtime';
import type { SettingsStateDTO, Theme, WindowPrefsDTO } from './runtime';

export const settings = {
  get: () => invoke<SettingsStateDTO>('settings_get'),
  setTheme: (theme: Theme) => invoke<void>('settings_set_theme', { theme }),
  setFontScale: (scale: number) =>
    invoke<void>('settings_set_font_scale', { scale }),
  setWindowPrefs: (prefs: WindowPrefsDTO) =>
    invoke<void>('settings_set_window_prefs', { prefs }),
} as const;

export type SettingsApi = typeof settings;
