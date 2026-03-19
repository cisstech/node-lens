import { BaseCommandHandler } from '@cisstech/node-lens-server'
import type {
  ExplainCommandPayload,
  ExplainResult,
  DatabaseConnectionConfig
} from '../types'

/**
 * Command handler for PostgreSQL EXPLAIN queries
 */
export class PgExplainCommandHandler extends BaseCommandHandler<ExplainCommandPayload> {
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

    return ['postgresql', 'postgres', 'pg'].includes(dbSystem?.toLowerCase())
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
      return await this.explainPostgreSQL(query, database, connectionConfig)
    } catch (error) {
      console.error('[PgExplainCommandHandler] PostgreSQL explain command failed:', error)
      throw new Error(`Failed to explain PostgreSQL query: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async explainPostgreSQL(
    query: string,
    database: string,
    config: DatabaseConnectionConfig
  ): Promise<ExplainResult> {
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

      // Execute EXPLAIN with detailed analysis
      const explainQuery = `EXPLAIN (ANALYZE false, VERBOSE true, BUFFERS false, FORMAT JSON) ${query}`
      const result = await client.query(explainQuery)

      await client.end()

      const planData = result.rows[0]['QUERY PLAN']
      const plan = Array.isArray(planData) ? planData[0] : planData

      return {
        plan: JSON.stringify(plan, null, 2),
        cost: plan?.Plan?.['Total Cost'],
        estimatedTime: plan?.['Execution Time'],
        metadata: {
          planningTime: plan?.['Planning Time'],
          executionTime: plan?.['Execution Time'],
          nodeType: plan?.Plan?.['Node Type'],
        }
      }
    } catch (error) {
      throw new Error(`PostgreSQL explain failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      await client.end()
    }
  }
}
