Phase 2

Rogue Authority Collapse

Overview

Phase 2 focuses on identifying and eliminating all unauthorized or implicit mutation paths within the system. These "rogue authorities" are any components that mutate state outside of the defined governance model. This phase is critical for restoring architectural integrity and ensuring that all state transitions are observable, deterministic, and governed.

The goal is not simply to remove code paths, but to re-establish a single, coherent authority model where all mutations flow through explicitly defined governance vectors.

Objectives
Identify all direct mutations occurring outside of governed pathways
Detect implicit ownership of state across components
Eliminate unauthorized mutation paths
Route all mutations through FSM-governed vectors
Establish clear ownership boundaries for all state domains
Key Concepts
Direct Mutation: Any state change performed outside of FSM or backend governance
Implicit Ownership: Components assuming control over state without formal authority
Governance Vector: A defined pathway through which mutations are authorized and executed
Execution Strategy
System Audit
Scan frontend and backend for direct database writes
Identify API calls that bypass backend governance
Locate state mutations occurring in UI components or controllers
Classification
Categorize mutations by domain (auth, content, workflow, etc.)
Identify ownership conflicts and overlapping responsibilities
Isolation
Flag all rogue mutation paths
Introduce temporary guards or logging to track usage
Redirection
Replace direct mutations with intent-based calls
Route all mutations through FSM → Backend → HSM
Validation
Ensure no mutation occurs outside governance vectors
Confirm deterministic behavior across all mutation flows
Deliverables
Authority Inventory
Comprehensive list of all components performing mutations
Ownership mapping for each state domain
Mutation Inventory
Catalog of all mutation pathways
Classification of authorized vs unauthorized mutations
Governance Routing Map
Visual and documented mapping of all mutation flows
Defined pathways from UI → FSM → Backend → External Systems
Phase 3

Authentication Governance

Overview

Phase 3 centralizes all authentication and session-related logic under FSM governance. Authentication is treated as a first-class state domain, with all transitions, refreshes, and permission changes routed through a controlled mutation zone.

This ensures deterministic session behavior, eliminates fragmented auth logic, and enables full observability of authentication state transitions.

Objectives
Route all login and logout flows through FSM
Centralize session refresh logic within FSM
Govern permission and role state transitions
Eliminate direct calls to authentication providers from UI
Key Concepts
Session Mutation Zone: The only location where session state can be modified
Session Governance Vector: FSM-managed pathway for all auth-related transitions
Execution Strategy
Audit Existing Auth Flows
Identify all login, logout, and refresh calls
Locate direct usage of Supabase or other auth providers
FSM Integration
Define session states (unauthenticated, authenticating, authenticated, expired, etc.)
Implement transitions for all auth events
Centralization
Move all auth logic into FSM-controlled handlers
Remove direct auth calls from UI and controllers
Permission Modeling
Represent roles and permissions as FSM state
Ensure all permission checks derive from FSM projections
Observability
Track all session transitions
Enable replay and debugging of auth flows
Deliverables
Session Mutation Zone
Centralized module responsible for all session state changes
Session Governance Vector
FSM-defined pathways for login, logout, refresh, and permission transitions
Phase 4

Substrate Governance

Overview

Phase 4 introduces governance over all runtime substrates, including infrastructure components such as network connectivity, filesystem access, IPC, and external service availability. These substrates are treated as governed entities with defined health contracts and mutation zones.

The goal is to ensure that infrastructure state is observable, controlled, and integrated into the overall system coherence model.

Objectives
Define health contracts for all substrates
Establish mutation zones for substrate interactions
Integrate substrate state into FSM
Ensure all substrate interactions are governed and observable
Key Concepts
Substrate: Any underlying system component (network, filesystem, IPC, etc.)
Health Contract: Defined expectations for substrate availability and behavior
Substrate Mutation Zone: Controlled interface for interacting with substrates
Execution Strategy
Substrate Identification
Enumerate all infrastructure dependencies
Classify by type and criticality
Health Modeling
Define health states (healthy, degraded, unavailable)
Establish monitoring and reporting mechanisms
Mutation Control
Create controlled interfaces for substrate interactions
Prevent direct access from UI or controllers
FSM Integration
Represent substrate state within FSM
Trigger transitions based on substrate health changes
Observability
Track substrate events and transitions
Enable debugging and recovery workflows
Deliverables
Substrate Registry
Catalog of all substrates with metadata and health definitions
Substrate Governance Layer
Centralized system for managing substrate interactions and state
Phase 5

Projection Formalisation

Overview

Phase 5 formalizes the use of projections as the sole mechanism for state consumption in the UI. Direct access to raw state is eliminated, and all data presented to the UI is derived through structured, governed projections.

This ensures consistency, decouples presentation from state structure, and enables controlled evolution of state models.

