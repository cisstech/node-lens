/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFile } from 'fs/promises'
import { dirname, join, parse } from 'path'

/**
 * Connection details for a running NodeLens session, written by the server to
 * `.node-lens/.info.json` when the monitored app starts listening.
 */
export interface NodeLensInfo {
  origin: string
  token: string
}

/** Well-known event scopes (== plugin package names) and their event types. */
export const SCOPES = {
  request: '@cisstech/node-lens-request',
  database: '@cisstech/node-lens-database',
  logging: '@cisstech/node-lens-logging',
} as const

export interface HistoryQueryOptions {
  eventType?: string
  limit?: number
  sort?: string[]
}

/**
 * Reads the current session's connection info, searching from `cwd` upward for a
 * `.node-lens/.info.json` (so the MCP server finds the session even when the
 * agent launches it from a subdirectory). The starting directory is, in order:
 * the `cwd` argument, `$NODE_LENS_CWD`, then `process.cwd()`.
 *
 * Returns null when no NodeLens session is running (the file is absent until the
 * monitored app starts listening).
 */
export async function readNodeLensInfo(cwd?: string): Promise<NodeLensInfo | null> {
  const start = cwd ?? process.env.NODE_LENS_CWD ?? process.cwd()
  const { root } = parse(start)
  let dir = start
  let reachedRoot = false

  // Walk up until we find a session file or reach the filesystem root.
  while (!reachedRoot) {
    try {
      const raw = await readFile(join(dir, '.node-lens', '.info.json'), 'utf8')
      const info = JSON.parse(raw)
      if (info?.sseUrl) {
        const sseUrl = new URL(info.sseUrl)
        const token = info.token ?? sseUrl.searchParams.get('token') ?? ''
        return { origin: sseUrl.origin, token }
      }
    } catch {
      // not here, keep walking up
    }
    reachedRoot = dir === root
    dir = dirname(dir)
  }
  return null
}

/**
 * Queries the running NodeLens session's history API for a scope. Reuses the
 * same token-gated endpoint the dashboard uses, so no data leaves the machine.
 */
export async function queryHistory(
  info: NodeLensInfo,
  scope: string,
  opts: HistoryQueryOptions = {}
): Promise<{ events: Array<{ data: any; timestamp: number }>; totalCount: number }> {
  const url = new URL('/node-lens/history', info.origin)
  url.searchParams.set('scope', scope)
  if (opts.eventType) url.searchParams.set('eventType', opts.eventType)
  url.searchParams.set('limit', String(opts.limit ?? 100))
  url.searchParams.set('sort', JSON.stringify(opts.sort ?? ['timestamp:desc']))
  if (info.token) url.searchParams.set('token', info.token)

  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    throw new Error(`NodeLens history request failed (${res.status}). Is the app still running?`)
  }
  return res.json() as Promise<{ events: Array<{ data: any; timestamp: number }>; totalCount: number }>
}
