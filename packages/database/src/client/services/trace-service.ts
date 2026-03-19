import type { NodeLensClient } from '@cisstech/node-lens-client'
import type { HistoryResult } from '@cisstech/node-lens-server'
import type { DatabaseTrace } from '../../server/types.js'
import type { TraceServiceOptions, TraceViewState } from '../types.js'

/**
 * Service for managing trace data operations
 */
export class TraceService {
  private options: Required<TraceServiceOptions>
  private abortController = new AbortController()

  constructor(
    private client: NodeLensClient,
    options: TraceServiceOptions
  ) {
    this.options = {
      pageSize: 10,
      ...options
    }
  }

  /**
   * Initialize trace loading
   */
  async initialize(): Promise<TraceViewState> {
    try {
      const result = await this.fetchTraces()
      const traceData = result.events.map(e => e.data)
      return {
        traces: traceData,
        view: traceData,
        totalCount: result.totalCount,
        loading: false,
        error: null,
        isLoadingMore: false
      }
    } catch (error) {
      console.error('[TraceService] Initialization failed:', error)
      return {
        traces: [],
        view: [],
        totalCount: 0,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch traces',
        isLoadingMore: false
      }
    }
  }

  /**
   * Load more traces for pagination
   */
  async loadMore(currentTraces: DatabaseTrace[]): Promise<{
    traces: DatabaseTrace[]
    totalCount: number
  }> {
    const result = await this.client.events.list(
      this.options.pluginName,
      {
        eventType: this.options.eventType,
        signal: this.abortController.signal,
        limit: this.options.pageSize,
        offset: currentTraces.length,
        sort: ['timestamp:desc']
      }
    ) as HistoryResult<DatabaseTrace>;

    return {
      traces: [...currentTraces, ...result.events.map(e => e.data)],
      totalCount: result.totalCount
    }
  }

  /**
   * Subscribe to new traces
   */
  subscribeToTraces(onNewTrace: (trace: DatabaseTrace) => void): void {
    this.client.events.subscribe<DatabaseTrace>(
      this.options.pluginName,
      event => onNewTrace(event.data),
      this.abortController.signal
    )
  }

  /**
   * Check if more traces can be loaded
   */
  canLoadMore(currentCount: number, totalCount: number): boolean {
    return currentCount < totalCount
  }

  async clearTraces(): Promise<void> {
    await this.client.events.clear(this.options.pluginName, this.options.eventType)
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.abortController.abort()
  }

  private async fetchTraces() {
    return await this.client.events.list(
      this.options.pluginName,
      {
        eventType: this.options.eventType,
        signal: this.abortController.signal,
        limit: this.options.pageSize,
        sort: ['timestamp:desc']
      }
    ) as HistoryResult<DatabaseTrace>;
  }
}
