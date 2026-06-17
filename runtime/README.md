# runtime/

Rust/Tauri runtime kernel for the systemic refactor program.

**Constitutional basis:** `DOMAIN_PRESERVATION_LAW_001` (root) + `SYSTEMIC_REFACTOR_PROGRAM_V1` (root).

**Current phase:** Phase 1 — Runtime Kernel Construction.

**What lives here:**

| Path | What |
|------|------|
| `src-tauri/` | The Rust/Tauri runtime. The substrate. |
| `contracts/` | Constitutional and program documents that govern this runtime. |
| `docs/` | Execution plans, design notes, decisions. |
| `tests/` | Root-level integration tests (cross-cutting). |
| `archive/` | Historical artifacts (e.g., the pre-runtime TS architecture map). |

**What does NOT live here:**

- The preserved TypeScript platform — that stays in `/src` at the repo root.
- Any business logic, auth logic, Instagram logic, workflow logic, agent logic, queue logic, database logic.

**The runtime serves the platform. The platform does not serve the runtime.**

See `docs/PHASE1_EXECUTION_PLAN.md` for the active execution plan.
