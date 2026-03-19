/* eslint-disable @typescript-eslint/no-explicit-any */
export const PLUGIN_NAME = '@cisstech/node-lens-database'
export const PLUGIN_EVENTS = {
  QUERY: 'query',
} as const

export type DatabaseContext = 'http' | 'background'

export type TraceWarning = 'duplicate' | 'slow' | 'error'

export interface ExplainCommandPayload {
  /** SQL query to explain */
  query: string
  /** Database system (postgresql, mysql, etc.) */
  dbSystem: string
  /** Database name */
  database: string
}

export interface ExplainResult {
  /** Query execution plan */
  plan: string
  /** Estimated cost (if available) */
  cost?: number
  /** Execution time estimate (if available) */
  estimatedTime?: number
  /** Additional plan metadata */
  metadata?: Record<string, unknown>
}

export interface DatabaseQueryError {
  type?: string
  message?: string
  stacktrace?: string
}

export interface DatabaseQuerySpan {
  spanId: string
  parentSpanId?: string
  traceId: string
  startTimeMs: number
  durationMs: number
  dbSystem: string
  operation: string
  statement: string
  /** Parameterized template used for signature/grouping (see DatabaseEngineInfo). */
  normalizedStatement?: string
  parameters?: any[]
  resource?: string
  isError: boolean
  error?: DatabaseQueryError
  metadata?: Record<string, any>
}

export interface DuplicateQueryGroup {
  signature: string
  statement: string
  resource?: string
  count: number
  totalDurationMs: number
  sampleParams?: any[]
  suspectedNPlusOne: boolean
}

export interface DatabaseTrace {
  traceId: string
  rootSpanId: string
  timestamp: number
  startTimeMs: number
  endTimeMs: number
  context: DatabaseContext
  method?: string
  route?: string
  totalDurationMs: number
  queryCount: number
  uniqueQueryCount: number
  slowQueryCount: number
  errorCount: number
  warnings: TraceWarning[]
  duplicateGroups: DuplicateQueryGroup[]
  queries: DatabaseQuerySpan[]
  callStacks: Record<string, string[]>
}

export interface DatabaseConnectionConfig {
  /** Database host */
  host: string
  /** Database port */
  port: number
  /** Database username */
  user: string
  /** Database password */
  password?: string
  /** Additional connection options */
  options?: Record<string, unknown>
}

export interface DatabasePluginOptions {
  /** Whether to redact query parameters for security */
  redactParams?: boolean
  /** Minimum duration (ms) to consider a query "slow" */
  slowQueryMs?: number
  /** Minimum duplicate query count to trigger N+1 detection */
  duplicateBurstThreshold?: number
  /** Database connection configurations by database name */
  connections?: {
    /** PostgreSQL connections: database name -> connection config */
    postgresql?: Record<string, DatabaseConnectionConfig>
    /** MySQL connections: database name -> connection config */
    mysql?: Record<string, DatabaseConnectionConfig>
    /** MongoDB connections: database name -> connection config */
    mongodb?: Record<string, DatabaseConnectionConfig>
    /** Redis connections: database name -> connection config */
    redis?: Record<string, DatabaseConnectionConfig>
  }
}


export interface DatabaseConnection {
  id: string
  name: string
  dbSystem: string
  database: string
  host: string
  port: number
  user?: string
  isDefault?: boolean
}

export interface ListConnectionsResult {
  connections: DatabaseConnection[]
}
