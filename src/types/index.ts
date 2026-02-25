/**
 * types/index.ts — barrel export
 *
 * Single entry point for all domain types.
 * New files (hooks, services, components) import from '@/types'.
 * Existing files keep their direct relative imports — no retroactive changes.
 *
 * Import convention for new code:
 *   import type { ScheduledPost, AgentType } from '@/types'
 */

// Agent domain (new)
export * from './agent-tables'
export * from './workflows'
export * from './oversight'

// Existing domains
// NOTE: permissions.ts and instagram-media.ts both export 'InstagramMedia' under different
// shapes and cannot be re-exported together without a name conflict. Existing files
// import directly from these modules. New code should do the same if needed.
export * from './ugc'
export * from './dashboard'
export * from './insights'
