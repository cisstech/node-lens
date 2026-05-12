/* eslint-disable @typescript-eslint/no-explicit-any */
import { NodeLensInfo, queryHistory, readNodeLensInfo, SCOPES } from './nodelens-client'

/** JSON-Schema tool descriptors advertised over MCP `tools/list`. */
export const TOOL_DEFINITIONS = [
  {
    name: 'nodelens_status',
    description:
      'Check whether a NodeLens monitoring session is currently running and how much runtime data it has captured (requests, DB traces, logs). Call this first.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'list_requests',
    description:
      'List recent HTTP requests the monitored app handled, most recent first. Optionally filter by method, status code, path substring, or minimum duration. Use to see what the app is actually doing at runtime.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max requests to return (default 20).' },
        method: { type: 'string', description: 'Filter by HTTP method, e.g. "GET".' },
        status: { type: 'number', description: 'Filter by exact response status code.' },
        path: { type: 'string', description: 'Only requests whose path contains this substring.' },
        minDurationMs: { type: 'number', description: 'Only requests at least this slow.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_request',
    description:
      'Get the full detail of one HTTP request by its traceId: request/response headers and body, timing, and the operation timeline (middleware, DB calls). Use after list_requests to inspect a specific request.',
    inputSchema: {
      type: 'object',
      properties: { traceId: { type: 'string', description: 'The request traceId.' } },
      required: ['traceId'],
      additionalProperties: false,
    },
  },
  {
    name: 'find_n1_queries',
    description:
      'Find database N+1 / duplicate-query problems detected across recent requests. Returns each offending request route with the repeated statement and how many times it ran. Use to diagnose slow endpoints.',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'number', description: 'Max traces to scan (default 50).' } },
      additionalProperties: false,
    },
  },
  {
    name: 'list_slow_queries',
    description:
      'List individual slow database queries across recent requests, slowest first, with the SQL statement, duration, and originating route.',
    inputSchema: {
      type: 'object',
      properties: {
        thresholdMs: { type: 'number', description: 'Minimum query duration to include (default 50).' },
        limit: { type: 'number', description: 'Max queries to return (default 20).' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_recent_logs',
    description:
      'Get recent application logs captured by NodeLens (console/Pino/Nest), most recent first. Optionally filter by severity, a text substring, or a traceId to correlate logs with a specific request.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max logs to return (default 50).' },
        level: { type: 'string', description: 'Filter by severity, e.g. "ERROR", "WARN".' },
        contains: { type: 'string', description: 'Only logs whose message contains this text.' },
        traceId: { type: 'string', description: 'Only logs correlated to this request traceId.' },
      },
      additionalProperties: false,
    },
  },
] as const

const NOT_RUNNING =
  'No NodeLens session is running (no .node-lens/.info.json found in the working directory). Start one with `nls monitor --mode backend <your app command>`, then retry.'

async function requireInfo(): Promise<NodeLensInfo> {
  const info = await readNodeLensInfo()
  if (!info) throw new Error(NOT_RUNNING)
  return info
}

function get(obj: any, path: string): any {
  return path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj)
}

