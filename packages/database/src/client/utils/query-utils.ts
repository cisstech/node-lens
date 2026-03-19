import type { DatabaseQuerySpan } from '../../server/types.js'

/**
 * Query formatting and parsing utilities
 */
export class QueryFormatter {
  /**
   * Format a query statement for display based on database system
   */
  static formatQuery(query: DatabaseQuerySpan): string {
    if (!query.statement) return ''

    const dbSystem = query.dbSystem?.toLowerCase()
    let formatted = query.statement.trim()

    switch (dbSystem) {
      case 'postgresql':
      case 'postgres':
      case 'pg':
      case 'mysql':
      case 'mysql2':
        // Add semicolon for SQL queries
        formatted = formatted.endsWith(';') ? formatted : `${formatted};`
        break
      case 'mongodb':
      case 'mongo':
        // Pretty-print JSON for MongoDB queries
        try {
          const parsed = JSON.parse(formatted)
          formatted = JSON.stringify(parsed, null, 2)
        } catch {
          // Keep as-is if not valid JSON
        }
        break
      case 'redis':
      case 'ioredis':
        // Uppercase Redis commands
        formatted = formatted.toUpperCase()
        break
    }

    return formatted
  }

  /**
   * Format query with parameters for copying
   */
  static formatQueryWithParams(query: DatabaseQuerySpan): string {
    const formatted = this.formatQuery(query)

    if (!query.parameters || Object.keys(query.parameters).length === 0) {
      return formatted
    }

    const params = `\n-- Parameters: ${JSON.stringify(query.parameters)}`
    return `${formatted}${params}`
  }

  /**
   * Generate MongoDB JavaScript code
   */
  static formatMongoJavaScript(query: DatabaseQuerySpan): string {
    const collection = query.resource || 'collection'
    const operation = query.operation || 'find'
    const queryStr = this.formatQuery(query)
    return `db.${collection}.${operation}(${queryStr});`
  }

  /**
   * Extract operation type from SQL statement
   */
  static extractSqlOperation(statement: string): string | null {
    const match = statement.trim().match(/^(\w+)/i)
    return match ? match[1].toUpperCase() : null
  }

  /**
   * Check if a query is considered slow
   */
  static isSlowQuery(query: DatabaseQuerySpan, threshold = 80): boolean {
    return query.durationMs > threshold
  }

  /**
   * Check if a query has an error
   */
  static hasError(query: DatabaseQuerySpan): boolean {
    return !!query.error
  }

  /**
   * Get query display name (operation + resource)
   */
  static getQueryDisplayName(query: DatabaseQuerySpan): string {
    const operation = query.operation || 'Query'
    const resource = query.resource ? ` on ${query.resource}` : ''
    return `${operation}${resource}`
  }

  /**
   * Sanitize query for safe display (remove sensitive data)
   */
  static sanitizeQuery(statement: string): string {
    // Remove potential passwords, tokens, etc.
    return statement
      .replace(/(password|token|key|secret)\s*=\s*['"][^'"]*['"]/gi, '$1=***')
      .replace(/(auth|authorization)\s*:\s*['"][^'"]*['"]/gi, '$1:***')
  }
}
