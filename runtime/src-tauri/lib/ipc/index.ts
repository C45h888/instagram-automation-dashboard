// =====================================
// IPC BARREL — Phase 3h
// Re-exports the WebView-side IPC adapter that integrates with the
// Rust kernel via Tauri commands (Phase 2 seam).
//
// Public surface:
//   - client:    invoke<>() chokepoint
//   - commands:  21 typed wrappers
//   - errors:    IpcError class + RUNTIME_ERROR_KINDS + isTauriRuntime
//   - types:     DTO mirrors
// =====================================

export * from './client';
export * from './commands';
export * from './errors';
export * from './types';
