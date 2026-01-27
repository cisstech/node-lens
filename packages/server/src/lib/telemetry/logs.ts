/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReadableLogRecord } from '@opentelemetry/sdk-logs'

export interface LogData extends Omit<ReadableLogRecord, 'resource'> {
  timestamp: number
  resource: {
    attributes: Record<string, any>
  }
}
