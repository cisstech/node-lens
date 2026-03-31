// client/services/logging-service.ts
import type { NodeLensClient } from '@cisstech/node-lens-client';
import type { HistoryResult } from '@cisstech/node-lens-server';
import { type LogEvent, PLUGIN_NAME } from '../../server/types';

export interface LoggingServiceOptions {
  pageSize?: number;
  eventType?: string; // usually "logging"
}

export interface LoggingViewState {
  logs: LogEvent[];
  view: LogEvent[];
  totalCount: number;
  loading: boolean;
  error: string | null;
  isLoadingMore: boolean;
}

export class LoggingService {
  private options: Required<LoggingServiceOptions>;
  private abortController = new AbortController();

  constructor(
    private client: NodeLensClient,
    options: LoggingServiceOptions = {}
  ) {
    this.options = {
      pageSize: 50,
      eventType: 'logging',
      ...options,
    };
  }

  async initialize(): Promise<LoggingViewState> {
    try {
      const result = await this.fetchLogs();
      const logs = result.events.map((e) => e.data);
      return {
        logs,
        view: logs,
        totalCount: result.totalCount,
        loading: false,
        error: null,
        isLoadingMore: false,
      };
    } catch (error) {
      console.error('[LoggingService] Initialization failed:', error);
      return {
        logs: [],
        view: [],
        totalCount: 0,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch logs',
        isLoadingMore: false,
      };
    }
  }

  async loadMore(currentLogs: LogEvent[]): Promise<{
    logs: LogEvent[];
    totalCount: number;
  }> {
    const result = await this.client.events.list<LogEvent>(PLUGIN_NAME, {
      eventType: this.options.eventType,
      signal: this.abortController.signal,
      limit: this.options.pageSize,
      offset: currentLogs.length,
      sort: ['timestamp:asc'],
    }) as HistoryResult<LogEvent>;

    return {
      logs: [...currentLogs, ...result.events.map((e) => e.data)],
      totalCount: result.totalCount,
    };
  }

  subscribeToLogs(onNewLog: (log: LogEvent) => void): void {
    this.client.events.subscribe<LogEvent>(
      PLUGIN_NAME,
      (event) => onNewLog(event.data),
      this.abortController.signal
    );
  }

  canLoadMore(currentCount: number, totalCount: number): boolean {
    return currentCount < totalCount;
  }

  async clearLogs(): Promise<void> {
    await this.client.events.clear(PLUGIN_NAME, this.options.eventType);
  }

  destroy(): void {
    this.abortController.abort();
  }

  private async fetchLogs() {
    return await this.client.events.list(PLUGIN_NAME, {
      eventType: this.options.eventType,
      signal: this.abortController.signal,
      limit: this.options.pageSize,
      sort: ['timestamp:asc'],
    }) as HistoryResult<LogEvent>;
  }
}
