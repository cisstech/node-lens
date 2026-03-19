/* eslint-disable @typescript-eslint/no-explicit-any */
import { format, SqlLanguage } from 'sql-formatter'

/**
 * Safely escapes a value for SQL insertion
 */
export function escapeValue(v: any): string {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  if (v instanceof Date) return `'${v.toISOString()}'`
  if (typeof v === 'object') {
    try {
      return `'${JSON.stringify(v).replace(/'/g, "''")}'`
    } catch {
      return 'NULL'
    }
  }
  const s = String(v)
  return `'${s.replace(/'/g, "''")}'`
}

/**
 * Format SQL statement with optional parameter substitution
 */
export function formatSQLStatement(
  statement: string,
  params?: any[],
  redactParams = false,
  language: SqlLanguage = 'postgresql'
): string {
  let sql = statement

  if (!redactParams && params && params.length) {
    if (language === 'postgresql') {
      // PostgreSQL: replace $1, $2, etc.
      sql = sql.replace(/\$(\d+)/g, (_, n) => {
        const idx = parseInt(n) - 1
        return idx < params.length ? escapeValue(params[idx]) : `$${n}`
      })
    } else {
      // MySQL: replace ? placeholders
      let idx = 0
      sql = sql.replace(/\?/g, () =>
        escapeValue(params[Math.min(idx++, params.length - 1)])
      )
    }
  }

  try {
    return format(sql, {
      language,
      keywordCase: 'upper',
      identifierCase: 'preserve',
      indentStyle: 'standard',
      logicalOperatorNewline: 'after'
    })
  } catch {
    // Fallback to basic formatting
    return sql.replace(/\s+/g, ' ').trim()
  }
}

/**
 * Format MongoDB statement (JSON pretty print)
 */
export function formatMongoStatement(statement: string): string {
  try {
    const parsed = JSON.parse(statement)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return statement
  }
}

/**
 * Extract SQL operation from statement
 */
export function extractSQLOperation(statement: string): string {
  const normalized = statement.toUpperCase().trim()
  const match = normalized.match(/^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|EXPLAIN|ANALYZE|COPY|VACUUM|SHOW|DESCRIBE)\b/)
  return match?.[1] || 'QUERY'
}

/**
 * Extract table/resource name from SQL statement
 */
export function extractSQLResource(statement: string): string | undefined {
  const normalized = statement.toLowerCase().trim()

  const patterns = [
    /\bfrom\s+(?:only\s+)?(["`]?)(\w+)\1(?:\s+as\s+\w+)?/,
    /\bupdate\s+(?:only\s+)?(["`]?)(\w+)\1/,
    /\binsert\s+into\s+(["`]?)(\w+)\1/,
    /\bdelete\s+from\s+(["`]?)(\w+)\1/,
    /\bcreate\s+(?:table|index|view)\s+(?:if\s+not\s+exists\s+)?(["`]?)(\w+)\1/,
    /\balter\s+table\s+(["`]?)(\w+)\1/,
    /\bdrop\s+(?:table|index|view)\s+(?:if\s+exists\s+)?(["`]?)(\w+)\1/,
    /\btruncate\s+(?:table\s+)?(["`]?)(\w+)\1/,
    /\bshow\s+(?:tables|columns)\s+(?:from\s+)?(["`]?)(\w+)\1/,
    /\bdescribe\s+(["`]?)(\w+)\1/,
  ]

  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    if (match) {
      const resource = match[2]
      if (!isSystemResource(resource)) {
        return resource
      }
    }
  }

  return undefined
}

/**
 * Check if a resource is a system table/schema
 */
export function isSystemResource(resource: string): boolean {
  const systemPatterns = [
    // PostgreSQL
    /^pg_/, /^information_schema/, /^current_/, /^version$/,
    // MySQL
    /^information_schema/, /^performance_schema/, /^mysql/, /^sys$/,
  ]
  return systemPatterns.some(pattern => pattern.test(resource))
}

/**
 * Parse array-like string values
 */
export function parseArrayString(value: string): any[] | undefined {
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}

/**
 * Normalize MongoDB operation names to SQL equivalents
 */
export function normalizeMongoOperation(operation: string): string {
  const normalizedOp = operation.toLowerCase()
  const opMap: Record<string, string> = {
    'find': 'SELECT',
    'findone': 'SELECT',
    'insert': 'INSERT',
    'insertone': 'INSERT',
    'insertmany': 'INSERT',
    'update': 'UPDATE',
    'updateone': 'UPDATE',
    'updatemany': 'UPDATE',
    'delete': 'DELETE',
    'deleteone': 'DELETE',
    'deletemany': 'DELETE',
    'aggregate': 'AGGREGATE',
    'count': 'COUNT',
    'distinct': 'DISTINCT',
  }
  return opMap[normalizedOp] || operation.toUpperCase()
}

/**
 * Extract parameters from MongoDB statement
 */
export function extractMongoParameters(statement: string): any[] | undefined {
  if (!statement) return undefined

  try {
    const parsed = JSON.parse(statement)
    if (typeof parsed === 'object') {
      const filter = parsed.filter
      return filter ? [filter] : undefined
    }
  } catch {
    // Not JSON, no parameters
  }
  return undefined
}

/**
 * Parse Redis command and extract resource information
 */
export function parseRedisCommand(statement: string): { operation: string; resource?: string } {
  const parts = statement.trim().split(/\s+/)
  const operation = (parts[0] || 'COMMAND').toUpperCase()

  let resource: string | undefined

  switch (operation) {
    case 'GET':
    case 'SET':
    case 'DEL':
    case 'EXISTS':
    case 'EXPIRE':
    case 'TTL':
    case 'TYPE':
      resource = parts[1]
      break
    case 'MGET':
    case 'MSET':
    case 'MDEL':
      resource = parts.slice(1).join(', ')
      break
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
      resource = parts[1]
      break
    case 'KEYS':
      resource = parts[1] ? `pattern:${parts[1]}` : 'pattern:*'
      break
  }

  // Clean up resource - remove quotes
  if (resource) {
    resource = String(resource).replace(/^['"]+|['"]+$/g, '')
  }

  return { operation, resource }
}
