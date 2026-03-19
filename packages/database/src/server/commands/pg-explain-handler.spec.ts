import type { DatabaseConnectionConfig, ExplainCommandPayload } from '../types'
import { PgExplainCommandHandler } from './pg-explain-handler'

// Mock the pg module
const mockClient = {
  connect: jest.fn(),
  query: jest.fn(),
  end: jest.fn(),
}

jest.mock('pg', () => ({
  Client: jest.fn(() => mockClient),
}))

describe('PgExplainCommandHandler', () => {
  const mockConnectionConfig: DatabaseConnectionConfig = {
    host: 'localhost',
    port: 5432,
    user: 'test',
    password: 'test',
    options: {}
  }

  const getConnectionConfig = jest.fn()
  let handler: PgExplainCommandHandler

  beforeEach(() => {
    jest.clearAllMocks()
    mockClient.connect.mockResolvedValue(undefined)
    mockClient.query.mockResolvedValue({ rows: [] })
    mockClient.end.mockResolvedValue(undefined)

    const pg = require('pg')
    pg.Client.mockImplementation(() => mockClient)

    getConnectionConfig.mockReturnValue(mockConnectionConfig)
    handler = new PgExplainCommandHandler(getConnectionConfig)
  })

  describe('canHandle', () => {
    it('should return true for explain command with PostgreSQL system', () => {
      const payload: ExplainCommandPayload = {
        query: 'SELECT * FROM users',
        dbSystem: 'postgresql',
        database: 'test'
      }

      expect(handler['canHandle']('explain', payload)).toBe(true)
    })

    it('should return true for explain command with postgres system', () => {
      const payload: ExplainCommandPayload = {
        query: 'SELECT * FROM users',
        dbSystem: 'postgres',
        database: 'test'
      }

      expect(handler['canHandle']('explain', payload)).toBe(true)
    })

    it('should return true for explain command with pg system', () => {
      const payload: ExplainCommandPayload = {
        query: 'SELECT * FROM users',
        dbSystem: 'pg',
        database: 'test'
      }

      expect(handler['canHandle']('explain', payload)).toBe(true)
    })

    it('should return false for non-explain command', () => {
      const payload: ExplainCommandPayload = {
        query: 'SELECT * FROM users',
        dbSystem: 'postgresql',
        database: 'test'
      }

      expect(handler['canHandle']('test-connection', payload)).toBe(false)
    })

    it('should return false for MySQL system', () => {
      const payload: ExplainCommandPayload = {
        query: 'SELECT * FROM users',
        dbSystem: 'mysql',
        database: 'test'
      }

      expect(handler['canHandle']('explain', payload)).toBe(false)
    })

    it('should return false for missing payload', () => {
      expect(handler['canHandle']('explain')).toBe(false)
    })

    it('should return false for invalid payload', () => {
      expect(handler['canHandle']('explain', 'invalid')).toBe(false)
    })
  })

  describe('execute', () => {
    it('should successfully execute PostgreSQL explain', async () => {
      const payload: ExplainCommandPayload = {
        query: 'SELECT * FROM users',
        dbSystem: 'postgresql',
        database: 'test'
      }

      const mockPlan = {
        Plan: {
          'Node Type': 'Seq Scan',
          'Total Cost': 100.5
        },
        'Planning Time': 0.5,
        'Execution Time': 10.2
      }

      mockClient.query.mockResolvedValue({
        rows: [{ 'QUERY PLAN': mockPlan }]
      })

      const result = await handler['execute'](payload)

      expect(result).toEqual({
        plan: JSON.stringify(mockPlan, null, 2),
        cost: 100.5,
        estimatedTime: 10.2,
        metadata: {
          planningTime: 0.5,
          executionTime: 10.2,
          nodeType: 'Seq Scan'
        }
      })

      expect(mockClient.connect).toHaveBeenCalled()
      expect(mockClient.query).toHaveBeenCalledWith(
        'EXPLAIN (ANALYZE false, VERBOSE true, BUFFERS false, FORMAT JSON) SELECT * FROM users'
      )
      expect(mockClient.end).toHaveBeenCalled()
    })

    it('should handle array plan data', async () => {
      const payload: ExplainCommandPayload = {
        query: 'SELECT * FROM users',
        dbSystem: 'postgresql',
        database: 'test'
      }

      const mockPlan = {
        Plan: {
          'Node Type': 'Seq Scan',
          'Total Cost': 100.5
        }
      }

      mockClient.query.mockResolvedValue({
        rows: [{ 'QUERY PLAN': [mockPlan] }]
      })

      const result = await handler['execute'](payload)

      expect(result.plan).toBe(JSON.stringify(mockPlan, null, 2))
    })

    it('should throw error for missing required fields', async () => {
      const payload = {
        dbSystem: 'postgresql',
        database: 'test'
        // missing query
      } satisfies Partial<ExplainCommandPayload> as ExplainCommandPayload

      await expect(handler['execute'](payload))
        .rejects.toThrow('Missing required fields: query, dbSystem, and database')
    })

    it('should throw error when connection config not found', async () => {
      getConnectionConfig.mockReturnValue(undefined)

      const payload: ExplainCommandPayload = {
        query: 'SELECT * FROM users',
        dbSystem: 'postgresql',
        database: 'test'
      }

      await expect(handler['execute'](payload))
        .rejects.toThrow("No connection configuration found for postgresql database 'test'")
    })

    it('should handle database connection errors', async () => {
      const payload: ExplainCommandPayload = {
        query: 'SELECT * FROM users',
        dbSystem: 'postgresql',
        database: 'test'
      }

      const { Client } = await import('pg')
      ;(Client as jest.MockedClass<typeof Client>).mockImplementation(() => {
        throw new Error('Connection failed')
      })

      await expect(handler['execute'](payload))
        .rejects.toThrow('Failed to explain PostgreSQL query: Connection failed')
    })
  })
})
