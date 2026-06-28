// =====================================
// IPC CLIENT — singleton Tauri invoke wrapper
// Phase 3f: Pass B — WebView adapter
//
// Every IPC command funnels through `invoke()` here. This is the
// single chokepoint that:
//   1. Detects whether we're inside the Tauri runtime
//   2. Calls @tauri-apps/api/core invoke
//   3. Converts raw rejections into typed `IpcError` instances
//
// Consumers should import the typed wrappers from `./commands.ts`
// instead of calling `invoke()` directly. This file is the seam's
// WebView-side translation layer.
// =====================================

import { invoke as tauriInvoke } from '@tauri-apps/api/core';

import type { IpcErrorDTO } from './types';
import { IpcError, isTauriRuntime } from './errors';

export interface InvokeOptions {
  // Future expansion point: timeout, retry policy, correlation_id override.
  // Empty today; reserved so callers can pass opts without breaking later.
}

/**
 * Invoke a Tauri command by name. Throws `IpcError` on failure.
 *
 * Outside the Tauri runtime (browser dev mode, unit tests), every
 * call throws `IpcError { kind: 'RUNTIME_IPC_ERROR' }`. This is by
 * design — the adapter is a no-op seam outside the desktop runtime.
 */
export async function invoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
  _opts?: InvokeOptions,
): Promise<T> {
  if (!isTauriRuntime()) {
    throw new IpcError({
      kind: 'RUNTIME_IPC_ERROR',
      message: `invoke('${cmd}') called outside Tauri runtime`,
    });
  }

  try {
    return await tauriInvoke<T>(cmd, args);
  } catch (raw) {
    // The Rust IpcErrorDTO is serialized as JSON on the boundary.
    // Tauri's invoke rejects with the deserialized object.
    const dto = raw as Partial<IpcErrorDTO>;
    if (
      dto &&
      typeof dto.kind === 'string' &&
      typeof dto.message === 'string'
    ) {
      throw new IpcError(dto as IpcErrorDTO);
    }
    throw new IpcError({
      kind: 'RUNTIME_INTERNAL_ERROR',
      message: String(raw),
    });
  }
}
