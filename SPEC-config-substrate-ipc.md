# SPEC: IPC-Backed Config Substrate — Eliminate `import.meta.env.VITE_*` Usage

**Status**: Ready for Implementation  
**Scope**: Rust kernel config extension + TypeScript substrate in `lib/substrates/config/`  
**Affects**: 13 files using `import.meta.env.VITE_*`

---

## PROBLEM STATEMENT

The codebase has **13 usages of `import.meta.env.VITE_*`** across 5 files:

| Env Var | Files | Count |
|---------|-------|-------|
| `VITE_API_BASE_URL` | `controllers/oversight/chat.ts`, `controllers/analytics/content.ts`, `domains/agent/health.service.ts`, `domains/agent/queue-monitor.service.ts` | 4 |
| `VITE_SUPABASE_URL` | `substrates/supabase/client.ts`, `substrates/supabase/connection-test.ts` | 2 |
| `VITE_SUPABASE_TUNNEL_URL` | `substrates/supabase/client.ts`, `substrates/supabase/connection-test.ts` | 2 |
| `VITE_SUPABASE_DIRECT_URL` | `substrates/supabase/client.ts`, `substrates/supabase/connection-test.ts` | 2 |
| `VITE_SUPABASE_ANON_KEY` | `substrates/supabase/client.ts` | 1 |
| `VITE_ENVIRONMENT` | `substrates/supabase/client.ts` | 1 |
| `VITE_ADMIN_EMAIL` | `domains/identity/dev-admin.policy.ts` (comment only) | 0 |

This is a **systemic type-safety violation** — Vite's `import.meta.env` types are not available in the Tauri compilation context, causing 38+ TS errors.

---

## ARCHITECTURE: IPC-BACKED CONFIG SUBSTRATE

```
┌─────────────────────────────────────────────────────────────────┐
│                        RUST KERNEL                               │
│  Config::Config  ──(IPC)──►  ConfigDTO (extended)               │
│  - environment: Environment                                      │
│  - window: WindowConfig                                          │
│  - logging: LoggingConfig                                        │
│  - runtime: RuntimeConfig                                        │
│  - frontend: FrontendConfig         ← NEW                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ IPC: config_get_runtime_config
┌─────────────────────────────────────────────────────────────────┐
│                  TS SUBSTRATE: lib/substrates/config/           │
│  config.ts ──► RuntimeConfig singleton with typed getters       │
│  - getApiBaseUrl(): string                                      │
│  - getSupabaseConfig(): { url, tunnelUrl, directUrl, anonKey }  │
│  - getEnvironment(): 'dev' | 'staging' | 'prod'                 │
│  - getAdminEmail(): string | null                               │
│  - ready: Promise<void>  (resolves after IPC fetch)             │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        controllers/*    domains/*      substrates/*
```

---

## RUST CHANGES

### 1. Extend `Config` in `src/config/config.rs`

```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Config {
    pub environment: Environment,
    pub window: WindowConfig,
    pub logging: LoggingConfig,
    pub runtime: RuntimeConfig,
    pub frontend: FrontendConfig,      // NEW
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FrontendConfig {
    pub api_base_url: String,
    pub supabase_url: String,
    pub supabase_tunnel_url: Option<String>,
    pub supabase_direct_url: Option<String>,
    pub supabase_anon_key: String,
    pub admin_email: Option<String>,
}

impl Default for FrontendConfig {
    fn default() -> Self {
        Self {
            api_base_url: "https://api.888intelligenceautomation.in".into(),
            supabase_url: "".into(),           // required — validated
            supabase_tunnel_url: None,
            supabase_direct_url: None,
            supabase_anon_key: "".into(),      // required — validated
            admin_email: None,
        }
    }
}
```

