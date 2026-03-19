/* eslint-disable @typescript-eslint/no-explicit-any */
import { BaseCommandHandler } from '@cisstech/node-lens-server'
import type { DatabaseConnectionConfig } from '../types'

export interface PlaygroundQueryRequest {
  query: string
  dbSystem: string
  database: string
}

export interface PlaygroundQueryResult {
  rows: Record<string, unknown>[]
  rowCount: number
  executionTime: number
  columns: string[]
  raw?: unknown
  warnings?: string[]
}

/**
 * Interface commune à tous les adapters
 */
interface Adapter {
  id: string
  execute(
    query: string,
    database: string,
    connection: DatabaseConnectionConfig
  ): Promise<Omit<PlaygroundQueryResult, 'executionTime'>>
}

/**
 * Adapters registry
 */
const adapters: Record<string, Adapter> = {}

/**
 * PostgreSQL Adapter
 */
adapters['postgresql'] = {
  id: 'postgresql',
  async execute(query, database, config) {
    const { Client } = await import('pg')
    const client = new Client({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database,
      ...config.options,
    })

    await client.connect()
    try {
      const result = await client.query(query)
      return {
        rows: result.rows,
        rowCount: result.rowCount ?? result.rows.length,
        columns: result.fields.map(f => f.name),
        raw: result,
      }
    } finally {
      await client.end()
    }
  }
}

/**
 * MySQL Adapter
 */
adapters['mysql'] = {
  id: 'mysql',
  async execute(query, database, config) {
    const mysql = await import('mysql2/promise')
    const conn = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database,
      ...config.options,
    })
    try {
      const [rows, fields] = await conn.execute(query)
      const resultRows = Array.isArray(rows) ? (rows as Record<string, unknown>[]) : []
      return {
        rows: resultRows,
        rowCount: resultRows.length,
        columns: Array.isArray(fields) ? fields.map((f: any) => f.name) : [],
        raw: rows,
      }
    } finally {
      await conn.end()
    }
  }
}

/**
 * MongoDB Adapter
 * (MVP : support find with implicit limit 50)
 */
adapters['mongodb'] = {
  id: 'mongodb',
  async execute(query, database, config) {
    const { MongoClient } = await import('mongodb')
    const uri = `mongodb://${config.host}:${config.port}`
    const client = new MongoClient(uri, {
      auth: {
        username: config.user,
        password: config.password,
      },

    })
    await client.connect()
    try {
      const db = client.db(database)
      // MVP : interpret query as simple JSON { collection, filter, limit }
      const { collection, filter = {}, limit = 50 } = JSON.parse(query)
      const cursor = db.collection(collection).find(filter).limit(limit)
      const docs = await cursor.toArray()

      // Simple normalization of results
      const columns = docs.length > 0 ? Object.keys(docs[0]) : []
      return {
        rows: docs,
        rowCount: docs.length,
        columns,
        raw: docs,
      }
    } finally {
      await client.close()
    }
  }
}

/**
 * Redis Adapter
 */
adapters['redis'] = {
  id: 'redis',
  async execute(query, _database, config) {
    const { createClient } = await import('redis')
    const client = createClient({
      url: `redis://${config.host}:${config.port}`,
      ...config.options,
    })
    await client.connect()
    try {
      const parts = query.trim().split(/\s+/)
      const reply = await client.sendCommand(parts)

      let rows: Record<string, unknown>[] = []
      let columns: string[] = []
      if (Array.isArray(reply)) {
        rows = reply.map((v, i) => ({ index: i, value: v }))
        columns = ['index', 'value']
      } else if (reply && typeof reply === 'object') {
        rows = Object.entries(reply).map(([k, v]) => ({ key: k, value: v }))
        columns = ['key', 'value']
      } else {
        rows = [{ value: reply }]
        columns = ['value']
      }

      return {
        rows,
        rowCount: rows.length,
        columns,
        raw: reply,
      }
    } finally {
      await client.disconnect()
    }
  }
}

/**
 * Playground query handler
 */
export class PlaygroundQueryCommandHandler extends BaseCommandHandler<PlaygroundQueryRequest> {
  constructor(
    private getConnectionConfig?: (
      dbSystem: string,
      database: string
    ) => DatabaseConnectionConfig | undefined
  ) {
    super()
  }

  protected canHandle(command: string): boolean {
    return command === 'execute-query'
  }

  protected async execute(payload?: PlaygroundQueryRequest): Promise<PlaygroundQueryResult> {
    const startTime = Date.now()

    const { query, dbSystem, database } = payload || {}
    if (!query?.trim()) throw new Error('Query cannot be empty')
    if (!dbSystem || !database) throw new Error('dbSystem and database are required')

    const adapter = adapters[dbSystem.toLowerCase()]
    if (!adapter) {
      throw new Error(`Unsupported dbSystem: ${dbSystem}. Supported: ${Object.keys(adapters).join(', ')}`)
    }

    const connectionConfig = this.getConnectionConfig?.(dbSystem, database)
    if (!connectionConfig) {
      throw new Error(`No connection config found for ${dbSystem}/${database}`)
    }

    try {
      const result = await adapter.execute(query, database, connectionConfig)
      return {
        ...result,
        executionTime: Date.now() - startTime,
      }
    } catch (err) {
      console.error('[PlaygroundQueryHandler] Query execution failed:', err)
      throw new Error(`Query execution failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
}

