// =====================================
// IPC TYPES — WebView-side DTO mirrors
// Phase 3f: Pass B — WebView adapter
//
// These are TYPE-ONLY mirrors of the DTOs declared in
// runtime/src-tauri/src/ipc/types.rs. Field naming is snake_case to
// match Rust → JSON marshaling is direct (no field remapping).
//
// Contract invariant: every variant here must match a Rust DTO.
// If a Rust DTO adds a field or variant, this file must follow.
// The Rust test `phase_dto_exhaustively_maps_seven_variants` is the
// authoritative source for variant counts; this file mirrors them.
// =====================================

// ─────────────────────────────────────────────────────────────────
// Error envelope
// ─────────────────────────────────────────────────────────────────

/**
 * Stable, machine-readable error envelope returned by every IPC
 * command on failure. `kind` is the stable error code from
 * `RuntimeError::kind()`; `message` is human-readable and not stable
 * across versions.
 */
export interface IpcErrorDTO {
  kind: string;
  message: string;
}

// ─────────────────────────────────────────────────────────────────
// Runtime state
// ─────────────────────────────────────────────────────────────────

/**
 * Phase enum for the runtime kernel's bootstrap lifecycle.
 * Mirrors `RuntimePhase` in runtime_state.rs. Seven variants,
 * snake_case serialization.
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

// ─────────────────────────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────
// Session (window session — NOT auth)
// ─────────────────────────────────────────────────────────────────

export interface ViewMetadataDTO {
  view_id: string;
  mounted_at_epoch_secs: number;
}

// ─────────────────────────────────────────────────────────────────
// Window
// ─────────────────────────────────────────────────────────────────

export interface WindowSizeDTO {
  width: number;
  height: number;
}

// ─────────────────────────────────────────────────────────────────
// Logging
// ─────────────────────────────────────────────────────────────────

/**
 * Structured event forwarded from the WebView into the kernel's
 * tracing pipeline. `fields` carries arbitrary structured context.
 */
export interface LogEmitDTO {
  component: string;
  event: string;
  fields: Record<string, string>;
}

// ─────────────────────────────────────────────────────────────────
// Configuration / Environment
//
// Re-exported from the canonical contract at
// `contracts/ipc/config.contract.ts`. Do NOT redefine these shapes
// here — the contract is the single source of truth, mirrored into
// Rust at `runtime/src-tauri/src/ipc/types.rs::LoggingConfigDTO`.
// ─────────────────────────────────────────────────────────────────

export type { EnvDTO, LoggingConfigDTO, WindowConfigDTO, ConfigDTO, LoggingFormat } from '../contracts/ipc/config.contract';

// ─────────────────────────────────────────────────────────────────
// FSM Redis transport (6 commands, Phase 4 / FSM-GSC-2)
//
// Mirrors `runtime/src-tauri/src/redis/commands.rs` DTOs. Field naming
// is snake_case to match the Rust side. The substrate adapter
// (`substrates/redis/`) wraps these types and adds substrate-level
// error mapping; FSM code should consume the substrate, not this file.
// ─────────────────────────────────────────────────────────────────

/** FSM transition. RPUSHed to `lineage:ledger:entries` and XADDed to
 *  `lineage:webview:transitions` in one publish op. */
export interface Transition {
  transition_id: string;
  correlation_id: string;
  domain: string;
  from_state: string;
  to_state: string;
  event: string;
  payload: Record<string, unknown> | null;
  occurred_at_epoch_ms: number;
}

/** Receipt returned by `fsm_publish_transition`. */
export interface PublishReceipt {
  transition_id: string;
  ledger_index: number;
  stream_id: string;
}

/** Heartbeat payload — periodic liveness signal from the FSM. */
export interface HeartbeatPayload {
  correlation_id: string;
  domain: string;
  state: string;
  observed_at_epoch_ms: number;
}

/** Worker lease returned by `fsm_acquire_worker`. */
export interface WorkerLease {
  lease_id: string;
  acquired_at_epoch_ms: number;
  remaining: number;
}

/** Snapshot of a domain — current state + recent transitions. */
export interface DomainSnapshot {
  domain: string;
  current_state: string;
  last_transitions: Transition[];
}
