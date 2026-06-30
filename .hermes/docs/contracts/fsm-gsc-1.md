FSM GOVERNANCE AND STATE COHERENCE 1
======================================

Document ID: FSM-GSC-1
Title: WebView FSM as the constitutional bridge between dashboard and backend runtime
Effective: 2026-06-30 (DRAFT — awaiting sign-off)
Supersedes in part: PHASE 1 closure (Rust-kernel-as-constitutional-seam) is downgraded to desktop substrate. PHASE 2 IPC typed-seam is preserved for kernel internal use. PHASE 3 layer topology (contracts/controllers/domains/substrates) is preserved.
Parent documents: backend/FEDERATED-GOVERNANCE-ARCHITECTURE.md, backend/DEVELOPMENT-CONTRACT.md, this repo's PHASE3_development-contract.md (sections 1–4, 9).
In force: DOMAIN_PRESERVATION_LAW.md (tiers revised: React tier is retired, Svelte tier is the frozen presentation surface).

0. Mission

The WebView FSM is the constitutional bridge between dashboard and backend runtime. It does not replace the backend's Constitutional Kernel. It is the WebView-side authority that:
- Consumes substrate and controller emissions inside the WebView
- Computes bounded lifecycle transitions for state the WebView owns
- Emits transitions to the backend's Constitutional Kernel, which writes them to the Redis lineage ledger
- Exposes projections to the Svelte shell via the existing controllers

It collapses semantic authority toward the backend by making the backend's Constitutional Kernel the sole legality authority for all cross-boundary mutations. The WebView FSM is a mirror, not a sovereign.

1. Scope

1.1 In scope
- WebView FSM body at runtime/src-tauri/lib/fsm/ (TS).
- Local mutable telemetry plane at runtime/src-tauri/lib/fsm/telemetry/ (TS, in-memory).
- Bounded-worker retry substrate at runtime/src-tauri/lib/fsm/workers/ (TS).
- Emission points added to existing runtime/src-tauri/lib/substrates/ and runtime/src-tauri/lib/controllers/ (no behaviour changes, only emit hooks).
- WebView-to-backend transport for FSM transitions: typed boundary at runtime/src-tauri/lib/fsm/transport/ (TS).
- Vocabulary alignment with backend's control-plane/ (HSM, constitutional kernel, lineage ledger, domain FSM, bounded worker, substrate).

1.2 Out of scope (explicit)
- Rust kernel changes. The kernel keeps its 21 IPC commands and IpcResult<DTO> seam as-is. The kernel does not gain FSM awareness.
- Svelte shell changes. The shell stays frozen. The shell consumes FSM projections via controllers only.
- Backend changes. The Constitutional Kernel and Lineage Ledger are owned by the backend repo.
- Agent (instagram-automation-agent) changes. The agent remains outside this repo's call path.
- Redis client introduction. WebView FSM does not talk to Redis directly. It talks to backend's Constitutional Kernel. Backend owns the Redis write path.
- Postgres changes. Postgres is durability in the backend. Not a contract surface from this repo's perspective.
- Direct IG calls from this repo. IG traffic flows: WebView FSM emits intent → backend Constitutional Kernel → graph-capability kernel → Meta API. WebView FSM is never in the IG transport path.
- Supabase Realtime subscriptions from this repo. Where realtime is needed, it is consumed via Supabase client directly (already a substrate). The FSM does not mediate realtime.

2. Constitutional Delegation Chain


WebView (Svelte shell)
        ↓ consumes projections
WebView Controllers (runtime/src-tauri/lib/controllers/)
        ↓ consumes domain events
WebView FSM (runtime/src-tauri/lib/fsm/)
        ↓ emits AcquisitionIntent-shaped transitions
Backend Constitutional Kernel (control-plane/governance/constitutional-kernel.js)
        ↓ routes to domain FSMs
Backend Domain FSMs (acquisition/publishing/scheduling FSMs, plus graph-capability, retry-cadence, telemetry, etc.)
        ↓ transports
Substrates (backend substrates/, semantically blind)
        ↓ persists
Redis Lineage Ledger (canonical truth) + Postgres (durability)


The WebView FSM's transition table shape mirrors the backend's DOMAIN_EVENT_MAP. No new vocabulary is invented. The 15 backend events (acquisition/publishing/scheduling) become the WebView FSM's transition inputs. The WebView FSM adds 0 new event types — it only consumes and emits.

