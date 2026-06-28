# PHASE 3g — Strip React+Vite, Establish Svelte-Only WebView (Execution Plan)

**Version:** 1.0
**Program:** Systemic Refactor Initiative
**Status:** DRAFT — awaiting user sign-off ("go")
**Parent Documents:**
- `runtime/contracts/PHASE2_development-contract.md` (constitutional seam)
- `runtime/contracts/PHASE3_development-contract.md` (Phase 3 program)
- `runtime/docs/PHASE3f_EXECUTION_PLAN.md` (just-completed WebView adapter)
- User direction (2026-06-28): remove legacy React components; leave Svelte-only

---

## 1. Mission

Replace the legacy React+Vite WebView surface with a Svelte-only
surface. The Rust kernel remains untouched. The Phase 2 IPC seam
(built in Phase 3f) becomes the canonical integration point.

**Goal:** after 3g, the desktop app boots into a Svelte shell that
imports from `src/lib/ipc/` (the Phase 3f adapter). React, Vite,
`@vitejs/plugin-react`, the legacy `App.tsx`, and all `src/components/`,
`src/pages/`, `src/hooks/`, `src/services/`, `src/stores/`, `src/contexts/`,
`src/styles/` bodies are removed.

**Why this is a one-shot purge, not a multi-pass migration:**
The user has determined that the legacy React+Vite layer running on top
of the Rust kernel has caused runtime drift during autonomous contracts.
A phased migration would leave the drift surface active. The fix is a
single coordinated purge with a buildable Svelte replacement shell.

**No new UI is built in 3g.** Per user direction, the Svelte surface
is a minimal shell only. New UI work happens after 3g completes and
the system is in a consistent state.

---

## 2. Constitutional Compliance

### 2.1 Law 1 — Domain preservation

PRESERVED (moved to Rust-owned or to the IPC adapter layer):
- `runtime/src-tauri/lib/domains/` — 8 agent files, 2 identity files,
  1 instagram file, 1 gdpr file — UNTOUCHED. These are pure logic,
  no React, no UI.
- `runtime/src-tauri/lib/contracts/` — types — UNTOUCHED.
- `runtime/src-tauri/lib/substrates/` — I/O + state — UNTOUCHED.
- `runtime/src-tauri/src/` — Rust kernel — UNTOUCHED.

PURGED (legacy React+Vite app):
- `src/App.tsx`, `src/main.tsx`, `src/index.css`, `src/vite-env.d.ts`
- `src/components/` (11 files)
- `src/pages/` (19 files)
- `src/hooks/` (24 files)
- `src/services/` (currently empty post-Phase 3e — but directory purged)
- `src/stores/` (1 file: authStore.ts — superseded by Phase 3c substrate)
- `src/contexts/`
- `src/styles/`
- `src/content/`
- `index.html` (root — Vite entry)
- `vite.config.ts`
- `tailwind.config.*`, `postcss.config.*` (if they exist)
- `tsconfig.json` — REPLACED, not purged (Svelte needs different config)

PRESERVED (moves to the Svelte shell):
- `src/lib/ipc/` — the Phase 3f WebView adapter (4 files, framework-agnostic)

### 2.2 Law 2 — Constitutional seam

The seam (Rust ↔ WebView) does not change. Phase 3f's adapter
(`src/lib/ipc/`) becomes the ONLY integration point the Svelte shell
uses to reach the kernel. No Svelte component imports from `runtime/src-tauri/lib/`
directly — that would re-couple the layers.

### 2.3 Law 3 — Layered architecture (post-3g)

