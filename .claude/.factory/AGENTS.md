# AGENTS.md

## Architectural Context

This repository exists inside a much larger distributed orchestration ecosystem that has undergone several major architectural rewrites. Earlier generations of the system were heavily fragmented and suffered from orchestration ambiguity because multiple runtime layers partially owned synchronization and execution behavior simultaneously. Realtime listeners could independently wake execution flows, monitor systems partially influenced synchronization cadence, orchestration graphs recursively triggered more synchronization pressure, and backend systems themselves contained latent orchestration assumptions. Over time this produced severe synchronization debt, duplicated wake behavior, recursive acquisition loops, orchestration drift, unstable retry semantics, and probabilistic runtime topology.

The current architecture represents a deliberate correction away from emergent orchestration and toward deterministic hierarchical governance. The system now operates through bounded runtime layers where orchestration authority, synchronization ownership, cognition, execution, persistence, and visualization are intentionally separated from one another. This separation is not stylistic preference. It is one of the core architectural survival mechanisms of the platform.

AI coding systems operating inside this repository must understand that this project is no longer a traditional automation dashboard or a conventional SaaS application. The platform is evolving toward a deterministic orchestration runtime with bounded cognition layered on top. The architecture now resembles a distributed runtime substrate where synchronization integrity, reconciliation correctness, observability, and orchestration stability are more important than raw feature velocity.

This context is extremely important because modern coding models naturally attempt to optimize systems through abstraction merging, implicit orchestration shortcuts, hidden retries, autonomous synchronization behavior, and convenience-driven coupling. Earlier generations of this platform already demonstrated why those patterns become dangerous at scale. The runtime philosophy now intentionally rejects fragmented authority and emergent orchestration semantics.

All engineering decisions inside this repository should therefore preserve:

* explicit authority boundaries,
* deterministic runtime behavior,
* reconciliation-driven synchronization,
* canonical persistence contracts,
* observability and replayability,
* and stable domain ownership.

The goal of this repository is not maximum autonomy.

The goal is long-term orchestration stability.

---

# Runtime Philosophy

This system should always be approached as a deterministic orchestration platform rather than an autonomous workflow engine.

The architecture intentionally prioritizes explicit governance over emergent behavior. Earlier versions of the system relied heavily on fragmented runtime ownership where synchronization, orchestration, and execution authority were partially distributed across multiple independent systems. Although this initially accelerated development velocity, the architecture became increasingly unstable as cognition complexity increased. The system accumulated hidden orchestration semantics, duplicated synchronization logic, recursive runtime behavior, and probabilistic execution topology.

The current architecture deliberately moves away from those patterns.

Modern coding models often attempt to improve systems by introducing convenience abstractions, autonomous orchestration behavior, hidden background execution, implicit retries, or intelligent synchronization shortcuts. Inside this platform those patterns are considered architectural regression because they slowly reintroduce the exact instability patterns the runtime was rewritten to eliminate.

The runtime is designed around deterministic orchestration, bounded authority, reconciliation-based synchronization, and canonical persistence semantics. Every major subsystem has explicit operational responsibility boundaries and should remain subordinate to those boundaries.

Engineering decisions should therefore optimize for:

* orchestration clarity,
* synchronization integrity,
* replay-safe behavior,
* deterministic execution lineage,
* and observable runtime state.

Short-term convenience should never take priority over long-term orchestration stability.

---

# Runtime Hierarchy

The architecture operates through explicit hierarchical runtime ownership.

The supervisor layer acts as the canonical orchestration authority for the overall runtime. The supervisor owns orchestration correctness, runtime cadence, reconciliation evaluation, synchronization governance, retry semantics, dispatch authorization, and runtime lifecycle management. No subordinate runtime layer should independently reclaim orchestration authority or mutate orchestration cadence outside supervisor-governed behavior.

