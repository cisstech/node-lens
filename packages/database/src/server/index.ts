/* eslint-disable @typescript-eslint/no-explicit-any */

// Core NodeLens imports
import {
  buildSpanTree,
  CommandChain,
  OTEL_TRACE_EVENT,
  TraceData,
  type EventBus,
  type NodeLensPlugin,
} from '@cisstech/node-lens-server'

// OpenTelemetry imports
import type { Instrumentation } from '@opentelemetry/instrumentation'
import { IORedisInstrumentation, IORedisRequestHookInformation } from '@opentelemetry/instrumentation-ioredis'
import { KnexInstrumentation } from '@opentelemetry/instrumentation-knex'
import { MemcachedInstrumentation } from '@opentelemetry/instrumentation-memcached'
import { MongoDBInstrumentation, MongoResponseHookInformation } from '@opentelemetry/instrumentation-mongodb'
import { MongooseInstrumentation } from '@opentelemetry/instrumentation-mongoose'
import { MySQLInstrumentation } from '@opentelemetry/instrumentation-mysql'
import { MySQL2Instrumentation, MySQL2ResponseHookInformation } from '@opentelemetry/instrumentation-mysql2'
import { OracleInstrumentation } from '@opentelemetry/instrumentation-oracledb'
import { PgInstrumentation, PgResponseHookInformation } from '@opentelemetry/instrumentation-pg'
import { RedisInstrumentation } from '@opentelemetry/instrumentation-redis'

// Plugin types and utilities
import { Span } from '@opentelemetry/api'
import { hrTimeToMilliseconds } from '@opentelemetry/core'
import {
  ListConnectionsCommandHandler,
  MySqlExplainCommandHandler,
  PgExplainCommandHandler,
  PlaygroundQueryCommandHandler,
} from './commands/index.js'
import {
  PLUGIN_EVENTS,
  PLUGIN_NAME,
  type DatabaseConnection,
  type DatabaseConnectionConfig,
  type DatabasePluginOptions,
  type DatabaseQuerySpan,
  type DatabaseTrace,
} from './types'
import { DatabaseEngineFactory } from './utils/database-engines'
import {
  buildCallStacks,
  calculateQueryCounts,
  extractContextMetadata,
  findDuplicateQueries,
  findExceptionUpTree,
  generateTraceWarnings,
} from './utils/trace-utils'

const PLUGIN_DEFAULTS = {
  redactParams: false,
  slowQueryMs: 80,
  duplicateBurstThreshold: 5,
  connections: {},
} satisfies Required<DatabasePluginOptions>

export class DatabasePlugin implements NodeLensPlugin {
  // Plugin metadata
  readonly icon = 'database'
  readonly tagName = 'nl-database'
  readonly displayName = 'Database'
  readonly description = 'Monitor database traces'
  readonly packageName = PLUGIN_NAME

  // Internal state
  private eventBus?: EventBus
  private config: Required<DatabasePluginOptions>
  private commandChain: CommandChain

  constructor(options?: DatabasePluginOptions) {
    this.config = {
      ...PLUGIN_DEFAULTS,
      ...options,
    }

    // Build connections list from configuration
    const connections = this.buildConnectionsList()

    this.commandChain = new CommandChain()
      .addHandler(new PgExplainCommandHandler((dbSystem, database) => this.getConnectionConfig(dbSystem, database)))
      .addHandler(new MySqlExplainCommandHandler((dbSystem, database) => this.getConnectionConfig(dbSystem, database)))
      .addHandler(new PlaygroundQueryCommandHandler((dbSystem, database) => this.getConnectionConfig(dbSystem, database)))
      .addHandler(new ListConnectionsCommandHandler(connections))
  }

  bindToEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus

    eventBus.on<TraceData[]>(OTEL_TRACE_EVENT, (event) => {
      const spans = event.data
      const spanTree = buildSpanTree(spans, ['resource'])
      const spanLookup = this.createSpanLookup(spans)

      for (const rootSpan of spanTree) {
        const envelope = this.buildDatabaseTrace(rootSpan, spanLookup)
        if (envelope) {
          this.eventBus?.emit(PLUGIN_EVENTS.QUERY, envelope, this.packageName)
        }
      }
    })
  }


  instrumentations(): Instrumentation[] {
    const { redactParams } = this.config
    const enableDetailedReporting = !redactParams

    return [
      new PgInstrumentation({
        enhancedDatabaseReporting: enableDetailedReporting,
        addSqlCommenterCommentToQueries: true,
        responseHook: (span: any, response) => {
          this.addPostgreSQLAttributes(span, response)
        }
      }),
      new MySQLInstrumentation({ enhancedDatabaseReporting: enableDetailedReporting }),
      new MySQL2Instrumentation({
        addSqlCommenterCommentToQueries: true,
        responseHook: (span: any, response) => {
          this.addMySQLAttributes(span, response)
        }
      }),
      new MongoDBInstrumentation({
        enhancedDatabaseReporting: enableDetailedReporting,
        responseHook: (span: any, response) => {
          this.addMongoDBAttributes(span, response)
        }
      }),
      new MongooseInstrumentation({}),
      new RedisInstrumentation({
        responseHook: (span: any, response) => {
          this.addRedisAttributes(span, response)
        }
      }),
      new IORedisInstrumentation({
        requestHook: (span: any, command) => {
          this.addIORedisRequestAttributes(span, command)
        },
        responseHook: (span: any, response) => {
          this.addIORedisResponseAttributes(span, response)
        }
      }),
      new MemcachedInstrumentation({ enhancedDatabaseReporting: enableDetailedReporting }),
      new OracleInstrumentation({ enhancedDatabaseReporting: enableDetailedReporting }),
      new KnexInstrumentation({}),
    ]
  }

  private createSpanLookup(spans: TraceData[]): Map<string, TraceData> {
    const lookup = new Map<string, TraceData>()
    for (const span of spans) {
      lookup.set(span.spanId, span)
    }
    return lookup
  }

  private buildConnectionsList(): DatabaseConnection[] {
    const connections: DatabaseConnection[] = []

    if (!this.config.connections) {
      return connections
    }

    // Process each database system
    Object.entries(this.config.connections).forEach(([dbSystem, databaseConfigs]) => {
      if (databaseConfigs) {
        Object.entries(databaseConfigs).forEach(([database, config]) => {
          const connectionId = `${dbSystem}:${database}`
          connections.push({
            id: connectionId,
            name: `${dbSystem.toUpperCase()} - ${database}`,
            dbSystem,
            database,
            host: config.host,
            port: config.port,
            user: config.user,
            isDefault: connections.length === 0 // First connection is default
          })
        })
      }
    })

    return connections
  }

  private addPostgreSQLAttributes(span: Span, response: PgResponseHookInformation): void {
    if (response.data?.command) {
      span.setAttributes({
        'db.postgresql.command': response.data.command,
        'db.postgresql.row_count': response.data.rowCount || 0,
      })
    }
    // db.statement must keep its bind placeholders ($1, $2 …) so the query
    // signature groups repeated executions; the engine formats it for display.
  }

  private addMySQLAttributes(span: Span, response: MySQL2ResponseHookInformation): void {
    const result = response.queryResults
    if (result) {
      span.setAttributes({
        'db.mysql.affected_rows': result.affectedRows || 0,
        'db.mysql.insert_id': result.insertId || 0,
        'db.mysql.field_count': result.fieldCount || 0,
      })
    }

    // db.statement must keep its ? placeholders so the query signature groups
    // repeated executions; the engine formats it for display.
  }

  private addMongoDBAttributes(span: Span, response: MongoResponseHookInformation): void {
    if (response.data) {
      const data = response.data as any
      const attrs: Record<string, any> = {}

      // Handle different MongoDB response structures
      if (data.elements && Array.isArray(data.elements)) {
        attrs['db.mongodb.result_count'] = data.elements.length
      } else if (Array.isArray(data)) {
        attrs['db.mongodb.result_count'] = data.length
      }

      // Handle CRUD operation results
      if (data.insertedId) attrs['db.mongodb.inserted_id'] = String(data.insertedId)
      if (data._id) attrs['db.mongodb.inserted_id'] = String(data._id)
      if (data.matchedCount !== undefined) attrs['db.mongodb.matched_count'] = data.matchedCount
      if (data.modifiedCount !== undefined) attrs['db.mongodb.modified_count'] = data.modifiedCount
      if (data.deletedCount !== undefined) attrs['db.mongodb.deleted_count'] = data.deletedCount

      span.setAttributes(attrs)
    }
  }

  private addRedisAttributes(span: Span, response: string): void {
    if (response !== undefined) {
      span.setAttributes({
        'db.redis.response_type': typeof response,
        'db.redis.response_length': Array.isArray(response) ? response.length : 0,
      })
    }
  }

  private addIORedisRequestAttributes(span: Span, command: IORedisRequestHookInformation): void {
    if (command) {
      const attrs: Record<string, any> = {}
      attrs['db.redis.command'] = command.cmdName?.toLowerCase() || ''

      if (command.cmdArgs && Array.isArray(command.cmdArgs)) {
        attrs['db.redis.args'] = JSON.stringify(command.cmdArgs)
        if (command.cmdArgs[0]) {
          attrs['db.redis.key'] = String(command.cmdArgs[0])
        }
      }

      span.setAttributes(attrs)
    }
  }

  private addIORedisResponseAttributes(span: Span, response: string): void {
    if (response !== undefined) {
      const attrs: Record<string, any> = {
        'db.redis.response_type': typeof response,
      }

      if (Array.isArray(response)) {
        attrs['db.redis.response_length'] = response.length
        attrs['db.redis.response_value'] = JSON.stringify(response.slice(0, 3))
      } else if (typeof response === 'string' || typeof response === 'number') {
        attrs['db.redis.response_value'] = String(response)
      }

      span.setAttributes(attrs)
    }
  }

  async handleCommand(command: string, payload?: unknown): Promise<unknown> {
    return this.commandChain.execute(command, payload)
  }

  private getConnectionConfig(dbSystem: string, database: string): DatabaseConnectionConfig | undefined {
    const { connections } = this.config
    switch (dbSystem.toLowerCase()) {
      case 'postgresql':
      case 'postgres':
      case 'pg':
        return connections.postgresql?.[database]
      case 'mysql':
      case 'mysql2':
        return connections.mysql?.[database]
      case 'mongodb':
      case 'mongo':
        return connections.mongodb?.[database]
      case 'redis':
      case 'ioredis':
        return connections.redis?.[database]
      default:
        return undefined
    }
  }

  private buildDatabaseTrace(rootSpan: TraceData, spanLookup: Map<string, TraceData>): DatabaseTrace | null {
    const queries: DatabaseQuerySpan[] = []
    this.collectQueries(rootSpan, spanLookup, queries)

    // Only create envelope if we have valid queries
    if (queries.length === 0) return null

    const { context, method, route } = extractContextMetadata(rootSpan)
    const totalDurationMs = hrTimeToMilliseconds(rootSpan.duration)
    const startTimeMs = hrTimeToMilliseconds(rootSpan.startTime)
    const endTimeMs = startTimeMs + totalDurationMs

    const duplicateGroups = findDuplicateQueries(queries, this.config.duplicateBurstThreshold)
    const { slowQueryCount, errorCount, uniqueQueryCount } = calculateQueryCounts(queries, this.config.slowQueryMs)

    const warnings = generateTraceWarnings(duplicateGroups, slowQueryCount, errorCount)
    const callStacks = buildCallStacks(queries, spanLookup)

    return {
      traceId: rootSpan.traceId,
      rootSpanId: rootSpan.spanId,
      timestamp: rootSpan.timestamp,
      startTimeMs,
      endTimeMs,
      context,
      method,
      route,
      totalDurationMs,
      queryCount: queries.length,
      uniqueQueryCount,
      slowQueryCount,
      errorCount,
      warnings,
      duplicateGroups,
      queries,
      callStacks,
    }
  }

  private collectQueries(span: TraceData, spanLookup: Map<string, TraceData>, queries: DatabaseQuerySpan[]): void {
    if (!span) return

    const { attributes } = span
    const dbSystem = attributes['db.system']

    if (dbSystem) {
      const querySpan = this.createQuerySpan(span, spanLookup, attributes)
      if (querySpan) {
        queries.push(querySpan)
      }
    }

    for (const child of span.children ?? []) {
      if (!child.parentSpanId) {
        child.parentSpanId = span.spanId
      }
      spanLookup.set(child.spanId, child)
      this.collectQueries(child, spanLookup, queries)
    }
  }

  private createQuerySpan(span: TraceData, spanLookup: Map<string, TraceData>, attributes: Record<string, any>): DatabaseQuerySpan | null {
    const dbSystem = attributes['db.system']
    const engine = DatabaseEngineFactory.getEngine(dbSystem)
    if (!engine) return null

    // Use database-specific engine for precise extraction
    const info = engine.extractInfo(attributes, this.config.redactParams)
    if (!info?.statement?.trim()) return null

    return {
      spanId: span.spanId,
      parentSpanId: span.parentSpanId,
      traceId: span.traceId,
      startTimeMs: hrTimeToMilliseconds(span.startTime),
      durationMs: hrTimeToMilliseconds(span.duration),
      dbSystem,
      operation: info.operation,
      statement: info.statement,
      normalizedStatement: info.normalizedStatement,
      parameters: info.parameters,
      resource: info.resource,
      isError: span.isError,
      error: findExceptionUpTree(span, spanLookup),
      metadata: info.metadata
    }
  }
}