```
┌──────────────────────────────────────────────────────────┐
│  Svelte UI layer (NEW — minimal shell only in 3g)       │
│   src/lib/svelte/ or src/svelte/                        │
│   src/App.svelte, src/main.ts                           │
└──────────────────────────────┬───────────────────────────┘
                               │ imports from
                               ▼
┌──────────────────────────────────────────────────────────┐
│  IPC adapter layer (BUILT IN 3f — UNCHANGED IN 3g)      │
│   src/lib/ipc/                                           │
│   ├─ client.ts                                           │
│   ├─ errors.ts                                           │
│   ├─ commands.ts                                         │
│   └─ types.ts                                            │
└──────────────────────────────┬───────────────────────────┘
                               │ invoke<>() over Tauri IPC
                               ▼
┌──────────────────────────────────────────────────────────┐
│  Rust kernel (Phase 1+2+3f — UNCHANGED IN 3g)           │
│   runtime/src-tauri/src/                                │
└──────────────────────────────────────────────────────────┘

       Preserved domains (runtime/src-tauri/lib/) — unchanged
       In the React/Vite split-architecture, these were reachable
       from React components. In 3g, they are ONLY reachable from
       Rust (via IPC commands, IF such commands exist) — they are
       not yet reachable from the Svelte shell because 3g ships
       a minimal placeholder UI, not real domain consumers.
```

**Mid-flight Phase 3e migrations (15 modified files in runtime/src-tauri/lib/):**
These stay. They are pure-TS modules under runtime/src-tauri/lib/{contracts,domains,substrates}.
React components USED to import them (via src/services/). After 3g:
- The dead imports are gone (services purged).
- The modules themselves remain valid Rust-substrate layer.
- They are NOT orphaned: the Rust kernel can invoke them via
  future IPC commands (out of scope for 3g; not stranded because
  no one was calling them from the React layer anyway — Phase 3e
  already deleted databaseservices.ts (820L dead) because it had
  zero importers).

---

## 3. The Hole Problem (and how 3g solves it)

**The problem:** `tauri.conf.json` ships `frontendDist: "../"` —
Tauri loads the React app's `index.html`. If we delete the React app
without replacing the entry, the desktop app boots to a blank window.

**The 3g solution:**
1. Build a minimal Svelte shell (placeholder UI, no domain logic).
2. Update `tauri.conf.json` to point at the Svelte build output.
3. THEN delete the React+Vite app.
4. Verify: `npm run build` (Svelte) + `cargo build --release` (Rust).

**Why this order:** Vite ships `dist/index.html` for the React app.
Tauri's `frontendDist` will need to point at the Svelte `build/`
output. If we delete React first, we have no working WebView entry
and the desktop app cannot boot. Svelte shell first, then React
removal.

---

## 4. Execution Sequence

### 4.1 Pass 1 — Svelte scaffold (additive, no deletions)

1. Install Svelte toolchain:
   ```
   npm install --save-dev svelte @sveltejs/vite-plugin-svelte vite typescript
   npm install --save-dev @tsconfig/svelte
   npm uninstall react react-dom @vitejs/plugin-react
   npm uninstall @types/react @types/react-dom
   npm uninstall @tanstack/react-query @radix-ui/react-focus-scope
   npm uninstall react-router-dom react-hot-toast framer-motion
   npm uninstall lucide-react recharts zustand @anthropic-ai/sdk
   ```
   Note: `zustand` is used by `runtime/src-tauri/lib/substrates/auth/store.ts`
   (the substrate layer). Do NOT uninstall zustand unless we verify
   the substrate layer can be migrated. OUT OF SCOPE for 3g — leave
   zustand installed.

   Actually — re-check: `substrates/auth/store.ts` imports zustand.
   That file lives in the Rust-runtime's lib/ tree, NOT in the
   React app. Svelte does not touch it. So zustand stays.

   Cleanest removal: uninstall ONLY the React+UI deps. Keep
   zustand (substrate uses it).

2. Create `vite.config.ts` (Svelte variant):
   ```typescript
   import { defineConfig } from 'vite';
   import { svelte } from '@sveltejs/vite-plugin-svelte';
   import path from 'path';

   export default defineConfig({
     plugins: [svelte()],
     resolve: {
       alias: { '@': path.resolve(__dirname, './src') },
     },
     build: {
       outDir: 'dist',
       emptyOutDir: true,
     },
   });
   ```