The synchronization layer owns contextual acquisition integrity. Synchronization is intentionally deterministic and reconciliation-driven. The runtime no longer synchronizes because a timer elapsed or because a graph independently decided more context was required. Synchronization now occurs because the supervisor evaluated contextual degradation and computed deterministic acquisition requirements. The synchronization layer coordinates contextual coherence, acquisition intent generation, and deterministic synchronization governance.

The monitor layer acts as a bounded cognition subsystem. The monitor layer may evaluate runtime conditions, analyze strategic state, and contribute bounded reasoning, but cognition itself does not own orchestration. Monitor systems should never independently dispatch execution, mutate synchronization cadence, trigger orchestration escalation, or reclaim runtime authority. Intelligence inside this platform must remain subordinate to deterministic runtime governance.

Execution systems exist to perform bounded operational work only. Workers process deterministic tasks issued through supervisor-governed execution pathways. Execution workers should remain intentionally non-agentic. They should not independently reason strategically, acquire context, influence orchestration behavior, or mutate synchronization semantics.

The architecture depends on preserving these authority boundaries. When runtime layers begin overlapping responsibilities, orchestration ambiguity and synchronization instability eventually return.

---

# Backend Philosophy

The backend should always be treated as a deterministic acquisition and normalization boundary rather than an orchestration participant.

Historically the backend accumulated orchestration assumptions because earlier generations of the system lacked stable runtime hierarchy. Synchronization logic, wake behavior, graph interaction semantics, fallback execution paths, and orchestration-related coupling gradually leaked into backend infrastructure. Although portions of the backend were later modularized into smaller files and services, many of the underlying architectural assumptions remained legacy-oriented.

The current architecture intentionally rejects those patterns.

The backend now exists primarily to:

* perform deterministic acquisition execution,
* interact with Instagram and external APIs,
* normalize and sanitize external state,
* publish telemetry,
* mutate canonical persistence layers,
* and provide concurrency-safe acquisition infrastructure.

The backend should not:

* own orchestration timing,
* run autonomous synchronization loops,
* independently wake execution,
* evaluate strategic runtime state,
* bypass canonical persistence contracts,
* or directly participate in orchestration semantics.

All cognition inside the runtime should consume canonical persisted state rather than transient infrastructure responses.

The backend rewrite effort should therefore focus on deterministic infrastructure reliability rather than orchestration intelligence.

---

# Frontend Philosophy

The frontend repository exists as an operational visualization and interaction surface.

The frontend should provide:

* runtime visibility,
* telemetry inspection,
* orchestration observability,
* management interfaces,
* and bounded operator interaction.

The frontend should not behave like an orchestration participant.

Historically frontend systems often accumulate hidden orchestration assumptions over time through retries, synchronization workarounds, fallback execution paths, implicit polling behavior, or runtime convenience abstractions. Those patterns slowly reintroduce fragmented orchestration ownership across the system.

This architecture intentionally separates visualization from orchestration.

The frontend should therefore avoid:

* influencing synchronization cadence,
* embedding orchestration semantics,
* introducing hidden retry behavior,
* implementing runtime authority,
* or mutating execution lifecycle behavior.

The frontend should observe runtime state rather than govern runtime behavior.

---

# Synchronization Philosophy

Synchronization inside this platform is deterministic and reconciliation-driven.

This is one of the most important architectural principles in the system.

Earlier generations of the platform relied on timer-driven synchronization, fragmented fetch ownership, graph-triggered acquisition behavior, and partially autonomous runtime synchronization flows. Those patterns created recursive acquisition pressure, duplicated synchronization behavior, stale context drift, orchestration ambiguity, and unstable runtime topology.

The current architecture intentionally centralizes synchronization ownership underneath deterministic reconciliation governance.

The runtime no longer acquires context because:

* time elapsed,
* a graph requested data,
* a monitor escalated pressure,
* or a realtime event independently woke execution.

Instead, the supervisor evaluates contextual coherence, runtime sufficiency, synchronization drift, stale state, unresolved strategic conditions, and telemetry mutation pressure. If coherence degradation exceeds deterministic thresholds, the runtime computes acquisition requirements and emits canonical acquisition intents.

