/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  formatSQLStatement,
  formatMongoStatement,
  extractSQLOperation,
  extractSQLResource,
  parseArrayString,
  normalizeMongoOperation,
  extractMongoParameters,
  parseRedisCommand,
} from './sql-utils'

export interface DatabaseEngineInfo {
  system: string
  operation: string
  statement: string
  /**
   * Parameterized template of the statement, with bind placeholders left intact
   * ($1, ? ...). Used to compute the query signature so that repeated executions of
   * the same prepared statement group together (pg_stat_statements semantics).
   * Undefined when the engine cannot produce a stable template.
   */
  normalizedStatement?: string
  resource?: string
  parameters?: any[]
  metadata?: Record<string, any>
}

export interface DatabaseEngine {
  extractInfo(attributes: Record<string, any>, redactParams?: boolean): DatabaseEngineInfo
}

/**
 * PostgreSQL database engine handler
 */
export class PostgreSQLEngine implements DatabaseEngine {
  extractInfo(attributes: Record<string, any>, redactParams = false): DatabaseEngineInfo {
    const rawStatement = String(attributes['db.statement'] || '').trim()
    const operation = extractSQLOperation(rawStatement)
    const resource = extractSQLResource(rawStatement)
    const parameters = this.extractParameters(attributes)
    const statement = formatSQLStatement(rawStatement, parameters, redactParams, 'postgresql')

    return {
      system: 'postgresql',
      operation,
      statement,
      // Raw statement keeps the $1, $2 ... placeholders, the stable template.
      normalizedStatement: rawStatement,
      resource,
      parameters,
      metadata: {
        database: attributes['db.name'],
        user: attributes['db.user'],
        host: attributes['net.peer.name'],
        port: attributes['net.peer.port'],
        values: attributes['db.postgresql.values'],
        command: attributes['db.postgresql.command'],
        rowCount: attributes['db.postgresql.row_count'],
      },
    }
  }

  private extractParameters(attributes: Record<string, any>): any[] | undefined {
    const values = attributes['db.postgresql.values']
    if (!values) return undefined
    if (Array.isArray(values)) return values
    if (typeof values === 'string') {
      return parseArrayString(values)
    }
    return undefined
  }
}

/**
 * MongoDB database engine handler
 */
export class MongoDBEngine implements DatabaseEngine {
  extractInfo(attributes: Record<string, any>): DatabaseEngineInfo {
    const operation = String(attributes['db.operation'] || 'query')
    const resource = attributes['db.mongodb.collection']
    const rawStatement = String(attributes['db.statement'] || '')
    const parameters = extractMongoParameters(rawStatement)
    const statement = formatMongoStatement(rawStatement)

    return {
      system: 'mongodb',
      operation: normalizeMongoOperation(operation),
      statement,
      resource,
      parameters,
      metadata: {
        database: attributes['db.name'],
        collection: resource,
        statement: rawStatement,
        resultCount: attributes['db.mongodb.result_count'],
        insertedId: attributes['db.mongodb.inserted_id'],
        matchedCount: attributes['db.mongodb.matched_count'],
        modifiedCount: attributes['db.mongodb.modified_count'],
        deletedCount: attributes['db.mongodb.deleted_count'],
      },
    }
  }
}

/**
 * MySQL database engine handler
 */
export class MySQLEngine implements DatabaseEngine {
  extractInfo(attributes: Record<string, any>, redactParams = false): DatabaseEngineInfo {
    const rawStatement = String(attributes['db.statement'] || '').trim()
    const operation = extractSQLOperation(rawStatement)
    const resource = extractSQLResource(rawStatement)
    const parameters = this.extractParameters(attributes)
    const statement = formatSQLStatement(rawStatement, parameters, redactParams, 'mysql')

    return {
      system: 'mysql',
      operation,
      statement,
      // Raw statement keeps the ? placeholders, the stable template.
      normalizedStatement: rawStatement,
      resource,
      parameters,
      metadata: {
        database: attributes['db.name'],
        user: attributes['db.user'],
        host: attributes['net.peer.name'],
        port: attributes['net.peer.port'],
        affectedRows: attributes['db.mysql.affected_rows'],
        insertId: attributes['db.mysql.insert_id'],
        fieldCount: attributes['db.mysql.field_count'],
      },
    }
  }

