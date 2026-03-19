import type { NodeLensClient } from '@cisstech/node-lens-client'
import type { DatabaseQuerySpan } from '../../server/types.js'
import type { TraceAction, ActionResult } from '../types.js'
import { QueryFormatter } from '../utils/query-utils.js'
import { DatabaseSystemRegistry } from '../utils/database-utils.js'

/**
 * Service for handling user actions on traces and queries
 */
export class ActionService extends EventTarget {
  constructor(private client: NodeLensClient) {
    super()
  }

  /**
   * Get available actions for a query
   */
  getQueryActions(query: DatabaseQuerySpan): TraceAction[] {
    const actions: TraceAction[] = []

    // Primary copy action - use copy prop for better UX
    actions.push({
      label: DatabaseSystemRegistry.getActionLabel(query.dbSystem),
      icon: 'copy',
      primary: true,
      copy: QueryFormatter.formatQuery(query)
    })

    // Database-specific secondary actions
    const dbSystem = query.dbSystem?.toLowerCase()

    // MongoDB JavaScript export
    if (dbSystem === 'mongodb' || dbSystem === 'mongo') {
      actions.push({
        label: 'Copy as JS',
        icon: 'code',
        copy: QueryFormatter.formatMongoJavaScript(query)
      })
    }

    // Explain action for SQL databases - emits events for UI updates
    if (DatabaseSystemRegistry.supportsExplain(query.dbSystem)) {
      actions.push({
        label: 'Explain',
        icon: 'info',
        handler: () => this.explainQuery(query)
      })
    }

    // Copy with parameters
    if (query.parameters && Object.keys(query.parameters).length > 0) {
      actions.push({
        label: 'Copy with Params',
        icon: 'symbol-parameter',
        copy: QueryFormatter.formatQueryWithParams(query)
      })
    }

    return actions
  }

  /**
   * Emit an action result event
   */
  private emitResult(result: ActionResult): void {
    const event = new CustomEvent('action-result', { detail: result })
    this.dispatchEvent(event)
  }

  /**
   * Execute explain query command
   */
  private async explainQuery(query: DatabaseQuerySpan): Promise<void> {
    if (!query.statement || !query.dbSystem) {
      console.error('Cannot explain query: missing statement or dbSystem')
      return
    }

    // Extract database name from metadata
    const database = query.metadata?.database || 'default'

    try {
      const result = await this.client.commands.execute<{
        plan: string
        cost?: number
        estimatedTime?: number
        metadata?: Record<string, unknown>
      }>(
        '@cisstech/node-lens-database',
        'explain',
        {
          query: query.statement,
          dbSystem: query.dbSystem,
          database: database
        }
      )

      // Emit the explanation result as an event
      this.emitResult({
        type: 'explain',
        queryId: query.spanId,
        title: `Query Execution Plan (${query.dbSystem})`,
        content: result.plan,
        metadata: {
          cost: result.cost,
          estimatedTime: result.estimatedTime,
          database: query.metadata?.database || 'default',
          ...result.metadata
        }
      })
    } catch (error) {
      console.error('Failed to explain query:', error)
      this.emitResult({
        type: 'error',
        queryId: query.spanId,
        title: 'Explain Query Failed',
        content: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }
}
