# PHASE 3f — Tauri-IPC WebView Adapter (Execution Plan)

**Version:** 1.0
**Program:** Systemic Refactor Initiative
**Status:** DRAFT — awaiting user sign-off ("go")
**Parent Documents:**
- `runtime/contracts/PHASE2_development-contract.md` (IPC constitutional seam)
- `runtime/contracts/PHASE3_development-contract.md` (Phase 3 program)
- `runtime/docs/PHASE3_EXECUTION_PLAN.md` (active phase tracker)

---

## 1. Mission

Phase 3f has TWO deliverables, in this exact order:

1. **Preflight audit (Pass A)** — Document the Rust-side IPC shell as
   already-complete and constitutionally clean. No code changes. Closes
   the gap on the Phase 2 contract's promise that "Phase 2 establishes
   the seam" by confirming the Rust half of that seam is correct.

2. **WebView-side adapter (Pass B)** — Build the TypeScript half of
   the seam: typed `invoke<>` wrappers, the `IpcErrorDTO` envelope, and
   the singleton Tauri client. This is what the Phase 2 contract calls
   "Svelte-side type stubs" — but written today so that the React app
   can also benefit, and so Phase 3g (strip React+Vite) starts from a
   buildable shell.

**Phase 3f does NOT migrate any T3 file. Does NOT touch domain code.
Does NOT replace the React layer. ONLY adds the WebView-side IPC
adapter as a new layer that lives below the React layer and above
the Tauri runtime.**

The preflight + adapter split is by user direction: "we should ensure
to validate what is the correct ... we have to ensure to validate ...
we have to ensure to validate the state." Preflight first, then build.

---

## 2. Constitutional Compliance (Re-affirmed)

The DOMAIN_PRESERVATION_LAW (Law 001) is in force. The WebView adapter
must satisfy all three laws:

### 2.1 Law 1 — Domain preservation

The WebView adapter:
- MAY import `@tauri-apps/api` (infrastructure, not domain)
- MAY import from `runtime/src-tauri/src/ipc/` types via REPLICATED
  type definitions (the WebView cannot import Rust; DTOs are
  duplicated in TS as the contract)
- MUST NOT import `src/services/`, `src/hooks/`, `src/components/`,
  `src/pages/`, or anything in `runtime/src-tauri/lib/domains/`
- MUST NOT call Supabase, auth stores, or any domain substrate

### 2.2 Law 2 — Constitutional seam

The seam runs at the Rust→WebView boundary. The adapter IS that seam's
WebView half. Everything below the adapter (Rust kernel) is sealed.
Everything above the adapter (React layer, future Svelte) is replaceable.

### 2.3 Law 3 — Layered architecture

The adapter sits at a NEW layer in the WebView architecture:

```
┌──────────────────────────────────────────────────────────┐
│  React UI layer (PRESERVED in 3f, removed in 3g)         │
│   src/components/  src/pages/  src/hooks/                │
└──────────────────────────────┬───────────────────────────┘
                               │ imports from
                               ▼
┌──────────────────────────────────────────────────────────┐
│  IPC adapter layer (NEW in 3f — Phase 2 seam, JS half)  │
│   src/lib/ipc/                                            │
│   ├─ client.ts       (singleton Tauri invoke wrapper)    │
│   ├─ errors.ts       (IpcErrorDTO envelope typing)       │
│   ├─ commands.ts     (21 typed invoke<> wrappers)        │
│   └─ types.ts        (DTO mirrors, contract)             │
└──────────────────────────────┬───────────────────────────┘
                               │ invoke<>() over Tauri IPC
                               ▼
┌──────────────────────────────────────────────────────────┐
│  Rust kernel (Phase 1+2 — verified clean in 3f preflight)│
│   runtime/src-tauri/src/ipc/ (commands + types)         │
└──────────────────────────────────────────────────────────┘
```

**No upward arrows.** The IPC adapter depends on @tauri-apps/api only.
The React layer can depend on the adapter. The adapter NEVER imports
the React layer.

---

## 3. Preflight (Pass A) — Rust-side audit, no edits

### 3.1 Audit findings (already verified in this session)

`cargo check` and `cargo test --lib`: GREEN (53 passed, 0 failed).

Constitutional-seam invariants (all PASS):
- 21 commands registered in `bootstrap/runtime.rs:92-114`
- Every command returns `IpcResult<T>` — compile-time enforced by
  the `all_commands_return_ipc_result_with_correct_shape` test
