import type { DatabaseTrace } from '../../server/types.js'
import type { FilterState, FilterOption, FilterServiceOptions } from '../types.js'
import { QueryFormatter } from './query-utils.js'

/**
 * Filter strategy interface
 */
interface FilterStrategy {
  apply(traces: DatabaseTrace[], filterState: FilterState): DatabaseTrace[]
}

/**
 * Time range filter strategy
 */
class TimeRangeFilterStrategy implements FilterStrategy {
  apply(traces: DatabaseTrace[], filterState: FilterState): DatabaseTrace[] {
    if (filterState.timeRangeFilter === 'all') return traces

    const now = Date.now()
    const timeThresholds = {
      '1h': now - 60 * 60 * 1000,
      '24h': now - 24 * 60 * 60 * 1000,
      '7d': now - 7 * 24 * 60 * 60 * 1000
    }

    const threshold = timeThresholds[filterState.timeRangeFilter as keyof typeof timeThresholds]
    if (!threshold) return traces

    return traces.filter(trace => trace.startTimeMs >= threshold)
  }
}

/**
 * Search filter strategy
 */
class SearchFilterStrategy implements FilterStrategy {
  apply(traces: DatabaseTrace[], filterState: FilterState): DatabaseTrace[] {
    if (!filterState.search) return traces

    const terms = filterState.search.toLowerCase().split(' ').filter(t => t.trim())
    if (terms.length === 0) return traces

    return traces.filter(trace => {
      const searchableText = [
        trace.route || '',
        trace.method || '',
        ...trace.queries.map(q => [
          q.statement || '',
          q.resource || '',
          q.operation || '',
          q.dbSystem || ''
        ].join(' '))
      ].join(' ').toLowerCase()

      return terms.every(term => searchableText.includes(term))
    })
  }
}

/**
 * Resource filter strategy
 */
class ResourceFilterStrategy implements FilterStrategy {
  apply(traces: DatabaseTrace[], filterState: FilterState): DatabaseTrace[] {
    if (!filterState.resourceFilter) return traces

    const resourceTerm = filterState.resourceFilter.toLowerCase()
    return traces.filter(trace =>
      trace.queries.some(q =>
        q.resource?.toLowerCase().includes(resourceTerm)
      )
    )
  }
}

/**
 * Database engine filter strategy
 */
class DatabaseEngineFilterStrategy implements FilterStrategy {
  apply(traces: DatabaseTrace[], filterState: FilterState): DatabaseTrace[] {
    if (filterState.dbEngine === 'all') return traces

    return traces.filter(trace =>
      trace.queries.some(q =>
        q.dbSystem?.toLowerCase() === filterState.dbEngine.toLowerCase()
      )
    )
  }
}

/**
 * Query type filter strategy
 */
class QueryTypeFilterStrategy implements FilterStrategy {
  apply(traces: DatabaseTrace[], filterState: FilterState): DatabaseTrace[] {
    if (filterState.queryTypeFilter === 'all') return traces

    const filterType = filterState.queryTypeFilter.toUpperCase()
    return traces.filter(trace =>
      trace.queries.some(q => {
        const operation = q.operation?.toUpperCase() || ''
        const statement = q.statement?.toUpperCase() || ''
        return operation.includes(filterType) || statement.startsWith(filterType)
      })
    )
  }
}

/**
 * Duration filter strategy
 */
class DurationFilterStrategy implements FilterStrategy {
  apply(traces: DatabaseTrace[], filterState: FilterState): DatabaseTrace[] {
    if (filterState.durationFilter === 'all') return traces

    return traces.filter(trace => {
      const maxDuration = Math.max(...trace.queries.map(q => q.durationMs))
      switch (filterState.durationFilter) {
        case '<50ms': return maxDuration < 50
        case '50-200ms': return maxDuration >= 50 && maxDuration < 200
        case '200ms-1s': return maxDuration >= 200 && maxDuration < 1000
        case '>1s': return maxDuration >= 1000
        default: return true
      }
    })
  }
}

/**
 * Category filter strategy
 */
class CategoryFilterStrategy implements FilterStrategy {
  constructor(private options: FilterServiceOptions) {}