3. The FSM Layer — runtime/src-tauri/lib/fsm/

3.1 Folder structure

runtime/src-tauri/lib/fsm/
  contracts/        — transition table types, event taxonomy types (mirrors backend constitutional-kernel.js contract)
  state/            — bounded FSM state machine per domain the WebView owns (agent-health, oversight, queue, terminal-keyboard, attribution)
  telemetry/        — local mutable plane the FSM writes to before flushing
  workers/          — bounded retry workers (TS, no node:worker_threads — uses async generators)
  transport/        — typed boundary to backend Constitutional Kernel
  index.ts          — public surface barrel


3.2 What the FSM owns
- Lifecycle states per domain the WebView cares about (agent-health: IDLE/POLLING/STALE/DOWN; oversight: DISCONNECTED/CONNECTING/CONNECTED/STREAMING/CLOSED; queue: IDLE/OBSERVING/RETRYING/DEGRADED; terminal-keyboard: IDLE/INPUT_FOCUSED/COMMAND_HISTORY_OPEN; attribution: IDLE/EVALUATING/PENDING).
- Transition guards per domain.
- Local error state and retry intent.
- Projection emission to controllers (existing slot pattern, no contract changes for controllers).
- Transition emission to backend via the transport boundary.

3.3 What the FSM does NOT own
- IG transport. Forbidden.
- Supabase persistence. Forbidden.
- Realtime subscriptions. Forbidden.
- Cross-WebView-instance coordination. Forbidden (single-window model).
- Domain FSM lifecycle beyond the WebView's local mirror (the backend's domain FSMs are the authority).

3.4 Vocabulary alignment (non-negotiable names from backend)
- Constitutional Kernel → backend's constitutional-kernel.js. WebView FSM is NOT this.
- HSM (Hierarchical State Machine) → refers ONLY to backend's constitutional-kernel.js. Do not use "HSM" for the WebView FSM.
- Lineage Ledger → backend's lineage-ledger.js, Redis-backed, key lineage:ledger:entries. WebView FSM does not write here directly.
- Domain FSM → backend's per-domain FSM (acquisition, publishing, scheduling). WebView FSM has its OWN bounded state machines; they are not "domain FSMs" in the backend sense. They are "WebView FSM state machines."
- Substrate → semantically blind infrastructure (backend substrates/). The WebView's substrates/ folder is TS substrate adapters, conceptually equivalent.
- Bounded Worker → a non-agentic execution unit. Backend has workers/; WebView FSM has fsm/workers/. Same concept.
- AcquisitionIntent → the canonical inter-repo transition shape (see backend DEVELOPMENT-CONTRACT.md §3). WebView FSM emits transitions in this shape.
- Constitutional Status → PENDING → ACCEPTED | REJECTED, on every ledger entry. WebView FSM tracks this for transitions it has emitted.

4. Local Mutable Telemetry Plane — runtime/src-tauri/lib/fsm/telemetry/

4.1 Purpose
The FSM writes transitions to a local in-memory plane first. This is the "stabilisation plane" — it absorbs bursty emissions, provides a queryable surface for projections, and buffers writes to the backend. It is NOT canonical. Canonical truth lives in the backend's Redis lineage ledger.

4.2 Shape
- Append-only ring buffer per domain state machine. Bounded size (default 1024 entries per domain). When full, oldest entries are dropped locally; the backend ledger has them.
- Read API: getRecentTransitions(domain, n), getCurrentState(domain), getTransitionById(id).
- Write API: recordTransition(domain, transition) — synchronous, in-memory only.
- Flush API: flushPending() — drains pending entries to backend via transport. Returns ack/nack from backend.
- Recovery: on boot, the local plane is empty. State is reconstructed from backend's lineage ledger via the transport's rehydrate() call. The WebView FSM NEVER trusts local state across reboots.

4.3 Invariants
- Local plane is a projection. If it disagrees with backend lineage, backend wins.
- Writes to local plane are synchronous. Writes to backend are async, fire-and-forget with ack tracking.
- No local plane entry is mutated after write. Append-only.

5. Bounded Worker Substrate — runtime/src-tauri/lib/fsm/workers/

5.1 Purpose
Retries and local fallback execution happen in bounded workers. The FSM does not perform outbound work itself. When a transition lands the FSM in RETRYING or DEGRADED, the FSM emits a retry intent; a bounded worker consumes it and performs the actual retry or local fallback.