- `IpcErrorDTO` envelopes `RuntimeError`; kernel error is NOT Serialize
- `no_domain_identifiers_in_commands` test PASSES — zero forbidden
  identifiers (authStore, supabase, agentService, useAgentHealth,
  useOversightChat, instagram, workflow, queue) in commands.rs
- `session_carries_no_auth_fields` test PASSES — no user_id,
  account_id, access_token, auth in SessionState
- Every state field is reachable through at least one command
- DTOs serialize as snake_case JSON (WebView-friendly)

### 3.2 Preflight deliverable

- This spec document (you are reading it)
- A short AUDIT.md note in `runtime/docs/PHASE3f_AUDIT.md` summarizing
  the green build + the 6 invariants above

NO Rust edits in Pass A. The kernel is hermetic and correct.

---

## 4. WebView Adapter (Pass B) — Build plan

### 4.1 Files to create (4 new files, ~250-350 LOC total)

All under `src/lib/ipc/` — NEW directory. Lives below the React layer
and above the Tauri runtime. No React imports anywhere in this tree.

#### 4.1.1 `src/lib/ipc/types.ts` (~80-100 LOC)

Mirrors of the 12 DTOs from `runtime/src-tauri/src/ipc/types.rs`:

```typescript
// IpcErrorDTO envelope
export interface IpcErrorDTO {
  kind: string;          // RUNTIME_*_ERROR stable codes
  message: string;       // human-readable
}

// Runtime state
export type PhaseDTO =
  | 'cold' | 'configuring' | 'logging' | 'window_init'
  | 'ready' | 'shutting_down' | 'stopped';

export interface RuntimeStateDTO {
  phase: PhaseDTO;
  correlation_id: string;
  booted_at_epoch_secs: number;
}

// Settings
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

// Session
export interface ViewMetadataDTO {
  view_id: string;
  mounted_at_epoch_secs: number;
}

// Window
export interface WindowSizeDTO {
  width: number;
  height: number;
}

// Logging
export interface LogEmitDTO {
  component: string;
  event: string;
  fields: Record<string, string>;
}

// Config
export type EnvDTO = 'dev' | 'staging' | 'prod';
export interface WindowConfigDTO {
  title: string;
  width: number;
  height: number;
  min_width: number;
  min_height: number;
  resizable: boolean;
}
export interface ConfigDTO {
  env: EnvDTO;
  window: WindowConfigDTO;
  logging: { /* LoggingConfig mirror — see types.rs:295 */ };
}
```

Contract: these are TYPE-ONLY mirrors of the Rust DTOs. Field naming
matches Rust snake_case (NOT camelCase) so JSON marshaling is direct.

#### 4.1.2 `src/lib/ipc/errors.ts` (~40-60 LOC)

```typescript
import type { IpcErrorDTO } from './types';

export const RUNTIME_ERROR_KINDS = {
  STARTUP: 'RUNTIME_STARTUP_ERROR',
  SHUTDOWN: 'RUNTIME_SHUTDOWN_ERROR',
  CONFIG: 'RUNTIME_CONFIG_ERROR',
  STATE: 'RUNTIME_STATE_ERROR',
  WINDOW: 'RUNTIME_WINDOW_ERROR',
  IPC: 'RUNTIME_IPC_ERROR',
  FILESYSTEM: 'RUNTIME_FILESYSTEM_ERROR',
  PLUGIN: 'RUNTIME_PLUGIN_ERROR',
  SERIALIZATION: 'RUNTIME_SERIALIZATION_ERROR',
  OBSERVABILITY: 'RUNTIME_OBSERVABILITY_ERROR',
  INTERNAL: 'RUNTIME_INTERNAL_ERROR',
} as const;

export type RuntimeErrorKind =
  typeof RUNTIME_ERROR_KINDS[keyof typeof RUNTIME_ERROR_KINDS];

export class IpcError extends Error {
  readonly kind: string;
  constructor(dto: IpcErrorDTO) {
    super(dto.message);
    this.name = 'IpcError';
    this.kind = dto.kind;
  }

  static isRuntimeError(e: unknown): e is IpcError {
    return e instanceof IpcError;
  }

  // Stable-code helpers — match on kind, not message
  is(kind: RuntimeErrorKind): boolean {
    return this.kind === kind;
  }
}

// WebView-side detection: are we running inside Tauri or in a browser?
export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined'
    && '__TAURI_INTERNALS__' in window;
}
```

