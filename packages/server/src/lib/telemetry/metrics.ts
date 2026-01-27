/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ResourceMetrics } from '@opentelemetry/sdk-metrics'

export interface MetricData {
  resource: {
    attributes: Record<string, any>
  }
  dataPointType: ResourceMetrics['scopeMetrics'][number]['metrics'][number]['dataPointType']
  descriptor: ResourceMetrics['scopeMetrics'][number]['metrics'][number]['descriptor']
  aggregationTemporality: number
  dataPoints: ResourceMetrics['scopeMetrics'][number]['metrics'][number]['dataPoints']
  timestamp: number
}
