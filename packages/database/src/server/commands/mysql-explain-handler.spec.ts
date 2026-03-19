import { MySqlExplainCommandHandler } from './mysql-explain-handler'
import type { ExplainCommandPayload, DatabaseConnectionConfig } from '../types'

// Mock the mysql2/promise module
const mockConnection = {
  execute: jest.fn(),
  end: jest.fn(),
}

jest.mock('mysql2/promise', () => ({
  createConnection: jest.fn().mockResolvedValue(mockConnection),
}))

describe('MySqlExplainCommandHandler', () => {
  const mockConnectionConfig: DatabaseConnectionConfig = {
    host: 'localhost',
    port: 3306,
    user: 'test',
    password: 'test',
    options: {}
  }

  const getConnectionConfig = jest.fn()
  let handler: MySqlExplainCommandHandler

  beforeEach(() => {
    jest.clearAllMocks()
    mockConnection.execute.mockResolvedValue([[]])
    mockConnection.end.mockResolvedValue(undefined)

    const mysql = require('mysql2/promise')
    mysql.createConnection.mockResolvedValue(mockConnection)

    getConnectionConfig.mockReturnValue(mockConnectionConfig)
    handler = new MySqlExplainCommandHandler(getConnectionConfig)
  })

  describe('canHandle', () => {
    it('should return true for explain command with mysql system', () => {
      const payload: ExplainCommandPayload = {
        query: 'SELECT * FROM users',
        dbSystem: 'mysql',
        database: 'test'
      }

      expect(handler['canHandle']('explain', payload)).toBe(true)
    })

    it('should return true for explain command with mysql2 system', () => {
      const payload: ExplainCommandPayload = {
        query: 'SELECT * FROM users',
        dbSystem: 'mysql2',
        database: 'test'
      }

      expect(handler['canHandle']('explain', payload)).toBe(true)
    })

    it('should return false for non-explain command', () => {
      const payload: ExplainCommandPayload = {
        query: 'SELECT * FROM users',
        dbSystem: 'mysql',
        database: 'test'
      }

      expect(handler['canHandle']('test-connection', payload)).toBe(false)
    })

    it('should return false for PostgreSQL system', () => {
      const payload: ExplainCommandPayload = {
        query: 'SELECT * FROM users',
        dbSystem: 'postgresql',
        database: 'test'
      }

      expect(handler['canHandle']('explain', payload)).toBe(false)
    })

    it('should return false for missing payload', () => {
      expect(handler['canHandle']('explain')).toBe(false)
    })

    it('should return false for invalid payload', () => {
      expect(handler['canHandle']('explain', { query: '', database: '', dbSystem: '' })).toBe(false)
    })
  })

  describe('execute', () => {
    it('should successfully execute MySQL explain', async () => {
      const payload: ExplainCommandPayload = {
        query: 'SELECT * FROM users',
        dbSystem: 'mysql',
        database: 'test'
      }

      const mockPlan = {
        query_block: {
          cost_info: {
            query_cost: 250.5
          },
          used_columns: ['id', 'name']
        }
      }

      mockConnection.execute.mockResolvedValue([
        [{ EXPLAIN: mockPlan }]
      ])

      const result = await handler['execute'](payload)

      expect(result).toEqual({
        plan: JSON.stringify(mockPlan, null, 2),
        cost: 250.5,
        metadata: {
          costInfo: mockPlan.query_block.cost_info,
          usedColumns: mockPlan.query_block.used_columns
        }
      })

      expect(mockConnection.execute).toHaveBeenCalledWith(
        'EXPLAIN FORMAT=JSON SELECT * FROM users'
      )
      expect(mockConnection.end).toHaveBeenCalled()
    })

    it('should handle non-array result', async () => {
      const payload: ExplainCommandPayload = {
        query: 'SELECT * FROM users',
        dbSystem: 'mysql',
        database: 'test'
      }

      const mockPlan = {
        query_block: {
          cost_info: { query_cost: 100 }
        }
      }

      mockConnection.execute.mockResolvedValue([
        { EXPLAIN: mockPlan }
      ])

      const result = await handler['execute'](payload)

      expect(result.plan).toBe(JSON.stringify(mockPlan, null, 2))
      expect(result.cost).toBe(100)
    })

    it('should throw error for missing required fields', async () => {
      const payload = {
        dbSystem: 'mysql',
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
        dbSystem: 'mysql',
        database: 'test'
      }

      await expect(handler['execute'](payload))
        .rejects.toThrow("No connection configuration found for mysql database 'test'")
    })

    it('should handle database connection errors', async () => {
      const payload: ExplainCommandPayload = {
        query: 'SELECT * FROM users',
        dbSystem: 'mysql',
        database: 'test'
      }

      const mysql = await import('mysql2/promise')
      ;(mysql.createConnection as jest.Mock).mockRejectedValue(new Error('Connection failed'))

      await expect(handler['execute'](payload))
        .rejects.toThrow('Failed to explain MySQL query: MySQL explain failed: Connection failed')
    })
  })
})