5.2 Shape
- Pool of N async generators (default N = 4). Each generator is a bounded worker.
- Each worker consumes intents from a bounded queue (default 64 entries). Backpressure: when full, FSM transitions to DEGRADED.
- Each worker is non-agentic. It does not decide retry policy. The FSM decides. The worker executes.
- Worker emits completion or failure events back to the FSM via the same emission channel substrates/controllers use.
- Workers do not talk to IG. Workers do not talk to Supabase directly. Workers talk to existing substrates (auth, future supabase-realtime substrate, future http substrate).

5.3 Invariants
- Workers are bounded. If a worker is starved, the FSM observes and emits a DEGRADED transition.
- Workers are stateless. They hold no state between intents. The FSM holds all state.
- Workers are observable. Every intent has a correlation ID, traced into local plane and emitted to backend.

6. Emission Points — runtime/src-tauri/lib/substrates/, controllers/

6.1 What changes
Each existing substrate and controller gains a single emit hook at every existing public call. The hook is fire-and-forget; it does not affect the substrate's return value. The hook writes to the local telemetry plane.

6.2 What does NOT change
- No substrate's behaviour, return shape, or contract changes.
- No controller's reactive surface, slot pattern, or projection shape changes.
- No contract module (contracts/) changes.
- No domain module (domains/) changes.

6.3 Pattern (one new file per substrate/controller, plus one inline call)
- runtime/src-tauri/lib/substrates/auth/emissions.ts — wraps auth calls, emits events.
- runtime/src-tauri/lib/controllers/agent/health.emissions.ts — wraps health polls, emits events.
- ... one per existing substrate/controller.
- All emission files import from runtime/src-tauri/lib/fsm/contracts/ for the event shape.
- All emission files call runtime/src-tauri/lib/fsm/telemetry/recordTransition().

7. Backend Transport Boundary — runtime/src-tauri/lib/fsm/transport/

7.1 Shape
- One TypeScript file: backend.ts.
- Public API: emitTransition(transition): Promise<ConstitutionalAck>, rehydrate(): Promise<WebViewStateProjection>.
- Implementation: HTTP POST to backend's Constitutional Kernel endpoint. Endpoint URL from environment variable (VITE_BACKEND_CONSTITUTIONAL_URL, added to .env.development / .env.production).
- Error handling: timeout, retry-via-worker, terminal failure emits DEGRADED to local plane.