Contract: `IpcError` is the typed envelope the React/Svelte layer
catches. `isTauriRuntime()` lets the layer fall back to no-op stubs
when running outside the desktop runtime (dev mode in browser).

#### 4.1.3 `src/lib/ipc/client.ts` (~30-50 LOC)

```typescript
import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import type { IpcErrorDTO } from './types';
import { IpcError, isTauriRuntime } from './errors';

export interface InvokeOptions {
  // Future: timeout, retry policy, correlation_id override
}

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
    const dto = raw as IpcErrorDTO;
    if (dto && typeof dto.kind === 'string' && typeof dto.message === 'string') {
      throw new IpcError(dto);
    }
    throw new IpcError({
      kind: 'RUNTIME_INTERNAL_ERROR',
      message: String(raw),
    });
  }
}
```

Contract: single chokepoint for every IPC call. Rejects outside
Tauri with a typed error. Converts raw rejection into `IpcError`.

**Dependency**: `@tauri-apps/api`. Must be added to package.json.

#### 4.1.4 `src/lib/ipc/commands.ts` (~150-200 LOC)

21 typed wrappers, one per command. Grouped by domain (mirrors the
section headers in `commands.rs`):

```typescript
import type {
  RuntimeStateDTO, PhaseDTO, SettingsStateDTO, ThemeDTO,
  WindowPrefsDTO, ViewMetadataDTO, WindowSizeDTO,
  LogEmitDTO, EnvDTO, ConfigDTO,
} from './types';
import { invoke } from './client';

// Runtime state
export const runtimeGetState         = ()                          => invoke<RuntimeStateDTO>('runtime_get_state');
export const runtimeGetPhase         = ()                          => invoke<PhaseDTO>('runtime_get_phase');
export const runtimeGetCorrelationId = ()                          => invoke<string>('runtime_get_correlation_id');

// Window management
export const windowMinimize     = ()                          => invoke<void>('window_minimize');
export const windowMaximize     = ()                          => invoke<void>('window_maximize');
export const windowUnmaximize   = ()                          => invoke<void>('window_unmaximize');
export const windowClose        = ()                          => invoke<void>('window_close');
export const windowSetTitle     = (title: string)             => invoke<void>('window_set_title', { title });
export const windowFocus        = ()                          => invoke<void>('window_focus');
export const windowInnerSize    = ()                          => invoke<WindowSizeDTO>('window_inner_size');

// Settings
export const settingsGet              = ()                                  => invoke<SettingsStateDTO>('settings_get');
export const settingsSetTheme         = (theme: ThemeDTO)                   => invoke<void>('settings_set_theme', { theme });
export const settingsSetFontScale     = (scale: number)                     => invoke<void>('settings_set_font_scale', { scale });
export const settingsSetWindowPrefs   = (prefs: WindowPrefsDTO)             => invoke<void>('settings_set_window_prefs', { prefs });

// Session (window session, not auth)
export const sessionGetCurrentView = ()                                  => invoke<ViewMetadataDTO | null>('session_get_current_view');
export const sessionMountView      = (view: ViewMetadataDTO)             => invoke<void>('session_mount_view', { view });
export const sessionUnmountView    = ()                                  => invoke<void>('session_unmount_view');

// Logging
export const logEmitEvent            = (event: LogEmitDTO)               => invoke<void>('log_emit_event', { event });
export const logGetSessionLogPath    = ()                                => invoke<string | null>('log_get_session_log_path');

// Configuration
export const configGetEnv             = ()                                => invoke<EnvDTO>('config_get_env');
export const configGetRuntimeConfig   = ()                                => invoke<ConfigDTO>('config_get_runtime_config');
```

Contract: every function name = snake_case command. Args use camelCase
keys in the args object — Tauri's IPC marshals camelCase→snake_case on
the Rust side automatically (Tauri v2 default behavior).

### 4.2 Files NOT created (boundary enforcement)

- NO React hooks, components, or pages touched
- NO `src/services/`, `src/stores/`, `src/hooks/` modified
- NO `src/lib/bridge/` modified (controllers stay framework-agnostic)
- NO imports of `@tauri-apps/api` outside `src/lib/ipc/`
- NO new dependencies beyond `@tauri-apps/api`

