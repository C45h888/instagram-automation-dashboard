/**
 * substrates/redis/types.ts
 *
 * Substrate-level types. These mirror the IPC DTOs (which mirror the
 * Rust types in `runtime/src-tauri/src/redis/commands.rs`). The
 * substrate re-exports them with substrate-friendly names — domain
 * code should import from this module, not from `ipc/types.ts`.
 */

import type {
  Transition as IpcTransition,
  PublishReceipt as IpcPublishReceipt,
  HeartbeatPayload as IpcHeartbeatPayload,
  WorkerLease as IpcWorkerLease,
  DomainSnapshot as IpcDomainSnapshot,
} from '../../ipc/types';

/** Re-exported Transition — semantically the same as the IPC DTO,
 *  but the substrate owns its definition. FSM code may import either
 *  path; the types are identical. */
export type Transition = IpcTransition;
export type PublishReceipt = IpcPublishReceipt;
export type HeartbeatPayload = IpcHeartbeatPayload;
export type WorkerLease = IpcWorkerLease;
export type DomainSnapshot = IpcDomainSnapshot;