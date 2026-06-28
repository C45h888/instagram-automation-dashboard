/**
 * src/lib/bridge/ipc-errors.ts
 *
 * TS mirror of the Rust `IpcErrorDTO` envelope. Every Rust command returns
 * `Result<T, IpcErrorDTO>` — on failure, Tauri 2.x rejects the JS promise
 * with a serialized IpcErrorDTO. The plane in `ipc.ts` catches and re-throws
 * preserving the `kind` discriminant.
 *
 * If Rust `IpcErrorDTO` changes shape, update this file in the same commit.
 */

export interface IpcErrorDTO {
  /** Stable machine-readable error code, e.g. `"RUNTIME_WINDOW_ERROR"`. */
  kind: string;
  /** Human-readable message. */
  message: string;
}