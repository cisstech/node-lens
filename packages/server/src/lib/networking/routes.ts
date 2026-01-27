import { join } from 'path'
import type { NodeLensPlugin } from '../plugins/types'
import type { EventStore, HistoryQuery } from '../events/store'
import { LockContentionError } from '../events/errors'

export class RouteManager {
  constructor(
    private baseUrl: string,
    private plugins: Map<string, NodeLensPlugin>,
    private store?: EventStore
  ) {}

  private handleStoreError(err: unknown): { status: number; data: unknown } {
    // Handle lock contention gracefully
    if (err instanceof LockContentionError) {
      return { status: 429, data: { error: 'System busy, please retry in a moment' } }
    }

    return { status: 500, data: { error: 'Internal Server Error' } }
  }

  getPluginCommandPath(): string {
    return join(this.baseUrl, 'plugins', ':plugin', 'commands', ':command')
  }

  getHistoryPath(): string {
    return join(this.baseUrl, 'history')
  }

  async handlePluginCommand(pluginName: string, command: string, payload?: unknown): Promise<{ status: number; data: unknown }> {
    try {
      const plugin = this.plugins.get(pluginName)
      if (!plugin) {
        return { status: 404, data: { error: `Plugin '${pluginName}' not found` } }
      }

      if (!plugin.handleCommand) {
        return { status: 501, data: { error: `Plugin '${pluginName}' does not support commands` } }
      }

      const result = await plugin.handleCommand(command, payload)
      return { status: 200, data: { success: true, result } }
    } catch (err) {
      console.error(`[NodeLens] Plugin command error:`, err)
      const message = err instanceof Error ? err.message : 'Internal Server Error'
      return { status: 500, data: { error: message } }
    }
  }

  async handleHistoryQuery(query: Record<string, unknown>): Promise<{ status: number; data: unknown }> {
    try {
      const scope = query.scope
      if (!scope || typeof scope !== 'string') {
        return { status: 400, data: { error: 'scope is required' } }
      }

      const processedQuery: HistoryQuery = {
        limit: query.limit != null ? Number(query.limit) : undefined,
        offset: query.offset != null ? Number(query.offset) : undefined,
        sort: query.sort ? JSON.parse(query.sort as string) : undefined,
        filters: query.filters ? JSON.parse(query.filters as string) : undefined,
        eventType: query.eventType as string | undefined,
      }

      if (!this.store) {
        return { status: 503, data: { error: 'Event store not available' } }
      }

      const result = await this.store.list(scope, processedQuery)
      return { status: 200, data: result }
    } catch (err) {
      console.error('[NodeLens] History query error:', err)
      return this.handleStoreError(err)
    }
  }

  async handleHistoryClear(scope: string, eventType?: string): Promise<{ status: number; data: unknown }> {
    try {
      if (!scope) {
        return { status: 400, data: { error: 'scope is required' } }
      }

      if (!this.store) {
        return { status: 503, data: { error: 'Event store not available' } }
      }

      await this.store.clear(scope, eventType)
      return { status: 204, data: null }
    } catch (err) {
      console.error('[NodeLens] History clear error:', err)
      return this.handleStoreError(err)
    }
  }
}