/** Executes a tool by name and returns a plain-object result (serialized by the transport). */
export async function callTool(name: string, args: Record<string, any> = {}): Promise<unknown> {
  switch (name) {
    case 'nodelens_status': {
      const info = await readNodeLensInfo()
      if (!info) return { running: false, hint: NOT_RUNNING }
      const [reqs, dbs, logs] = await Promise.all([
        queryHistory(info, SCOPES.request, { eventType: 'request', limit: 1 }).catch(() => null),
        queryHistory(info, SCOPES.database, { eventType: 'query', limit: 1 }).catch(() => null),
        queryHistory(info, SCOPES.logging, { eventType: 'logging', limit: 1 }).catch(() => null),
      ])
      if (!reqs && !dbs && !logs) {
        return { running: false, hint: `Found session at ${info.origin} but it is not reachable. Is the app still running?` }
      }
      return {
        running: true,
        origin: info.origin,
        captured: {
          requests: reqs?.totalCount ?? 0,
          databaseTraces: dbs?.totalCount ?? 0,
          logs: logs?.totalCount ?? 0,
        },
      }
    }

    case 'list_requests': {
      const info = await requireInfo()
      const limit = args.limit ?? 20
      const { events } = await queryHistory(info, SCOPES.request, {
        eventType: 'request',
        limit: Math.max(limit * 3, 50),
        sort: ['timestamp:desc'],
      })
      let rows = events.map((e) => {
        const d = e.data
        return {
          traceId: d.traceId,
          method: d.request?.method,
          path: d.request?.path ?? d.request?.url,
          status: d.response?.statusCode,
          durationMs: round(d.response?.duration),
          timestamp: d.timestamp,
        }
      })
      if (args.method) rows = rows.filter((r) => r.method?.toUpperCase() === String(args.method).toUpperCase())
      if (args.status != null) rows = rows.filter((r) => r.status === args.status)
      if (args.path) rows = rows.filter((r) => (r.path ?? '').includes(args.path))
      if (args.minDurationMs != null) rows = rows.filter((r) => (r.durationMs ?? 0) >= args.minDurationMs)
      return { count: Math.min(rows.length, limit), requests: rows.slice(0, limit) }
    }

    case 'get_request': {
      const info = await requireInfo()
      const { events } = await queryHistory(info, SCOPES.request, { eventType: 'request', limit: 200 })
      const match = events.find((e) => e.data?.traceId === args.traceId)
      if (!match) throw new Error(`No request found with traceId "${args.traceId}".`)
      const d = match.data
      return {
        traceId: d.traceId,
        timestamp: d.timestamp,
        request: {
          method: d.request?.method,
          url: d.request?.url,
          path: d.request?.path,
          query: d.request?.query,
          headers: d.request?.headers,
          body: truncate(d.request?.body),
          size: d.request?.size,
        },
        response: {
          statusCode: d.response?.statusCode,
          durationMs: round(d.response?.duration),
          headers: d.response?.headers,
          body: truncate(d.response?.body),
          size: d.response?.size,
        },
        operations: d.operations,
      }
    }

    case 'find_n1_queries': {
      const info = await requireInfo()
      const limit = args.limit ?? 50
      const { events } = await queryHistory(info, SCOPES.database, { eventType: 'query', limit })
      const problems = []
      for (const e of events) {
        const d = e.data
        const groups = (d.duplicateGroups ?? []).filter((g: any) => g.suspectedNPlusOne || g.count > 1)
        if (!groups.length) continue
        problems.push({
          traceId: d.traceId,
          route: `${d.method ?? ''} ${d.route ?? ''}`.trim(),
          totalDurationMs: round(d.totalDurationMs),
          queryCount: d.queryCount,
          uniqueQueryCount: d.uniqueQueryCount,
          duplicates: groups.map((g: any) => ({
            statement: collapse(g.statement),
            count: g.count,
            suspectedNPlusOne: !!g.suspectedNPlusOne,
            totalDurationMs: round(g.totalDurationMs),
          })),
        })
      }
      return {
        count: problems.length,
        problems,
        ...(problems.length === 0 ? { note: 'No N+1 or duplicate-query bursts detected in the recent traces.' } : {}),
      }
    }

    case 'list_slow_queries': {
      const info = await requireInfo()
      const thresholdMs = args.thresholdMs ?? 50
      const limit = args.limit ?? 20
      const { events } = await queryHistory(info, SCOPES.database, { eventType: 'query', limit: 100 })
      const slow: any[] = []
      for (const e of events) {
        const d = e.data
        for (const q of d.queries ?? []) {
          if ((q.durationMs ?? 0) >= thresholdMs) {
            slow.push({
              statement: collapse(q.statement),
              durationMs: round(q.durationMs),
              route: `${d.method ?? ''} ${d.route ?? ''}`.trim(),
              traceId: d.traceId,
              isError: !!q.isError,
            })
          }
        }
      }
      slow.sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0))
      return { count: Math.min(slow.length, limit), thresholdMs, queries: slow.slice(0, limit) }
    }

    case 'get_recent_logs': {
      const info = await requireInfo()
      const limit = args.limit ?? 50
      const { events } = await queryHistory(info, SCOPES.logging, {
        eventType: 'logging',
        limit: Math.max(limit * 3, 100),
        sort: ['timestamp:desc'],
      })
      let rows = events.map((e) => {
        const d = e.data
        return {
          timestamp: d.timestamp,
          severity: d.severity,
          message: typeof d.message === 'string' ? d.message : JSON.stringify(d.message),
          traceId: get(d, 'attributes.traceId') ?? d.traceId,
        }
      })
      if (args.level) rows = rows.filter((r) => (r.severity ?? '').toUpperCase() === String(args.level).toUpperCase())
      if (args.contains) rows = rows.filter((r) => (r.message ?? '').includes(args.contains))
      if (args.traceId) rows = rows.filter((r) => r.traceId === args.traceId)
      return { count: Math.min(rows.length, limit), logs: rows.slice(0, limit) }
    }

    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}

function round(n?: number): number | undefined {
  return typeof n === 'number' ? Math.round(n * 10) / 10 : undefined
}

function collapse(sql?: string): string {
  return (sql ?? '').replace(/\s+/g, ' ').trim()
}

function truncate(body: unknown, max = 2000): unknown {
  if (typeof body !== 'string') return body
  return body.length > max ? `${body.slice(0, max)}… [truncated ${body.length - max} chars]` : body
}
