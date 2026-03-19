import { describe, it, expect } from '@jest/globals'
import {
  escapeValue,
  formatSQLStatement,
  formatMongoStatement,
  extractSQLOperation,
  extractSQLResource,
  parseArrayString,
  normalizeMongoOperation,
  extractMongoParameters,
  parseRedisCommand,
} from './sql-utils'

describe('sql-utils', () => {
  describe('escapeValue', () => {
    it('should escape different value types', () => {
      expect(escapeValue(null)).toBe('NULL')
      expect(escapeValue(undefined)).toBe('NULL')
      expect(escapeValue(123)).toBe('123')
      expect(escapeValue(true)).toBe('TRUE')
      expect(escapeValue(false)).toBe('FALSE')
      expect(escapeValue("test'value")).toBe("'test''value'")
      expect(escapeValue({ key: 'value' })).toBe("'{\"key\":\"value\"}'")
    })
  })

  describe('formatSQLStatement', () => {
    it('should format PostgreSQL statement with parameters', () => {
      const statement = 'SELECT * FROM users WHERE id = $1'
      const params = [123]
      const formatted = formatSQLStatement(statement, params, false, 'postgresql')
      expect(formatted).toContain('SELECT')
      expect(formatted).toContain('123')
    })

    it('should format MySQL statement with parameters', () => {
      const statement = 'SELECT * FROM users WHERE id = ?'
      const params = [123]
      const formatted = formatSQLStatement(statement, params, false, 'mysql')
      expect(formatted).toContain('SELECT')
      expect(formatted).toContain('123')
    })

    it('should redact parameters when requested', () => {
      const statement = 'SELECT * FROM users WHERE id = $1'
      const params = [123]
      const formatted = formatSQLStatement(statement, params, true, 'postgresql')
      expect(formatted).toContain('$1')
      expect(formatted).not.toContain('123')
    })
  })

  describe('formatMongoStatement', () => {
    it('should format MongoDB JSON statement', () => {
      const statement = '{"find":"users","filter":{"id":123}}'
      const formatted = formatMongoStatement(statement)
      expect(formatted).toContain('\n') // Should be pretty-printed
      expect(formatted).toContain('"find"')
      expect(formatted).toContain('"users"')
    })

    it('should handle invalid JSON gracefully', () => {
      const statement = 'invalid json'
      const formatted = formatMongoStatement(statement)
      expect(formatted).toBe('invalid json')
    })
  })

  describe('extractSQLOperation', () => {
    it('should extract operation from SQL statements', () => {
      expect(extractSQLOperation('SELECT * FROM users')).toBe('SELECT')
      expect(extractSQLOperation('INSERT INTO users VALUES (1)')).toBe('INSERT')
      expect(extractSQLOperation('UPDATE users SET name = "test"')).toBe('UPDATE')
      expect(extractSQLOperation('DELETE FROM users')).toBe('DELETE')
      expect(extractSQLOperation('CREATE TABLE test (id INT)')).toBe('CREATE')
      expect(extractSQLOperation('invalid statement')).toBe('QUERY')
    })
  })

  describe('extractSQLResource', () => {
    it('should extract table names from various SQL statements', () => {
      expect(extractSQLResource('SELECT * FROM users')).toBe('users')
      expect(extractSQLResource('INSERT INTO posts VALUES (1)')).toBe('posts')
      expect(extractSQLResource('UPDATE comments SET content = "test"')).toBe('comments')
      expect(extractSQLResource('DELETE FROM logs')).toBe('logs')
      expect(extractSQLResource('CREATE TABLE test (id INT)')).toBe('test')
    })

    it('should handle quoted table names', () => {
      expect(extractSQLResource('SELECT * FROM "user_profiles"')).toBe('user_profiles')
      expect(extractSQLResource('SELECT * FROM `user_profiles`')).toBe('user_profiles')
    })

    it('should ignore system tables', () => {
      expect(extractSQLResource('SELECT * FROM pg_tables')).toBeUndefined()
      expect(extractSQLResource('SELECT * FROM information_schema.tables')).toBeUndefined()
    })
  })

  describe('parseArrayString', () => {
    it('should parse JSON array strings', () => {
      expect(parseArrayString('[1, 2, 3]')).toEqual([1, 2, 3])
      expect(parseArrayString('["a", "b", "c"]')).toEqual(['a', 'b', 'c'])
      expect(parseArrayString('invalid json')).toBeUndefined()
    })
  })

  describe('normalizeMongoOperation', () => {
    it('should normalize MongoDB operations to SQL equivalents', () => {
      expect(normalizeMongoOperation('find')).toBe('SELECT')
      expect(normalizeMongoOperation('insertOne')).toBe('INSERT')
      expect(normalizeMongoOperation('updateMany')).toBe('UPDATE')
      expect(normalizeMongoOperation('deleteOne')).toBe('DELETE')
      expect(normalizeMongoOperation('aggregate')).toBe('AGGREGATE')
      expect(normalizeMongoOperation('count')).toBe('COUNT')
      expect(normalizeMongoOperation('customOp')).toBe('CUSTOMOP')
    })
  })

  describe('extractMongoParameters', () => {
    it('should extract parameters from MongoDB statement', () => {
      const statement = '{"find":"users","filter":{"id":123}}'
      const params = extractMongoParameters(statement)
      expect(params).toEqual([{ id: 123 }])
    })

    it('should handle statements without filter', () => {
      const statement = '{"find":"users"}'
      const params = extractMongoParameters(statement)
      expect(params).toBeUndefined()
    })

    it('should handle invalid JSON', () => {
      const statement = 'invalid json'
      const params = extractMongoParameters(statement)
      expect(params).toBeUndefined()
    })
  })

  describe('parseRedisCommand', () => {
    it('should parse Redis commands and extract resources', () => {
      expect(parseRedisCommand('GET user:123')).toEqual({
        operation: 'GET',
        resource: 'user:123'
      })

      expect(parseRedisCommand('SET user:456 "value"')).toEqual({
        operation: 'SET',
        resource: 'user:456'
      })

      expect(parseRedisCommand('MGET key1 key2 key3')).toEqual({
        operation: 'MGET',
        resource: 'key1, key2, key3'
      })

      expect(parseRedisCommand('KEYS user:*')).toEqual({
        operation: 'KEYS',
        resource: 'pattern:user:*'
      })
    })

    it('should handle commands without arguments', () => {
      expect(parseRedisCommand('PING')).toEqual({
        operation: 'PING',
        resource: undefined
      })
    })
  })
})
