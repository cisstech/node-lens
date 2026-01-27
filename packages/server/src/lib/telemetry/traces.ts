/* eslint-disable @typescript-eslint/no-explicit-any */
import { hrTimeToNanoseconds } from '@opentelemetry/core'
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base'

export interface TraceData extends Omit<ReadableSpan, 'spanContext' | 'resource'> {
  /**
   * A globally unique identifier for a trace, represented as a 32-character hexadecimal string.
   * All spans within a trace share the same trace ID.
   * @note Extracted and adapted from ReadableSpan.spanContext()
   * @see https://opentelemetry.io/docs/reference/specification/trace/api/#traceid
   */
  traceId: string

  /**
   * A single operation within a trace, representing a unit of work done in a distributed system.
   * Spans can be nested to form a trace tree. Each span contains metadata about the operation,
   * including its name, start and end timestamps, attributes, events, links to other spans,
   * and status information.
   * @note Extracted and adapted from ReadableSpan.spanContext()
   * @see https://opentelemetry.io/docs/reference/specification/trace/api/#span
   */
  spanId: string

  parentSpanId?: string

  resource: {
    attributes: Record<string, any>
  }

  timestamp: number
  instrumentationName?: string
  isError: boolean
  children?: TraceData[]
}

// Every plugin that consumes a trace batch calls buildSpanTree on the same spans
// array (the event bus hands each subscriber the same reference), so the tree is
// memoized per batch and reused. The batch array is the key, so entries are
// garbage-collected once the batch is done. Callers must treat the tree as
// read-only, since they share it.
const treeCache = new WeakMap<TraceData[], Map<string, TraceData[]>>()

export const buildSpanTree = (spans: TraceData[], stripProps?: (keyof TraceData)[]): TraceData[] => {
  const cacheKey = stripProps ? stripProps.join(',') : ''
  let byStrip = treeCache.get(spans)
  if (byStrip) {
    const cached = byStrip.get(cacheKey)
    if (cached) return cached
  } else {
    byStrip = new Map()
    treeCache.set(spans, byStrip)
  }

  // Sort spans once globally -> children insertion order will be chronological
  const sorted = [...spans]
    .map((span) => {
      if (stripProps) {
        // Create a copy to avoid mutating the original span
        const spanCopy = { ...span }
        for (const prop of stripProps) {
          delete spanCopy[prop]
        }
        return spanCopy
      }
      return span
    })
    .sort((a, b) => hrTimeToNanoseconds(a.startTime) - hrTimeToNanoseconds(b.startTime))

  const nodes = new Map<string, TraceData>()
  const roots: TraceData[] = []

  // First create all nodes
  for (const span of sorted) {
    nodes.set(span.spanId, { ...span, children: [] })
  }

  // Then link children to parents
  for (const span of sorted) {
    const node = nodes.get(span.spanId)
    if (!node) continue // Should not happen

    if (span.parentSpanId) {
      const parent = nodes.get(span.parentSpanId)
      if (parent) {
        parent.children = parent.children || []
        parent.children.push(node)
      } else {
        // Orphan span: parent not in this trace → treat as root
        roots.push(node)
      }
    } else {
      roots.push(node)
    }
  }

  byStrip.set(cacheKey, roots)
  return roots
}
