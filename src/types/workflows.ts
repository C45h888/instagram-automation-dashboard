/**
 * workflows.ts
 *
 * Types for automation_workflows and workflow_executions tables.
 * These are agent-read tables — the agent reads workflow config and
 * records execution results. The dashboard reads both for the agent
 * monitoring panel.
 */

import type { Database } from '../lib/database.types'

// ─────────────────────────────────────────────────────────────────────────────
// Row Type Aliases
// ─────────────────────────────────────────────────────────────────────────────

export type AutomationWorkflow = Database['public']['Tables']['automation_workflows']['Row']
export type WorkflowExecution  = Database['public']['Tables']['workflow_executions']['Row']

// ─────────────────────────────────────────────────────────────────────────────
// Status Union Types
// ─────────────────────────────────────────────────────────────────────────────

/** automation_workflows.status */
export type WorkflowStatus = 'active' | 'inactive' | 'error' | 'pending'

/** automation_type DB enum — which agent pipeline this workflow belongs to */
export type AutomationType = Database['public']['Enums']['automation_type']

// ─────────────────────────────────────────────────────────────────────────────
// Computed / Derived Interfaces
// ─────────────────────────────────────────────────────────────────────────────

/** Aggregated execution stats computed client-side from WorkflowExecution[].
 *  Built via useMemo in useWorkflowExecutions — not stored in the DB. */
export interface WorkflowExecutionSummary {
  total:      number
  successful: number
  failed:     number
  avgTime_ms: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter State + DEFAULT Constant
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkflowFilterState {
  status: 'all' | WorkflowStatus
  type:   'all' | AutomationType
  search: string
}

export const DEFAULT_WORKFLOW_FILTERS: WorkflowFilterState = {
  status: 'all',
  type:   'all',
  search: '',
}
