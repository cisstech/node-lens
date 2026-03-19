/* eslint-disable @typescript-eslint/no-explicit-any */
import { BaseCommandHandler } from '@cisstech/node-lens-server'
import type {
  DatabaseConnectionConfig,
  ExplainCommandPayload,
  ExplainResult
} from '../types'

/**
 * Command handler for MySQL EXPLAIN queries
 */
export class MySqlExplainCommandHandler extends BaseCommandHandler<ExplainCommandPayload> {
  constructor(private getConnectionConfig: (dbSystem: string, database: string) => DatabaseConnectionConfig | undefined) {
    super()
  }

  protected canHandle(command: string, payload?: ExplainCommandPayload): boolean {
    if (command !== 'explain') {
      return false
    }

    if (!payload || typeof payload !== 'object') {
      return false
    }

    const explainPayload = payload as ExplainCommandPayload
    const { dbSystem } = explainPayload

    return ['mysql', 'mysql2'].includes(dbSystem?.toLowerCase())
  }

  protected async execute(payload: ExplainCommandPayload): Promise<ExplainResult> {
    const { query, dbSystem, database } = payload

    if (!query || !dbSystem || !database) {
      throw new Error('Missing required fields: query, dbSystem, and database')
    }

    // Get connection config from options or payload
    const connectionConfig = this.getConnectionConfig(dbSystem, database)
    if (!connectionConfig) {
      throw new Error(`No connection configuration found for ${dbSystem} database '${database}'`)
    }

    try {
      return await this.explainMySQL(query, database, connectionConfig)
    } catch (error) {
      console.error('[MySqlExplainCommandHandler] MySQL explain command failed:', error)
      throw new Error(`Failed to explain MySQL query: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async explainMySQL(
    query: string,
    database: string,
    config: DatabaseConnectionConfig
  ): Promise<ExplainResult> {
    try {
      const mysql = await import('mysql2/promise')
      const connection = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database,
        ...config.options,
      })

      // Execute EXPLAIN with JSON format (MySQL 8.0+)
      const explainQuery = `EXPLAIN FORMAT=JSON ${query}`
      const [rows] = await connection.execute(explainQuery)

      await connection.end()

      const planData = Array.isArray(rows) ? rows[0] : rows
      const plan = (planData as any)?.EXPLAIN

      return {
        plan: JSON.stringify(plan, null, 2),
        cost: plan?.query_block?.cost_info?.query_cost,
        metadata: {
          costInfo: plan?.query_block?.cost_info,
          usedColumns: plan?.query_block?.used_columns,
        }
      }
    } catch (error) {
      throw new Error(`MySQL explain failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}
