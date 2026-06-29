// =====================================
// CONTROLLERS BARREL — Phase 3h
// Re-exports every UI-framework-agnostic controller that integrates
// the WebView with the kernel's domain layer.
//
// Each controller:
//   - Owns a reactive state slot (primitives/controller.ts)
//   - Calls domain services for I/O
//   - Exposes state() / subscribe() for any framework adapter
//
// Today's WebView is Svelte; tomorrow it could be anything else.
// The controllers do not depend on a framework.
//
// Note on barrel re-exports: several controllers export a constant
// `POLL_INTERVAL_MS` with different values per controller (different
// polling cadences). We re-export the primitives + factory functions
// here. For the per-controller constants, import directly from the
// controller's path: e.g.
//   import { POLL_INTERVAL_MS } from '@runtime/controllers/queue/monitor';
// =====================================

// Primitives — the slot factory, dispose scope, controller interfaces
export type { Controller, ControllerSlot } from './primitives/controller';
export { createControllerSlot, DisposeScope } from './primitives/controller';

// Agent controllers
export { createActivityFeedController } from './agent/activity-feed';
export type { UseActivityFeedResult } from './agent/activity-feed';
export { createAgentHealthController } from './agent/health';
export type { UseAgentHealthResult } from './agent/health';

// Analytics controllers
export { createAnalyticsReportsController } from './analytics/reports';
export type { UseAnalyticsReportsResult } from './analytics/reports';
export { createContentAnalyticsController } from './analytics/content';
export type { UseContentAnalyticsResult } from './analytics/content';

// Oversight controllers
export { createOversightChatController } from './oversight/chat';
export type { UseOversightChatResult } from './oversight/chat';

// Queue controllers
export { createQueueMonitorController } from './queue/monitor';
export type { UseQueueMonitorResult } from './queue/monitor';

// Terminal controllers
export { createTerminalKeyboardController } from './terminal/keyboard';
export type { UseTerminalKeyboardOptions, UseTerminalKeyboardResult } from './terminal/keyboard';

