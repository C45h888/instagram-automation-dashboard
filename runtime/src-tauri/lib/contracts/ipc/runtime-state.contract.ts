/**
 * contracts/ipc/runtime-state.contract.ts
 *
 * TS mirror of the Rust IPC DTOs in `runtime/src-tauri/src/ipc/types.rs`:
 *   - RuntimeStateDTO
 *   - PhaseDTO
 *
 * These types cross the Tauri IPC boundary as JSON. Field naming is
 * snake_case to match the Rust definitions and the WebView's expected
 * serde format. Do NOT add fields here that don't exist on the Rust side.
 *
 * If a Rust DTO changes, update this file in the same commit.
 */

export type PhaseDTO =
  | 'cold'
  | 'configuring'
  | 'logging'
  | 'window_init'
  | 'ready'
  | 'shutting_down'
  | 'stopped';

export interface RuntimeStateDTO {
  phase: PhaseDTO;
  correlation_id: string;
  booted_at_epoch_secs: number;
}