  apply(traces: DatabaseTrace[], filterState: FilterState): DatabaseTrace[] {
    switch (filterState.filter) {
      case 'slow':
        return traces.filter(trace =>
          trace.queries.some(q =>
            QueryFormatter.isSlowQuery(q, this.options.slowThreshold)
          )
        )
      case 'errors':
        return traces.filter(trace =>
          trace.queries.some(q => QueryFormatter.hasError(q))
        )
      case 'n1':
        return traces.filter(trace =>
          trace.duplicateGroups.length > 0 ||
          trace.warnings.some(w => w.toLowerCase().includes('n+1'))
        )
      case 'background':
        return traces.filter(trace => trace.context === 'background')
      case 'http':
        return traces.filter(trace => trace.context === 'http' || trace.method)
      default:
        return traces
    }
  }
}

/**
 * Filter service that applies multiple filter strategies
 */
export class FilterService {
  private strategies: FilterStrategy[]

  constructor(private options: FilterServiceOptions = {}) {
    this.options = {
      slowThreshold: 80,
      duplicateBurstThreshold: 5,
      ...options
    }

    this.strategies = [
      new TimeRangeFilterStrategy(),
      new SearchFilterStrategy(),
      new ResourceFilterStrategy(),
      new DatabaseEngineFilterStrategy(),
      new QueryTypeFilterStrategy(),
      new DurationFilterStrategy(),
      new CategoryFilterStrategy(this.options)
    ]
  }

  /**
   * Apply all filters to traces
   */
  applyFilters(traces: DatabaseTrace[], filterState: FilterState): DatabaseTrace[] {
    return this.strategies.reduce((filtered, strategy) => {
      return strategy.apply(filtered, filterState)
    }, [...traces])
  }

  /**
   * Get available query type options from traces
   */
  getQueryTypeOptions(traces: DatabaseTrace[]): FilterOption[] {
    const types = new Set<string>()

    traces.forEach(trace => {
      trace.queries.forEach(query => {
        if (query.operation) {
          types.add(query.operation.toUpperCase())
        }

        // Extract operation from statement for SQL
        const extracted = QueryFormatter.extractSqlOperation(query.statement || '')
        if (extracted) {
          types.add(extracted)
        }
      })
    })

    const options: FilterOption[] = [{ value: 'all', label: 'All Types' }]
    return options.concat(
      Array.from(types)
        .sort()
        .map(type => ({ value: type, label: type }))
    )
  }

  /**
   * Get available database engine options from traces
   */
  getDatabaseEngineOptions(traces: DatabaseTrace[]): FilterOption[] {
    const engines = new Set<string>()

    traces.forEach(trace => {
      trace.queries.forEach(query => {
        if (query.dbSystem) {
          engines.add(query.dbSystem.toLowerCase())
        }
      })
    })

    return [{ value: 'all', label: 'All Databases' }].concat(
      Array.from(engines)
        .sort()
        .map(engine => ({
          value: engine,
          label: this.getEngineDisplayName(engine)
        }))
    )
  }

  /**
   * Get predefined filter options
   */
  static getDurationFilterOptions(): FilterOption[] {
    return [
      { value: 'all', label: 'All durations' },
      { value: '<50ms', label: '< 50ms (fast)' },
      { value: '50-200ms', label: '50-200ms (normal)' },
      { value: '200ms-1s', label: '200ms-1s (slow)' },
      { value: '>1s', label: '> 1s (very slow)' }
    ]
  }

  static getTimeRangeFilterOptions(): FilterOption[] {
    return [
      { value: 'all', label: 'All time' },
      { value: '1h', label: 'Last hour' },
      { value: '24h', label: 'Last 24 hours' },
      { value: '7d', label: 'Last 7 days' }
    ]
  }

  private getEngineDisplayName(engine: string): string {
    const displayNames: Record<string, string> = {
      postgresql: 'PostgreSQL',
      mysql: 'MySQL',
      mysql2: 'MySQL',
      mongodb: 'MongoDB',
      mongo: 'MongoDB',
      redis: 'Redis',
      ioredis: 'Redis'
    }

    return displayNames[engine] || engine.charAt(0).toUpperCase() + engine.slice(1)
  }
}
