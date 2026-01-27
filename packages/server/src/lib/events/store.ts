/* eslint-disable @typescript-eslint/no-explicit-any */

export const filterOps = ['eq', 'ne', 'lt', 'lte', 'gt', 'gte', 'contains', 'search', 'in', 'notIn'] as const
export type FilterOp = typeof filterOps[number]
export type FilterExpr =
  | { field: string; op: FilterOp; value?: any }
  | { and: FilterExpr[] }
  | { or: FilterExpr[] }

export interface HistoryQuery {
  limit?: number
  offset?: number
  sort?: string[] // ex: ["data.timestamp:asc", "duration:desc"]
  filters?: FilterExpr[]
  eventType?: string
}

export interface SSEEvent<T = any> {
  id: string;
  scope: string;
  event: string;
  data: T;
  timestamp: number;
  sequence: number;
}

export interface HistoryResult<T = any> {
  events: SSEEvent<T>[];
  totalCount: number;
}

export interface FileEventStoreOptions {
  baseDir: string;
  maxEventsPerScope?: number;                 // défaut global (ex: 10_000)
  maxEventsOverrides?: Record<string, number> // override par scope
}

export interface EventStore {
  append<T = any>(scope: string, event: string, data: T): Promise<SSEEvent<T>>;
  list<T = any>(scope: string, options?: HistoryQuery): Promise<HistoryResult<T>>;
  clear(scope: string, event?: string): Promise<void>;
  /** Start a fresh session, dropping any previously persisted events. */
  reset?(): Promise<void>;
  /** Force any buffered writes to disk (e.g. on shutdown). */
  flushNow?(): Promise<void>;
}