Objectives
Eliminate direct state consumption in UI and controllers
Replace all state access with projections
Define contracts for all projections
Ensure projections are derived from FSM state
Key Concepts
Projection: A derived, read-only view of state tailored for consumption
Projection Contract: Defined structure and guarantees of a projection
Execution Strategy
Audit State Access
Identify all direct state reads in UI and controllers
Projection Design
Define projections for each UI domain
Ensure projections are minimal and purpose-specific
Implementation
Replace direct state access with projection consumption
Enforce read-only access patterns
Contract Definition
Document structure and guarantees of each projection
Ensure backward compatibility where necessary
Validation
Verify that all UI components consume projections exclusively
Deliverables
Projection Registry
Catalog of all projections with definitions and usage
Projection Contracts
Formal specifications for each projection's structure and behavior
Phase 6

Controller Refactor

Overview

Phase 6 transforms controllers from stateful, authoritative components into stateless intent surfaces. Controllers no longer perform mutations or hold state; instead, they emit intents that are processed through governed pathways.

This removes hidden authority and aligns controllers with the overall governance model.

Objectives
Eliminate state ownership within controllers
Remove direct mutation logic from controllers
Convert controllers into intent emitters
Ensure controllers consume projections only
Key Concepts
Intent Surface: Interface through which user actions are expressed as intents
Stateless Controller: Component that does not hold or mutate state
Execution Strategy
Audit Controllers
Identify all stateful logic and mutations within controllers
Refactor Logic
Extract mutation logic into FSM or backend handlers
Replace with intent emission
Projection Integration
Ensure controllers consume projections for all data needs
Validation
Confirm controllers are stateless and side-effect free
Deliverables
Stateless Controllers
Controllers refactored to emit intents only
Projection Consumers
Controllers updated to consume projections exclusively
Phase 7

Presentation Purification

Overview

Phase 7 ensures that the presentation layer (Svelte) is fully decoupled from state, infrastructure, and runtime authority. The UI becomes a pure rendering layer, driven entirely by projections and emitting user intents.

This creates a clean separation between presentation and system logic.

Objectives
Remove all substrate access from UI components
Eliminate state ownership within UI
Remove any runtime authority from presentation layer
Ensure UI is purely declarative and reactive
Key Concepts
Pure Presentation Layer: UI that only renders data and emits events
Declarative Rendering: UI defined entirely by state projections
Execution Strategy
Audit UI Components
Identify direct state access, mutations, and substrate interactions
Refactor Components
Replace with projection-driven rendering
Remove side effects and imperative logic
Intent Emission
Ensure all user actions emit intents rather than performing logic
Validation
Confirm UI components are pure and stateless
Deliverables
Pure Svelte Presentation Layer
Fully declarative UI driven by projections and intents
Phase 8

Observability Integration

Overview

Phase 8 introduces comprehensive observability across the system, enabling visibility into runtime behavior, FSM transitions, and governance flows. This phase ensures that all state changes and system events are traceable, debuggable, and analyzable.

Objectives
Implement runtime telemetry
Track FSM state transitions
Enable transition tracing and lineage
Establish governance observability
Key Concepts
Telemetry: Collection of runtime data for monitoring and analysis
Transition Lineage: Trace of state transitions over time
Execution Strategy
Instrumentation
Add telemetry hooks across FSM, backend, and substrates
Data Collection
Capture state transitions, events, and errors
Visualization
Build dashboards for monitoring system behavior
Tracing
Enable end-to-end tracing of intents and mutations
Analysis
Provide tools for debugging and performance analysis
Deliverables
FSM Dashboards
Visual representation of state transitions and system health
Transition Lineage
Traceable history of all state changes
Runtime Observability
Comprehensive monitoring and logging infrastructure
Phase 9

Distributed State Validation

Overview

Phase 9 validates the integrity and resilience of the distributed state system. Through replay, recovery, and synchronization testing, this phase ensures that the system behaves deterministically and can recover from failures.

Objectives
Implement replay testing for state transitions
Validate recovery mechanisms
Test state reconstruction from logs
Ensure synchronization across distributed components
Key Concepts
Replay Testing: Re-executing state transitions to verify determinism
Recovery Testing: Simulating failures and validating system recovery
Reconstruction Testing: Rebuilding state from event logs
Execution Strategy
Test Design
Define scenarios for replay, recovery, and synchronization
Implementation
Build testing frameworks and tools
Execution
Run tests across various failure and edge cases
Validation
Ensure consistency and determinism across all tests
Iteration
Refine system based on test results
Deliverables
Validation Suite
Comprehensive set of tests for state integrity
Recovery Suite
Tools and tests for failure recovery
Replay Suite
Framework for replaying and validating state transitions