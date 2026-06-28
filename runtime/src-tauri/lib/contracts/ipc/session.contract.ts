/**
 * contracts/ipc/session.contract.ts
 *
 * TS mirror of the Rust IPC DTO `ViewMetadataDTO`.
 */

export interface ViewMetadataDTO {
  view_id: string;
  mounted_at_epoch_secs: number;
}