/* eslint-disable @typescript-eslint/no-explicit-any */
jest.mock('./nodelens-client', () => ({
  SCOPES: { request: 'req', database: 'db', logging: 'log' },
  readNodeLensInfo: jest.fn(),
  queryHistory: jest.fn(),
}))

import { callTool } from './tools'
import * as client from './nodelens-client'

const readNodeLensInfo = client.readNodeLensInfo as jest.Mock
const queryHistory = client.queryHistory as jest.Mock

const INFO = { origin: 'http://localhost:3000', token: 'tok' }

beforeEach(() => {
  jest.resetAllMocks()
})

describe('mcp tools', () => {
  it('nodelens_status reports not-running when no session file', async () => {
    readNodeLensInfo.mockResolvedValue(null)
    const res: any = await callTool('nodelens_status')
    expect(res.running).toBe(false)
    expect(res.hint).toMatch(/nls monitor/)
  })

  it('nodelens_status summarizes captured counts', async () => {
    readNodeLensInfo.mockResolvedValue(INFO)
    queryHistory.mockImplementation((_info, scope) => {
      const totals: Record<string, number> = { req: 12, db: 4, log: 30 }
      return Promise.resolve({ events: [], totalCount: totals[scope] })
    })
    const res: any = await callTool('nodelens_status')
    expect(res).toMatchObject({ running: true, origin: INFO.origin, captured: { requests: 12, databaseTraces: 4, logs: 30 } })
  })

  it('find_n1_queries surfaces duplicate groups with the offending route', async () => {
    readNodeLensInfo.mockResolvedValue(INFO)
    queryHistory.mockResolvedValue({
      totalCount: 1,
      events: [
        {
          timestamp: 1,
          data: {
            traceId: 't1',
            method: 'GET',
            route: '/todos/n1',
            totalDurationMs: 26,
            queryCount: 11,
            uniqueQueryCount: 2,
            duplicateGroups: [
              { statement: 'SELECT * FROM todos WHERE id = $1', count: 10, suspectedNPlusOne: true, totalDurationMs: 8 },
              { statement: 'SELECT id FROM todos', count: 1, suspectedNPlusOne: false, totalDurationMs: 3 },
            ],
          },
        },
      ],
    })
    const res: any = await callTool('find_n1_queries')
    expect(res.count).toBe(1)
    expect(res.problems[0].route).toBe('GET /todos/n1')
    // Only the repeated group is surfaced (count > 1), not the single query.
    expect(res.problems[0].duplicates).toHaveLength(1)
    expect(res.problems[0].duplicates[0]).toMatchObject({ count: 10, suspectedNPlusOne: true })
  })

  it('list_requests applies method and status filters', async () => {
    readNodeLensInfo.mockResolvedValue(INFO)
    queryHistory.mockResolvedValue({
      totalCount: 3,
      events: [
        { timestamp: 3, data: { traceId: 'a', request: { method: 'GET', path: '/todos' }, response: { statusCode: 200, duration: 5 } } },
        { timestamp: 2, data: { traceId: 'b', request: { method: 'POST', path: '/todos' }, response: { statusCode: 201, duration: 4 } } },
        { timestamp: 1, data: { traceId: 'c', request: { method: 'GET', path: '/todos' }, response: { statusCode: 404, duration: 1 } } },
      ],
    })
    const res: any = await callTool('list_requests', { method: 'get', status: 200 })
    expect(res.requests).toHaveLength(1)
    expect(res.requests[0].traceId).toBe('a')
  })

  it('list_slow_queries flattens and sorts queries above the threshold', async () => {
    readNodeLensInfo.mockResolvedValue(INFO)
    queryHistory.mockResolvedValue({
      totalCount: 1,
      events: [
        {
          timestamp: 1,
          data: {
            traceId: 't', method: 'GET', route: '/x',
            queries: [
              { statement: 'SELECT pg_sleep(1)', durationMs: 250 },
              { statement: 'SELECT 1', durationMs: 2 },
              { statement: 'SELECT slow', durationMs: 120 },
            ],
          },
        },
      ],
    })
    const res: any = await callTool('list_slow_queries', { thresholdMs: 100 })
    expect(res.queries.map((q: any) => q.durationMs)).toEqual([250, 120])
  })

  it('reports an error for an unknown tool', async () => {
    await expect(callTool('nope')).rejects.toThrow(/Unknown tool/)
  })

  it('throws a helpful error when no session is running for a data tool', async () => {
    readNodeLensInfo.mockResolvedValue(null)
    await expect(callTool('list_requests')).rejects.toThrow(/nls monitor/)
  })
})
