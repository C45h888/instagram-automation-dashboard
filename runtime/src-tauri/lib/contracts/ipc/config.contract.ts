/**
 * contracts/ipc/config.contract.ts
 *
 * TS mirrors of the Rust IPC DTOs:
 *   - EnvDTO
 *   - ConfigDTO
 *   - WindowConfigDTO
 *   - LoggingConfig (mirrored from runtime config)
 */

export type EnvDTO = 'dev' | 'staging' | 'prod';

export interface WindowConfigDTO {
  title: string;
  width: number;
  height: number;
  min_width: number;
  min_height: number;
  resizable: boolean;
}

export interface LoggingConfigDTO {
  level: string;
  format: string;
  file_path: string | null;
}

export interface ConfigDTO {
  env: EnvDTO;
  window: WindowConfigDTO;
  logging: LoggingConfigDTO;
}