3. Create `svelte.config.js`:
   ```javascript
   import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
   export default { preprocess: vitePreprocess() };
   ```

4. Create `tsconfig.json` (Svelte variant) — keep `@/*` alias,
   add `svelte` types, drop `react-jsx` jsx setting:
   ```json
   {
     "extends": "@tsconfig/svelte/tsconfig.json",
     "compilerOptions": {
       "baseUrl": ".",
       "paths": { "@/*": ["src/*"] },
       "strict": true,
       "noUnusedLocals": true,
       "noUnusedParameters": true
     },
     "include": ["src/**/*.ts", "src/**/*.svelte"]
   }
   ```

5. Create `src/main.ts` (Svelte entry):
   ```typescript
   import App from './lib/svelte/App.svelte';
   import './lib/svelte/app.css';

   const app = new App({
     target: document.getElementById('app')!,
   });

   export default app;
   ```

6. Create `src/lib/svelte/App.svelte` (minimal shell):
   ```svelte
   <script lang="ts">
     import { onMount } from 'svelte';
     import { runtimeGetState, runtimeGetCorrelationId } from '../ipc/commands';
     import { isTauriRuntime } from '../ipc/errors';

     let phase = 'unknown';
     let correlationId = 'unavailable';
     let runtimeDetected = false;

     onMount(async () => {
       runtimeDetected = isTauriRuntime();
       if (!runtimeDetected) return;
       try {
         const state = await runtimeGetState();
         phase = state.phase;
         correlationId = state.correlation_id;
       } catch (e) {
         console.error('IPC failed:', e);
       }
     });
   </script>

   <main>
     <h1>Automation Kernel — Runtime Shell</h1>
     <p>Phase 3g: Svelte shell. UI to be built in subsequent phases.</p>

     <section>
       <h2>Runtime state</h2>
       <dl>
         <dt>Tauri runtime detected</dt><dd>{runtimeDetected}</dd>
         <dt>Phase</dt><dd>{phase}</dd>
         <dt>Correlation ID</dt><dd>{correlationId}</dd>
       </dl>
     </section>
   </main>
   ```

7. Create `src/lib/svelte/app.css` (minimal):
   ```css
   :root {
     font-family: system-ui, sans-serif;
     color-scheme: light dark;
   }
   main { padding: 2rem; max-width: 60rem; margin: 0 auto; }
   dl { display: grid; grid-template-columns: 12rem 1fr; gap: 0.5rem; }
   ```

8. Update `index.html` (root):
   ```html
   <!doctype html>
   <html lang="en">
     <head>
       <meta charset="utf-8" />
       <meta name="viewport" content="width=device-width, initial-scale=1" />
       <title>Automation Kernel</title>
     </head>
     <body>
       <div id="app"></div>
       <script type="module" src="/src/main.ts"></script>
     </body>
   </html>
   ```

9. Update `tauri.conf.json`:
   ```json
   "build": {
     "beforeDevCommand": "npm run dev",
     "beforeBuildCommand": "npm run build",
     "devUrl": "http://localhost:1420",
     "frontendDist": "../dist"
   }
   ```
   (frontendDist already points to `../`; tighten to `../dist`)

10. Verify: `npm run build` succeeds. The Rust kernel still
    expects `frontendDist`, the Svelte build now produces it.

### 4.2 Pass 2 — React+Vite purge (deletions, no additions)

After Pass 1 builds green, in this exact order:

1. Delete `src/components/` (11 files)
2. Delete `src/pages/` (19 files)
3. Delete `src/hooks/` (24 files)
4. Delete `src/services/` (already empty post-3e — directory purge)
5. Delete `src/stores/` (1 file: authStore.ts — superseded by Phase 3c substrate)
6. Delete `src/contexts/`
7. Delete `src/styles/`
8. Delete `src/content/`
9. Delete `src/App.tsx`, `src/main.tsx` (legacy React entry)
10. Delete `src/index.css`, `src/vite-env.d.ts`
11. Delete legacy `tailwind.config.*`, `postcss.config.*` (if exist)
12. Uninstall React/Vite deps from package.json
13. Verify: `npm run build` still GREEN.
14. Verify: `cargo test --manifest-path runtime/src-tauri/Cargo.toml --lib`
    still 53/53 GREEN.

