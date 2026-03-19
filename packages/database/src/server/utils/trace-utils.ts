/* eslint-disable @typescript-eslint/no-explicit-any */
import type { TraceData } from '@cisstech/node-lens-server'
import type { DatabaseQuerySpan, DuplicateQueryGroup, TraceWarning, DatabaseQueryError } from '../types'

/**
 * Create a normalized signature for a database query to detect duplicates
 */
export function createQuerySignature(query: DatabaseQuerySpan): string {
  // Prefer the parameterized template (with $1 / ? placeholders intact) so that
  // repeated executions of the same prepared statement collapse to one signature.
  // Fall back to the display statement when no template is available.
  const source = query.normalizedStatement ?? query.statement
  const normalized = source
    .replace(/\s+/g, ' ')
    .replace(/\$\d+/g, '?')
    .replace(/\?/g, '?') // Normalize all parameter placeholders
    .trim()
  return `${query.operation}|${query.resource ?? 'unknown'}|${normalized}`
}

/**
 * Count unique queries based on their signatures
 */
export function countUniqueQueries(queries: DatabaseQuerySpan[]): number {
  const signatures = new Set<string>()
  for (const query of queries) {
    signatures.add(createQuerySignature(query))
  }
  return signatures.size
}

/**
 * Detect if a group of queries represents an N+1 problem
 */
export function isNPlusOneProblem(items: DatabaseQuerySpan[], duplicateBurstThreshold: number): boolean {
  if (items.length < duplicateBurstThreshold) return false

  const first = items[0]
  if (!first.operation.startsWith('SELECT')) return false

  // When bind parameters were captured, a genuine N+1 loops over varying values,
  // so distinct parameters across the burst are a strong positive signal.
  const withParams = items.filter((item) => item.parameters && item.parameters.length > 0)
  if (withParams.length === items.length) {
    const serializedParams = new Set(withParams.map((item) => JSON.stringify(item.parameters)))
    return serializedParams.size > 1
  }

  // Parameters were not captured (redaction on, or the driver did not expose
  // them): a burst of identically-shaped SELECTs inside a single trace is
  // itself the N+1 smell.
  return true
}

/**
 * Find duplicate query groups based on query signatures
 */
export function findDuplicateQueries(
  queries: DatabaseQuerySpan[],
  duplicateBurstThreshold: number
): DuplicateQueryGroup[] {
  const groups = new Map<string, { sample: DatabaseQuerySpan; items: DatabaseQuerySpan[] }>()

  for (const query of queries) {
    const signature = createQuerySignature(query)
    const group = groups.get(signature)
    if (group) {
      group.items.push(query)
    } else {
      groups.set(signature, { sample: query, items: [query] })
    }
  }

  const result: DuplicateQueryGroup[] = []
  for (const [signature, { sample, items }] of groups) {
    if (items.length < duplicateBurstThreshold) continue

    const suspectedNPlusOne = isNPlusOneProblem(items, duplicateBurstThreshold)
    result.push({
      signature,
      statement: sample.statement,
      resource: sample.resource,
      count: items.length,
      totalDurationMs: items.reduce((sum, q) => sum + q.durationMs, 0),
      sampleParams: items[0]?.parameters,
      suspectedNPlusOne,
    })
  }

  return result.sort((a, b) => b.totalDurationMs - a.totalDurationMs)
}

/**
 * Generate trace warnings based on query analysis
 */
export function generateTraceWarnings(
  duplicateGroups: DuplicateQueryGroup[],
  slowQueryCount: number,
  errorCount: number
): TraceWarning[] {
  const warnings: TraceWarning[] = []
  if (duplicateGroups.some((g) => g.suspectedNPlusOne)) warnings.push('duplicate')
  if (slowQueryCount > 0) warnings.push('slow')
  if (errorCount > 0) warnings.push('error')
  return warnings
}

/**
 * Build call stacks for queries based on span hierarchy
 */
export function buildCallStacks(
  queries: DatabaseQuerySpan[],
  spanLookup: Map<string, TraceData>
): Record<string, string[]> {
  const cache = new Map<string, string[]>()

  const buildChain = (spanId?: string): string[] => {
    if (!spanId) return []

    const cached = cache.get(spanId)
    if (cached) return cached

    const span = spanLookup.get(spanId)
    if (!span) {
      cache.set(spanId, [])
      return []
    }

    const chain = span.parentSpanId ? [...buildChain(span.parentSpanId), span.name] : [span.name]
    cache.set(spanId, chain)
    return chain
  }

  const stacks: Record<string, string[]> = {}
  for (const query of queries) {
    stacks[query.spanId] = buildChain(query.spanId)
  }
  return stacks
}

/**
 * Extract context metadata from root span
 */
export function extractContextMetadata(rootSpan: TraceData): {
  context: 'http' | 'background';
  method?: string;
  route?: string
} {
  const attributes = rootSpan.attributes as Record<string, any>
  const method = attributes['http.method']

  if (method) {
    const route = (attributes['http.route'] || attributes['http.target'] || rootSpan.name)
    return { context: 'http', method: method.toUpperCase(), route }
  }

  return { context: 'background', route: rootSpan.name }
}

/**
 * Find exception information by traversing up the span tree
 */
export function findExceptionUpTree(
  span: TraceData,
  spanLookup: Map<string, TraceData>
): DatabaseQueryError | undefined {
  let current: TraceData | undefined = span
  while (current) {
    const exception = current.events?.find((e) => e.name === 'exception')
    if (exception?.attributes) {
      return {
        type: exception.attributes['exception.type'] as string | undefined,
        message: exception.attributes['exception.message'] as string | undefined,
        stacktrace: exception.attributes['exception.stacktrace'] as string | undefined,
      }
    }
    current = current.parentSpanId ? spanLookup.get(current.parentSpanId) : undefined
  }
  return undefined
}

/**
 * Calculate query counts for trace analysis
 */
export function calculateQueryCounts(
  queries: DatabaseQuerySpan[],
  slowQueryMs: number
): {
  slowQueryCount: number;
  errorCount: number;
  uniqueQueryCount: number;
} {
  const slowQueryCount = queries.filter((q) => q.durationMs >= slowQueryMs).length
  const errorCount = queries.filter((q) => q.isError).length
  const uniqueQueryCount = countUniqueQueries(queries)

  return { slowQueryCount, errorCount, uniqueQueryCount }
}
