import { ExportResultCode, hrTimeToMilliseconds, type ExportResult } from '@opentelemetry/core';
import type { LogRecordExporter, ReadableLogRecord } from '@opentelemetry/sdk-logs';
import type { PushMetricExporter, ResourceMetrics } from '@opentelemetry/sdk-metrics';
import type {
  ReadableSpan,
  SpanExporter,
} from '@opentelemetry/sdk-trace-base';
import { NodeLensEventBus } from '../events/bus';
import { LogData } from './logs';
import { MetricData } from './metrics';
import { TraceData } from './traces';


export const OTEL_EVENT_SCOPE = 'opentelemetry';
export const OTEL_LOG_EVENT = 'opentelemetry.log';
export const OTEL_METRIC_EVENT = 'opentelemetry.metric';
export const OTEL_TRACE_EVENT = 'opentelemetry.trace';

/**
 * A custom OpenTelemetry trace exporter for NodeLens.
 */
export class NodeLensTraceExporter implements SpanExporter {
  private eventBus: NodeLensEventBus;

  constructor(eventBus: NodeLensEventBus) {
    this.eventBus = eventBus;
  }

  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    const data = spans.map<TraceData>((span) => ({
      traceId: span.spanContext()?.traceId,
      spanId: span.spanContext()?.spanId,
      traceFlags: span.spanContext()?.traceFlags,
      name: span.name,
      kind: span.kind,
      parentSpanId: span.parentSpanContext?.spanId,
      startTime: span.startTime,
      endTime: span.endTime,
      duration: span.duration,
      status: span.status,
      links: span.links,
      events: span.events,
      attributes: span.attributes,
      resource: {
        attributes: span.resource?.attributes || {},
      },
      droppedAttributesCount: span.droppedAttributesCount,
      droppedEventsCount: span.droppedEventsCount,
      droppedLinksCount: span.droppedLinksCount,

      // Span start time (batches share an export moment, so this preserves order).
      timestamp: hrTimeToMilliseconds(span.startTime),
      instrumentationName: span.instrumentationScope?.name,
      isError: span.status?.code === 2,
      ended: span.ended,
      instrumentationScope: {
        name: span.instrumentationScope?.name,
        version: span.instrumentationScope?.version,
        schemaUrl: span.instrumentationScope?.schemaUrl,
      }
    }));
    this.eventBus.emit(OTEL_TRACE_EVENT, data, OTEL_EVENT_SCOPE);
    resultCallback({ code: ExportResultCode.SUCCESS });
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }
}

/**
 * A custom OpenTelemetry metric exporter for NodeLens.
 */
export class NodeLensMetricExporter implements PushMetricExporter {
  private eventBus: NodeLensEventBus;

  constructor(eventBus: NodeLensEventBus) {
    this.eventBus = eventBus;
  }

  export(metrics: ResourceMetrics, resultCallback: (result: ExportResult) => void): void {
    const data: MetricData[] = [];
    for (const scopeMetrics of metrics.scopeMetrics) {
      for (const metric of scopeMetrics.metrics) {
        data.push({
          resource: {
            attributes: metrics.resource?.attributes || {},
          },
          dataPointType: metric.dataPointType,
          dataPoints: metric.dataPoints,
          descriptor: metric.descriptor,
          aggregationTemporality: metric.aggregationTemporality,
          timestamp: Date.now(),
        });
      }
    }

    this.eventBus.emit(OTEL_METRIC_EVENT, data, OTEL_EVENT_SCOPE);
    resultCallback({ code: ExportResultCode.SUCCESS });
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }
}

/**
 * A custom OpenTelemetry log record exporter for NodeLens.
 */
export class NodeLensLogRecordExporter implements LogRecordExporter {
  private eventBus: NodeLensEventBus;

  constructor(eventBus: NodeLensEventBus) {
    this.eventBus = eventBus;
  }

  export(logRecords: ReadableLogRecord[], resultCallback: (result: ExportResult) => void): void {
    const data = logRecords.map<LogData>((logRecord) => ({
      body: logRecord.body,
      attributes: logRecord.attributes,
      severityText: logRecord.severityText,
      severityNumber: logRecord.severityNumber,
      hrTime: logRecord.hrTime,
      hrTimeObserved: logRecord.hrTimeObserved,
      instrumentationScope: {
        name: logRecord.instrumentationScope?.name,
        version: logRecord.instrumentationScope?.version,
        schemaUrl: logRecord.instrumentationScope?.schemaUrl,
      },
      eventName: logRecord.eventName,
      droppedAttributesCount: logRecord.droppedAttributesCount,
      resource: {
        attributes: logRecord.resource?.attributes || {},
      },
      // The log record's own emission time.
      timestamp: hrTimeToMilliseconds(logRecord.hrTime),
    }));
    this.eventBus.emit(OTEL_LOG_EVENT, data, OTEL_EVENT_SCOPE);
    resultCallback({ code: ExportResultCode.SUCCESS });
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }
}
