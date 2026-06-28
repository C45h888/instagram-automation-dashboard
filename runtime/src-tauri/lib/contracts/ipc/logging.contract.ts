/**
 * contracts/ipc/logging.contract.ts
 *
 * TS mirror of the Rust IPC DTO `LogEmitDTO`.
 */

export interface LogEmitDTO {
  component: string;
  event: string;
  fields: Record<string, string>;
}