7.2 Endpoint contract (to be confirmed against backend's actual route)
The backend's Constitutional Kernel exposes a transition endpoint. Per backend DEVELOPMENT-CONTRACT.md §3, the canonical shape is AcquisitionIntent-shaped. The WebView FSM emits transitions in this shape with one adaptation: the intent_type field is replaced by the WebView's domain name (agent-health / oversight / queue / terminal-keyboard / attribution), and a new field domain_owner: "webview" is added so the backend Constitutional Kernel can route WebView-originated transitions to the correct domain FSM.

7.3 Open question §12.1: confirm endpoint name in backend. The backend constitutional-kernel.js has not been read for HTTP route exposure. The WebView FSM contract assumes a POST endpoint exists at /constitutional/transition (placeholder). Confirm or correct.

8. Four-Pass Execution Plan

Each pass has a single objective, single verification, single success condition: build green at pass boundary.

Pass 1 — FSM layer scaffolding
- Create runtime/src-tauri/lib/fsm/ tree (contracts, state, telemetry, workers, transport, index.ts).
- Author transition table types per domain (agent-health, oversight, queue, terminal-keyboard, attribution) — types only, no behaviour.
- Author event taxonomy types — types only.
- Author local telemetry plane types — types only.
- Author bounded worker types — types only.
- Author transport boundary types — types only.
- Gate: npm run build green, npx tsc --noEmit zero errors.

Pass 2 — Local mutable telemetry plane + bounded workers
- Implement runtime/src-tauri/lib/fsm/telemetry/ring-buffer.ts (bounded, append-only).
- Implement runtime/src-tauri/lib/fsm/workers/pool.ts (async generator pool).
- Implement state machines per domain — read-only initially, emit to local plane only.
- Gate: npm run build green. New unit tests: ring buffer drops oldest on overflow, worker pool bounded under burst, FSM transitions record to plane.

Pass 3 — Emission points in substrates and controllers
- Add emissions.ts file per existing substrate (auth) and per controller (8 controllers).
- Wire inline emit hook at every public call site.
- No behaviour changes. No contract changes. No return shape changes.
- Gate: npm run build green. New regression test: every existing substrate/controller call produces one local plane entry per call.

Pass 4 — Backend transport
- Implement runtime/src-tauri/lib/fsm/transport/backend.ts.
- Add VITE_BACKEND_CONSTITUTIONAL_URL to .env.development and .env.production.
- Wire FSM's flushPending() to call transport on debounced interval (default 2 seconds).
- Wire FSM's rehydrate() on boot.
- Gate: npm run build green. Manual test: backend Constitutional Kernel receives the transition in the expected shape.

Pass 5 (conditional) — Backend dependency
- If backend Constitutional Kernel does NOT yet expose the transition endpoint, this pass becomes a backend change request, NOT a WebView change. The WebView FSM is not blocked on the backend; the transport falls back to local-only mode and surfaces DEGRADED until the backend endpoint is live.
- Trigger condition: Pass 4 manual test fails because backend endpoint returns 404.

9. What This Plan Does NOT Do

1. Does not introduce Redis as a WebView dependency.
2. Does not introduce Express as a WebView dependency.
3. Does not introduce direct IG traffic from WebView.
4. Does not modify the Rust kernel.
5. Does not modify the Svelte shell.
6. Does not modify any substrate's contract.
7. Does not modify any controller's reactive surface.
8. Does not modify any existing IPC command.
9. Does not modify the auth substrate's flow.
10. Does not stage any commits. (Per user's standing rule: commits are user's job.)

10. Invariants Preserved

- IP1. Rust kernel is hermetic. No FSM awareness leaks into kernel.
- IP2. Svelte shell is frozen. No FSM API leaks into presentation.
- IP3. Every existing substrate's contract is unchanged.
- IP4. Every existing controller's slot/subscribe pattern is unchanged.
- IP5. Local telemetry plane is a projection. Backend ledger is canonical.
- IP6. Vocabulary mirrors backend. No new terms introduced.
- IP7. WebView FSM never performs outbound work directly. Workers perform work.
- IP8. Workers are non-agentic. FSM owns all decisions.
- IP9. Workers are bounded. FSM observes starvation and emits DEGRADED.
- IP10. All FSM transitions are traceable via correlation ID from emission to backend ledger ack.

11. End-of-Plan Verification Gates

- G1. npm run build green.
- G2. cargo check clean.
- G3. cargo test 53/53 green.
- G4. npx tsc --noEmit zero errors.
- G5. New unit tests pass: ring buffer overflow, worker starvation, FSM transition correctness, transport ack handling, rehydrate on boot.
- G6. No new dependency in package.json without explicit sign-off.
- G7. No file in src/lib/svelte/, src/main.ts, index.html, vite.config.ts is modified.
- G8. No file in runtime/src-tauri/src/** is modified.
- G9. Every existing substrate and controller has a paired emissions.ts file under its folder.
- G10. Backend transport round-trip test (manual, against staging backend) succeeds for at least one transition per domain.

12. Open Questions for Sign-Off

1. Confirm backend Constitutional Kernel HTTP endpoint name and shape. Assumed POST /constitutional/transition with AcquisitionIntent-derived body. Confirm or correct.
2. Confirm the 5 WebView-owned domains (agent-health, oversight, queue, terminal-keyboard, attribution). Any additions or removals?
3. Confirm bounded worker pool size (proposed 4) and bounded queue size (proposed 64).
4. Confirm local telemetry ring buffer size per domain (proposed 1024).
5. Confirm environment variable name VITE_BACKEND_CONSTITUTIONAL_URL.
6. Confirm flush debounce interval (proposed 2 seconds).
7. Confirm that Pass 5 (backend dependency) is acceptable as a "local-only fallback" condition, not a blocker.
8. Confirm vocabulary alignment: this contract does not introduce any new term. All FSM-layer names are either derived from existing TS layer vocabulary or mirrored from backend's constitutional-kernel.js / FEDERATED-GOVERNANCE-ARCHITECTURE.md. If a new term is needed, surface it here before adding.

13. Sign-Off

This contract awaits your "go" or corrections. Per protocol:
- Contract once → "go" → execute full plan → surface corrections.
- No per-step sign-off during execution.
- I will STOP at the first build/test failure and surface it.
- I will not commit any change. Commits are your job.
- I will not introduce any dependency without explicit sign-off.