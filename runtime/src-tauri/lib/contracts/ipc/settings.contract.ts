/**
 * contracts/ipc/settings.contract.ts
 *
 * TS mirrors of the Rust IPC DTOs:
 *   - SettingsStateDTO
 *   - ThemeDTO
 *   - WindowPrefsDTO
 */

export type ThemeDTO = 'system' | 'light' | 'dark';

export interface WindowPrefsDTO {
  start_maximized: boolean;
  remember_position: boolean;
}

export interface SettingsStateDTO {
  theme: ThemeDTO;
  font_scale: number;
  window_prefs: WindowPrefsDTO;
}