  private extractParameters(attributes: Record<string, any>): any[] | undefined {
    const params = attributes['db.parameters']
    if (!params) return undefined
    if (Array.isArray(params)) return params
    if (typeof params === 'string') {
      return parseArrayString(params)
    }
    return undefined
  }
}

/**
 * Redis database engine handler
 */
export class RedisEngine implements DatabaseEngine {
  extractInfo(attributes: Record<string, any>): DatabaseEngineInfo {
    const rawStatement = String(attributes['db.statement'] || '').trim()
    const cmdName = attributes['db.redis.command']
    const cmdArgs = attributes['db.redis.args']
    const key = attributes['db.redis.key']

    // Use command info if available, otherwise parse statement
    const { operation, resource } = cmdName ?
      this.parseCommandFromAttributes(cmdName, key, cmdArgs) :
      parseRedisCommand(rawStatement)

    const parameters = this.extractParameters(attributes, cmdArgs)
    const statement = rawStatement.trim()

    return {
      system: 'redis',
      operation,
      statement,
      resource,
      parameters,
      metadata: {
        host: attributes['net.peer.name'],
        port: attributes['net.peer.port'],
        connectionString: attributes['db.connection_string'],
        command: rawStatement,
        responseType: attributes['db.redis.response_type'],
        responseValue: attributes['db.redis.response_value'],
        responseLength: attributes['db.redis.response_length'],
      },
    }
  }

  private extractParameters(attributes: Record<string, any>, cmdArgs?: string): any[] | undefined {
    // Try to get parameters from command args first
    if (cmdArgs) {
      const parsed = parseArrayString(cmdArgs)
      if (parsed) return parsed
    }

    // Fallback to parsing statement
    const statement = attributes['db.statement']
    if (statement) {
      const parts = statement.trim().split(/\s+/)
      return parts.length > 1 ? parts.slice(1) : undefined
    }

    return undefined
  }

  private parseCommandFromAttributes(cmdName: string, key?: string, cmdArgs?: string): { operation: string; resource?: string } {
    const operation = cmdName.toUpperCase()
    let resource: string | undefined

    // Parse command arguments if available
    let args: any[] = []
    if (cmdArgs) {
      const parsed = parseArrayString(cmdArgs)
      if (parsed) args = parsed
    } else if (key) {
      args = [key]
    }

    // Extract resource based on command type and arguments
    switch (operation) {
      case 'GET':
      case 'SET':
      case 'DEL':
      case 'EXISTS':
      case 'EXPIRE':
      case 'TTL':
      case 'TYPE':
      case 'HGET':
      case 'HSET':
      case 'HDEL':
      case 'HEXISTS':
      case 'LPUSH':
      case 'RPUSH':
      case 'LPOP':
      case 'RPOP':
      case 'LLEN':
      case 'SADD':
      case 'SREM':
      case 'SMEMBERS':
      case 'SCARD':
      case 'ZADD':
      case 'ZREM':
      case 'ZRANGE':
      case 'ZCARD':
        resource = args[0] ? String(args[0]) : undefined
        break
      case 'MGET':
      case 'MSET':
      case 'MDEL':
        resource = args.length > 0 ? args.map(a => String(a)).join(', ') : undefined
        break
      case 'KEYS':
        resource = args[0] ? `pattern:${args[0]}` : 'pattern:*'
        break
    }

    // Clean up resource - remove quotes
    if (resource) {
      resource = String(resource).replace(/^['"]+|['"]+$/g, '')
    }

    return { operation, resource }
  }
}

/**
 * Factory to get the appropriate database engine handler
 */
export class DatabaseEngineFactory {
  private static engines: Record<string, DatabaseEngine> = {
    postgresql: new PostgreSQLEngine(),
    mongodb: new MongoDBEngine(),
    mysql: new MySQLEngine(),
    redis: new RedisEngine(),
  }

  static getEngine(dbSystem: string): DatabaseEngine | undefined {
    const system = dbSystem?.toLowerCase()
    return this.engines[system] || this.engines[this.normalizeSystemName(system)]
  }

  private static normalizeSystemName(system: string): string {
    const normalized: Record<string, string> = {
      'pg': 'postgresql',
      'postgres': 'postgresql',
      'mongo': 'mongodb',
      'mysql2': 'mysql',
      'ioredis': 'redis',
    }
    return normalized[system] || system
  }

  static getSupportedSystems(): string[] {
    return Object.keys(this.engines)
  }
}