No subsystem should independently fetch external data outside synchronization governance.

Realtime systems function as bounded telemetry signals only. Realtime mutation awareness should never become orchestration authority.

Acquisition flows should remain:

* deterministic,
* bounded,
* replay-safe,
* observable,
* and contract-driven.

---

# Canonical State Philosophy

Canonical runtime state lives inside persistence infrastructure rather than transient execution flows.

The runtime should consume:

* normalized persisted state,
* reconciled synchronization state,
* canonical telemetry,
* and deterministic execution lineage.

Transient API responses, temporary execution state, or infrastructure-local assumptions should never become runtime truth.

Canonical state currently exists primarily within Supabase persistence systems and Redis orchestration mirrors. Runtime cognition should always consume reconciled persisted state rather than transient acquisition responses.

This principle is critical for replayability, observability, reconciliation integrity, and orchestration determinism.

---

# Observability Philosophy

This platform prioritizes observability and deterministic runtime introspection.

The system is evolving toward distributed orchestration complexity. As a result, engineering decisions should optimize for runtime explainability rather than opaque execution convenience.

The platform should always be capable of explaining:

* why a state exists,
* what initiated a mutation,
* which subsystem triggered execution,
* how reconciliation decisions were computed,
* and how orchestration state evolved over time.

Opaque orchestration behavior is considered architectural debt.

Engineering systems should therefore prioritize:

* structured telemetry,
* execution lineage,
* mutation tracing,
* replay visibility,
* reconciliation diagnostics,
* and deterministic state introspection.

The ability to reconstruct runtime causality is more important than maximizing short-term execution convenience.

---

# Repository Philosophy

Repositories inside this ecosystem should remain domain-bounded and operationally explicit.

This repository is not responsible for orchestration cognition or runtime governance semantics. Those concerns belong to the dedicated runtime layers defined elsewhere in the system.

The backend repository should focus strictly on:

* acquisition infrastructure,
* normalization pipelines,
* persistence mutation,
* telemetry publication,
* concurrency-safe synchronization execution,
* and deterministic infrastructure reliability.

The frontend repository should focus strictly on:

* operational visibility,
* runtime inspection,
* telemetry presentation,
* management interfaces,
* and bounded operator interaction.

Repository boundaries should remain explicit because hidden cross-domain assumptions eventually recreate fragmented orchestration ownership.

---

# Guidance For AI Coding Systems

AI coding systems operating inside this repository should prioritize long-term orchestration integrity over short-term implementation convenience.

Models should preserve explicit runtime boundaries, deterministic synchronization semantics, replay-safe execution behavior, and repository domain ownership. Coding systems may propose abstractions, optimizations, and architectural improvements, but should avoid introducing patterns that slowly reintroduce orchestration ambiguity.

The following patterns should be treated carefully because they historically destabilized the runtime:

* hidden orchestration logic,
* implicit retries,
* recursive synchronization flows,
* graph-triggered acquisition,
* cognition-driven execution escalation,
* autonomous runtime wake behavior,
* and fragmented synchronization ownership.

Models should strongly prefer:

* explicit contracts,
* observable state transitions,
* deterministic infrastructure behavior,
* replay-safe execution semantics,
* and bounded subsystem responsibility.

The architecture intentionally favors stability and orchestration coherence over maximum autonomous behavior.

---

# Operational Doctrine

The long-term direction of this platform is guided by several core architectural principles.

The system prioritizes deterministic orchestration over emergent runtime behavior. Explicit contracts are preferred over implicit assumptions. Reconciliation is preferred over reactive synchronization. Bounded authority is preferred over fragmented runtime ownership. Persistence-backed canonical state is preferred over transient execution-local assumptions. Observable execution lineage is preferred over opaque orchestration behavior.

These principles are foundational to the architecture and should guide all future engineering decisions within this repository.
