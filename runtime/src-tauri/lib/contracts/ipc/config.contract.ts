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

/**
 * LoggingConfigDTO — TS mirror of the Rust IPC DTO `LoggingConfigDTO`.
 *
 * Canonical field set, enforced by the wire (Rust serde). The kernel's
 * internal `LoggingConfig` carries an additional `stdout` toggle for
 * StdoutSink; that field is a kernel implementation detail and is NOT
 * exposed on the IPC wire.
 *
 * `format` is constrained to the two values the Rust `LoggingFormat`
 * enum serialises to via `#[serde(rename_all = "lowercase")]`.
 */
export type LoggingFormat = 'json' | 'text';

export interface LoggingConfigDTO {
  level: string;
  format: LoggingFormat;
  file_path: string | null;
}

export interface ConfigDTO {
  env: EnvDTO;
  window: WindowConfigDTO;
  logging: LoggingConfigDTO;
}