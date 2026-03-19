/**
 * Shared types for the database client components
 */

import type { DatabaseTrace } from "../server/types"

export interface FilterState {
  search: string
  filter: 'all' | 'errors' | 'slow' | 'n1' | 'background' | 'http'
  dbEngine: string
  durationFilter: 'all' | '<50ms' | '50-200ms' | '200ms-1s' | '>1s'
  resourceFilter: string
  queryTypeFilter: string
  timeRangeFilter: 'all' | '1h' | '24h' | '7d'
}

export interface FilterOption {
  value: string
  label: string
}

export interface TraceViewState {
  traces: DatabaseTrace[]
  view: DatabaseTrace[]
  totalCount: number
  loading: boolean
  error: string | null
  isLoadingMore: boolean
}

export interface TraceAction {
  label: string
  icon: string
  primary?: boolean
  handler?: () => void
  copy?: string // For nl-button copy prop
}

export interface ActionResult {
  type: 'explain' | 'error' | 'info'
  queryId: string // To identify which query this result belongs to
  title: string
  content: string
  metadata?: Record<string, unknown>
}

export interface ActionResultEvent extends CustomEvent<ActionResult> {
  readonly detail: ActionResult
}

export interface DatabaseSystemInfo {
  icon: string
  color: string
  resourceType: string
  displayName: string
}

export interface TraceServiceOptions {
  pageSize?: number
  pluginName: string
  eventType: string
}

export interface FilterServiceOptions {
  slowThreshold?: number
  duplicateBurstThreshold?: number
}

// Playground types
export interface PlaygroundQuery {
  query: string
  timestamp: number
  dbSystem?: string
}

export interface PlaygroundState {
  currentQuery: string
  isExecuting: boolean
  result: QueryResult | null
  error: string | null
}

export interface QueryResult {
  rows: Record<string, unknown>[]
  rowCount: number
  executionTime: number
  columns: string[]
}
