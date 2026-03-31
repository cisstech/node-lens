/* eslint-disable @typescript-eslint/no-explicit-any */
export const PLUGIN_NAME = '@cisstech/node-lens-logging';

export interface LogEvent {
  traceId?: string;
  spanId?: string;
  timestamp: number;
  severity: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'TRACE' | 'FATAL' | 'LOG';
  message: string;
  attributes?: Record<string, any>;
}