### 4.3 package.json change (one line)

Add `"@tauri-apps/api": "^2.0.0"` to dependencies. Run `npm install`.

---

## 5. Verification Plan

### 5.1 Build verification

```bash
npm install                    # pulls @tauri-apps/api
npm run build                  # Vite production build
cargo test --manifest-path runtime/src-tauri/Cargo.toml --lib
                              # 53 Rust tests still pass
```

Both must be GREEN.

### 5.2 Static checks

```bash
# 1. NO React imports inside src/lib/ipc/
grep -rn "from 'react'\|from \"react\"" src/lib/ipc/ && echo FAIL || echo OK

# 2. NO domain imports inside src/lib/ipc/
grep -rn "src/services\|src/hooks\|src/stores\|src/components\|src/pages" src/lib/ipc/ && echo FAIL || echo OK

# 3. ALL 21 commands are present
grep -c "^export const" src/lib/ipc/commands.ts   # must be 21
```

### 5.3 Type-safety checks (compile-time enforced)

- `PhaseDTO` union has exactly 7 members — matches Rust
- `ThemeDTO` union has exactly 3 members — matches Rust
- `EnvDTO` union has exactly 3 members — matches Rust
- Every wrapper's return type matches its DTO
- `IpcErrorDTO.kind` is `string` (Rust constraint) but
  `RUNTIME_ERROR_KINDS` provides a typed subset for matching

### 5.4 Runtime fallback

In a browser (no `__TAURI_INTERNALS__`):
- All 21 commands throw `IpcError { kind: 'RUNTIME_IPC_ERROR' }`
- This is by design — the adapter is a no-op seam outside desktop
- React layer can catch and ignore (today's behavior continues)

In Tauri runtime:
- Commands marshal JSON over IPC
- Rust IpcErrorDTO becomes JS `IpcError` instance

---

## 6. Out of Scope (explicit)

1. **No Tauri command is actually INVOKED by the React layer in 3f.**
   The adapter exists; consumers come later. Wiring `runtimeGetState`
   into a Settings page is 3g territory or a follow-on phase.

2. **No Svelte migration.** 3g. The adapter is framework-agnostic
   (no React, no Svelte) so both can consume it.

3. **No removal of React, Vite, or any existing UI.** React-frozen
   rule still holds. Pass B is additive only.

4. **No changes to Rust kernel.** The kernel is verified green.
   If preflight finds no issues (which it didn't), no edits there.

5. **No new IPC commands.** The 21 are the Phase 2 contract. Adding
   commands is a separate Phase 2 amendment, not a 3f concern.

---

## 7. Risk Assessment

**Risk: LOW.**

- 4 new files, all in a NEW directory (`src/lib/ipc/`)
- 1 package.json dependency addition
- 0 modifications to existing files (additive only)
- Rust kernel unchanged
- React layer unchanged
- Build path: npm install → vite build, both well-understood
- Worst case: build fails on type mismatch → fix types → rebuild

**No data-loss vectors.** No migrations. No deletions. No state
mutations. This is a typed translation layer between Rust DTOs and
their TS mirrors.

---

## 8. Execution Sequence (when you say "go")

```
Pass A — Preflight (audit-only)
  1. Write runtime/docs/PHASE3f_AUDIT.md summarizing the green audit
  2. STOP. Surface findings to user. Wait for "go".

Pass B — WebView adapter (additive)
  3. mkdir src/lib/ipc/
  4. write src/lib/ipc/types.ts       (DTO mirrors)
  5. write src/lib/ipc/errors.ts      (IpcError + kind helpers)
  6. write src/lib/ipc/client.ts      (invoke<> chokepoint)
  7. write src/lib/ipc/commands.ts    (21 typed wrappers)
  8. patch package.json               (add @tauri-apps/api)
  9. npm install
  10. npm run build                   (must be GREEN)
  11. cargo test --manifest-path ...  (must still be GREEN)
  12. Run static checks (section 5.2)
  13. Surface results. Wait for sign-off → 3g.
```

---

## 9. Sign-off

This spec is awaiting your review. Per the spec-first protocol:

- Spec once → "go" → execute full plan → surface corrections.
- No per-step sign-off during execution.

Reply "go" to execute Pass A → report → then Pass B autonomously.