### 4.3 Pass 3 — Verification

1. `npm run build` → Svelte bundle in `dist/`
2. `cargo test --manifest-path runtime/src-tauri/Cargo.toml --lib` → 53 pass
3. `cargo build --manifest-path runtime/src-tauri/Cargo.toml` → kernel builds
4. `grep -rn "react\|React\|jsx" src/lib/` → must be ZERO matches
5. `ls src/` → must contain ONLY: `lib/` (with `ipc/` + `svelte/` subdirs)
6. `git status --short` → must show only the 3f/3g added files +
   the unstaged 3e migrations (those stay)

---

## 5. Risk Assessment

**Risk: MEDIUM-HIGH** (destructive, but scoped).

Vectors:
1. **Orphaned Phase 3e migrations** — Mitigated: those modules live
   in `runtime/src-tauri/lib/`, NOT in the React app. Purging the
   React app does not strand them. They are ready for Rust IPC
   consumer wiring (future work).
2. **Tauri build entrypoint misconfigured** — Mitigated: Pass 1
   establishes Svelte build output before Pass 2 deletes React.
3. **Tailwind/PostCSS removed but referenced** — Mitigated: the
   Svelte shell ships plain CSS. If a future UI phase needs Tailwind,
   it's added back then.
4. **Hidden React imports in non-obvious files** — Mitigated: Pass 3
   grep-verifies zero React refs in `src/lib/`.

Data-loss vectors: NONE. No database migrations, no destructive
ops on runtime/src-tauri/ or runtime/src-tauri/lib/.

---

## 6. What is NOT in 3g (explicit out-of-scope)

1. **No new domain UI.** The Svelte shell is a placeholder. New
   components/pages are built after 3g when the user is ready.

2. **No Svelte port of the Phase 3f IPC adapter.** The adapter is
   framework-agnostic. It works in Svelte as-is.

3. **No domain IPC commands.** The 21 IPC commands exposed by the
   Rust kernel are kernel-state commands (runtime, window, settings,
   session, logging, config). They are NOT domain commands. Wiring
   domain IPC (auth, agents, queues) is a separate future phase.

4. **No removal of the auth substrate (zustand).** It lives in
   `runtime/src-tauri/lib/substrates/auth/`. React does not touch it
   anymore (Phase 3c moved it). It stays until a Svelte store
   replacement is built (future phase).

5. **No commits.** Per memory: "Commits are user's job (explicit
   2026-06-28)". 3g leaves the working tree dirty for user review.

---

## 7. Build Verification Matrix

| Check | Pass 1 | Pass 2 | Pass 3 |
|---|---|---|---|
| `npm run build` (Svelte) | ✓ | ✓ | ✓ |
| `cargo test --lib` | (untouched) | (untouched) | ✓ 53/53 |
| React refs in src/lib/ | ✓ 0 | ✓ 0 | ✓ 0 |
| `src/` tree shape | adds svelte/ | deletes legacy | minimal |
| `tauri.conf.json` | updated | unchanged | unchanged |

If ANY check fails: STOP. Surface the failure. Do not proceed to
the next pass.

---

## 8. Sign-off

This spec awaits your review. Per the spec-first protocol:
- Spec once → "go" → execute full plan → surface corrections.
- No per-step sign-off during execution.

Reply "go" to execute Pass 1 → Pass 2 → Pass 3 autonomously.
Pass 1 alone has 10 steps but is mechanical. I will STOP if any
build fails or any boundary check fails.

Mid-flight concern I must flag:
- **15 modified files in runtime/src-tauri/lib/** are unstaged Phase 3e
  work. Per your rule "Do not propose unstaging mixed diffs. Plan
  around staged state" — these stay untouched. 3g does NOT stage
  them, does NOT commit them, does NOT revert them.