### 2. Extend `ConfigDTO` in `src/ipc/types.rs`

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigDTO {
    pub env: EnvDTO,
    pub window: WindowConfigDTO,
    pub logging: LoggingConfigDTO,
    pub frontend: FrontendConfigDTO,      // NEW
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FrontendConfigDTO {
    pub api_base_url: String,
    pub supabase_url: String,
    pub supabase_tunnel_url: Option<String>,
    pub supabase_direct_url: Option<String>,
    pub supabase_anon_key: String,
    pub admin_email: Option<String>,
}

impl From<crate::config::config::FrontendConfig> for FrontendConfigDTO {
    fn from(f: crate::config::config::FrontendConfig) -> Self {
        Self {
            api_base_url: f.api_base_url,
            supabase_url: f.supabase_url,
            supabase_tunnel_url: f.supabase_tunnel_url,
            supabase_direct_url: f.supabase_direct_url,
            supabase_anon_key: f.supabase_anon_key,
            admin_email: f.admin_email,
        }
    }
}
```

### 3. Update `ConfigDTO::from` impl to include `frontend`

```rust
impl From<crate::config::config::Config> for ConfigDTO {
    fn from(c: crate::config::config::Config) -> Self {
        Self {
            env: c.environment.into(),
            window: c.window.into(),
            logging: c.logging.into(),
            frontend: c.frontend.into(),    // NEW
        }
    }
}
```

### 4. Add validation in `src/config/validation.rs`

```rust
pub fn validate(config: &Config) -> RuntimeResult<()> {
    // ... existing validation ...
    
    // Frontend config validation
    if config.frontend.api_base_url.is_empty() {
        return Err(RuntimeError::config("frontend.api_base_url is required"));
    }
    if config.frontend.supabase_url.is_empty() {
        return Err(RuntimeError::config("frontend.supabase_url is required"));
    }
    if config.frontend.supabase_anon_key.is_empty() {
        return Err(RuntimeError::config("frontend.supabase_anon_key is required"));
    }
    Ok(())
}
```

### 5. Update test in `src/ipc/types.rs` — `config_dto_wire_does_not_leak_stdout`

Extend assertion to verify `frontend` field is present with correct shape.

---

## TYPESCRIPT CHANGES

### 1. New Contract: `contracts/ipc/frontend-config.contract.ts`

```typescript
export interface FrontendConfigDTO {
  api_base_url: string;
  supabase_url: string;
  supabase_tunnel_url: string | null;
  supabase_direct_url: string | null;
  supabase_anon_key: string;
  admin_email: string | null;
}

export interface ConfigDTO {
  env: EnvDTO;
  window: WindowConfigDTO;
  logging: LoggingConfigDTO;
  frontend: FrontendConfigDTO;
}
```

### 2. New Substrate: `substrates/config/index.ts`

```typescript
/**
 * substrates/config/index.ts
 * 
 * IPC-backed runtime config substrate. Fetches config from Rust kernel
 * on module initialization. All config consumers import from here.
 * 
 * Usage:
 *   import { getApiBaseUrl, getSupabaseConfig, configReady } from '@/substrates/config';
 * 
 *   // At app startup:
 *   await configReady;
 *   const apiBase = getApiBaseUrl();
 */
import { invoke } from '../ipc/client';
import type { ConfigDTO } from '../../contracts/ipc/config.contract';
import type { FrontendConfigDTO } from '../../contracts/ipc/frontend-config.contract';

// ─────────────────────────────────────────────────────────────────
// Internal state
// ─────────────────────────────────────────────────────────────────

let cachedConfig: FrontendConfigDTO | null = null;
let initPromise: Promise<void> | null = null;

// ─────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────

/** Resolves when config has been fetched from kernel. */
export const configReady: Promise<void> = (async () => {
  if (initPromise) return initPromise;
  
  initPromise = (async () => {
    try {
      const dto = await invoke<ConfigDTO>('config_get_runtime_config', {});
      cachedConfig = dto.frontend;
    } catch (err) {
      console.error('[config substrate] Failed to fetch config from kernel:', err);
      // Fallback to env vars for browser dev mode (non-Tauri)
      cachedConfig = {
        api_base_url: import.meta.env?.VITE_API_BASE_URL ?? 'https://api.888intelligenceautomation.in',
        supabase_url: import.meta.env?.VITE_SUPABASE_URL ?? '',
        supabase_tunnel_url: import.meta.env?.VITE_SUPABASE_TUNNEL_URL ?? null,
        supabase_direct_url: import.meta.env?.VITE_SUPABASE_DIRECT_URL ?? null,
        supabase_anon_key: import.meta.env?.VITE_SUPABASE_ANON_KEY ?? '',
        admin_email: import.meta.env?.VITE_ADMIN_EMAIL ?? null,
      };
    }
  })();
  
  return initPromise;
})();

/** Get API base URL (oversight chat, health, queue-monitor, content analytics). */
export function getApiBaseUrl(): string {
  if (!cachedConfig) {
    throw new Error('[config substrate] configReady not awaited — call await configReady first');
  }
  return cachedConfig.api_base_url;
}

/** Get Supabase connection config (client, connection-test). */
export function getSupabaseConfig(): {
  url: string;
  tunnelUrl: string | null;
  directUrl: string | null;
  anonKey: string;
} {
  if (!cachedConfig) {
    throw new Error('[config substrate] configReady not awaited');
  }
  return {
    url: cachedConfig.supabase_url,
    tunnelUrl: cachedConfig.supabase_tunnel_url,
    directUrl: cachedConfig.supabase_direct_url,
    anonKey: cachedConfig.supabase_anon_key,
  };
}

/** Get environment (dev | staging | prod). */
export function getEnvironment(): 'dev' | 'staging' | 'prod' {
  if (!cachedConfig) {
    throw new Error('[config substrate] configReady not awaited');
  }
  // Map from kernel's EnvDTO
  return cachedConfig.supabase_url.includes('staging') ? 'staging' 
       : cachedConfig.supabase_url.includes('prod') ? 'prod' 
       : 'dev';
}

/** Get admin email for dev-admin policy. */
export function getAdminEmail(): string | null {
  if (!cachedConfig) {
    throw new Error('[config substrate] configReady not awaited');
  }
  return cachedConfig.admin_email;
}
```

### 3. Update `substrates/supabase/client.ts`

---

## MIGRATION PLAN — FILE BY FILE

### Phase 1: Rust Kernel (do first, blocks TS)

| File | Change |
|------|--------|
| `src/config/config.rs` | Add `FrontendConfig` struct + add to `Config` |
| `src/config/validation.rs` | Validate frontend fields |
| `src/ipc/types.rs` | Add `FrontendConfigDTO`, extend `ConfigDTO`, update `From<Config>` |
| `src/ipc/types.rs` tests | Extend wire-shape test |

### Phase 2: TS Contracts + Substrate

| File | Change |
|------|--------|
| `contracts/ipc/frontend-config.contract.ts` | NEW — `FrontendConfigDTO` |
| `contracts/ipc/config.contract.ts` | Extend `ConfigDTO` with `frontend` |
| `substrates/config/index.ts` | NEW — config substrate with `configReady`, typed getters |
| `substrates/config/__tests__/config.substrate.test.ts` | NEW — unit tests |

### Phase 3: Call Site Migration (13 usages)

| File | Old Pattern | New Import | New Usage |
|------|-------------|------------|-----------|
| `controllers/oversight/chat.ts:76-77` | `import.meta.env.VITE_API_BASE_URL \|\| '...'` | `import { getApiBaseUrl, configReady } from '@/substrates/config'` | `const API_BASE = getApiBaseUrl();` (after `await configReady`) |
| `controllers/analytics/content.ts:112-113` | same | same | same |
| `domains/agent/health.service.ts:31` | same | same | same |
| `domains/agent/queue-monitor.service.ts:27-29` | `getApiBase()` function | same | same |
| `substrates/supabase/client.ts:24-29,51` | 5× `import.meta.env.VITE_*` | `import { getSupabaseConfig, getEnvironment, configReady }` | `const { url, tunnelUrl, directUrl, anonKey } = getSupabaseConfig();` |
| `substrates/supabase/connection-test.ts:25-28` | 3× `import.meta.env.VITE_SUPABASE_*` | same | same |
| `domains/identity/dev-admin.policy.ts` | comment only | `import { getAdminEmail }` | `getAdminEmail()` |

### Phase 4: App Bootstrap

| File | Change |
|------|--------|
| `src/main.ts` (or Svelte equivalent) | `await configReady` before mounting app |

---

## TAURI BUILD CONFIG

The `vite-env.d.ts` at root provides `/// <reference types="vite/client" />`. After migration, **this can be removed** from all migrated files. Keep only for any remaining Vite-only code.

---

## VALIDATION CHECKLIST

- [ ] Rust `cargo test` passes (75/75 + new config tests)
- [ ] TS `npm run build` passes (0 errors)
- [ ] All 13 `import.meta.env.VITE_*` usages eliminated
- [ ] `substrates/supabase/client.ts` initializes with kernel config
- [ ] `configReady` resolves in Tauri, falls back to env in browser dev
- [ ] No duplicate fallback strings — single source of truth in Rust `FrontendConfig::default()`

---

## ROLLBACK PLAN

If IPC fails in production:
1. Substrate falls back to `import.meta.env` (browser dev mode)
2. Rust `FrontendConfig::default()` provides same hardcoded fallbacks
3. No behavior change for end users

---

**Approval Required**: Confirm this spec matches your intent before implementation begins.