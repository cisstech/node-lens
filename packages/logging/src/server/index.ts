// server/plugin.ts
import { EventBus, LogData, NodeLensPlugin, OTEL_LOG_EVENT } from '@cisstech/node-lens-server';
import { hrTimeToMilliseconds } from '@opentelemetry/core';
import { Instrumentation } from '@opentelemetry/instrumentation';
import { NodeLensLoggingInstrumentation } from './instrumentation';
import { LogEvent, PLUGIN_NAME } from './types';

export class LoggingPlugin implements NodeLensPlugin {
  readonly icon = 'output';
  readonly tagName = 'nl-logging';
  readonly displayName = 'Logging';
  readonly description = 'Capture and correlate logs with traces';
  readonly packageName = PLUGIN_NAME;

  private eventBus?: EventBus;

  bindToEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus;

    eventBus.on<LogData[]>(OTEL_LOG_EVENT, (event) => {
      for (const log of event.data) {
        const logEvent: LogEvent = {
          traceId: log.spanContext?.traceId,
          spanId: log.spanContext?.spanId,
          timestamp: hrTimeToMilliseconds(log.hrTime),
          severity: (log.severityText?.toUpperCase() as LogEvent['severity']) ?? 'INFO',
          message: log.body?.toString() ?? '',
          attributes: log.attributes,
        };

        this.eventBus?.emit('logging', logEvent, this.packageName);
      }
    });
  }

  instrumentations(): Instrumentation[] {
    return [new NodeLensLoggingInstrumentation()];
  }
}
