import { describe, it, expect } from '@jest/globals'
import {
  createQuerySignature,
  countUniqueQueries,
  isNPlusOneProblem,
  findDuplicateQueries,
  generateTraceWarnings,
  calculateQueryCounts,
} from './trace-utils'
import type { DatabaseQuerySpan } from '../types'

describe('trace-utils', () => {

  describe('createQuerySignature', () => {
    it('should normalize query signature', () => {
      const query: DatabaseQuerySpan = {
        spanId: '1',
        traceId: '1',
        startTimeMs: 0,
        durationMs: 10,
        dbSystem: 'postgresql',
        operation: 'SELECT',
        statement: 'SELECT * FROM users WHERE id = $1',
        resource: 'users',
        isError: false,
      }

      const signature = createQuerySignature(query)
      expect(signature).toBe('SELECT|users|SELECT * FROM users WHERE id = ?')
    })

    it('should handle queries without resource', () => {
      const query: DatabaseQuerySpan = {
        spanId: '1',
        traceId: '1',
        startTimeMs: 0,
        durationMs: 10,
        dbSystem: 'postgresql',
        operation: 'SELECT',
        statement: 'SELECT 1',
        isError: false,
      }

      const signature = createQuerySignature(query)
      expect(signature).toBe('SELECT|unknown|SELECT 1')
    })

    it('collapses inlined values by signing the parameterized template', () => {
      // Reproduces the real pg pipeline: the display statement has values inlined
      // by the formatter, while normalizedStatement keeps the $1 template.
      const mk = (id: number): DatabaseQuerySpan => ({
        spanId: `${id}`,
        traceId: '1',
        startTimeMs: id,
        durationMs: 1,
        dbSystem: 'postgresql',
        operation: 'SELECT',
        statement: `SELECT * FROM todos WHERE id = ${id}`,
        normalizedStatement: 'SELECT * FROM todos WHERE id = $1',
        resource: 'todos',
        parameters: [`${id}`],
        isError: false,
      })

      const a = createQuerySignature(mk(1))
      const b = createQuerySignature(mk(2))
      expect(a).toBe(b)
      expect(a).toBe('SELECT|todos|SELECT * FROM todos WHERE id = ?')
    })
  })

  describe('countUniqueQueries', () => {
    it('should count unique queries based on signatures', () => {
      const queries: DatabaseQuerySpan[] = [
        {
          spanId: '1',
          traceId: '1',
          startTimeMs: 0,
          durationMs: 10,
          dbSystem: 'postgresql',
          operation: 'SELECT',
          statement: 'SELECT * FROM users WHERE id = $1',
          resource: 'users',
          isError: false,
        },
        {
          spanId: '2',
          traceId: '1',
          startTimeMs: 10,
          durationMs: 10,
          dbSystem: 'postgresql',
          operation: 'SELECT',
          statement: 'SELECT * FROM users WHERE id = $1', // Same signature
          resource: 'users',
          isError: false,
        },
        {
          spanId: '3',
          traceId: '1',
          startTimeMs: 20,
          durationMs: 10,
          dbSystem: 'postgresql',
          operation: 'SELECT',
          statement: 'SELECT * FROM posts',
          resource: 'posts',
          isError: false,
        },
      ]

      expect(countUniqueQueries(queries)).toBe(2)
    })
  })

  describe('isNPlusOneProblem', () => {
    it('should detect N+1 problem with different parameters', () => {
      const items: DatabaseQuerySpan[] = [
        {
          spanId: '1',
          traceId: '1',
          startTimeMs: 0,
          durationMs: 10,
          dbSystem: 'postgresql',
          operation: 'SELECT',
          statement: 'SELECT * FROM users WHERE id = $1',
          resource: 'users',
          parameters: ['1'],
          isError: false,
        },
        {
          spanId: '2',
          traceId: '1',
          startTimeMs: 10,
          durationMs: 10,
          dbSystem: 'postgresql',
          operation: 'SELECT',
          statement: 'SELECT * FROM users WHERE id = $1',
          resource: 'users',
          parameters: ['2'],
          isError: false,
        },
        {
          spanId: '3',
          traceId: '1',
          startTimeMs: 20,
          durationMs: 10,
          dbSystem: 'postgresql',
          operation: 'SELECT',
          statement: 'SELECT * FROM users WHERE id = $1',
          resource: 'users',
          parameters: ['3'],
          isError: false,
        },
      ]

      expect(isNPlusOneProblem(items, 3)).toBe(true)
    })

    it('should not detect N+1 for non-SELECT queries', () => {
      const items: DatabaseQuerySpan[] = Array(5).fill(null).map((_, i) => ({
        spanId: `${i}`,
        traceId: '1',
        startTimeMs: i * 10,
        durationMs: 10,
        dbSystem: 'postgresql',
        operation: 'INSERT',
        statement: 'INSERT INTO users VALUES ($1)',
        resource: 'users',
        parameters: [`${i}`],
        isError: false,
      }))

      expect(isNPlusOneProblem(items, 3)).toBe(false)
    })

    it('detects a SELECT burst even when parameters were not captured', () => {
      const items: DatabaseQuerySpan[] = Array(5).fill(null).map((_, i) => ({
        spanId: `${i}`,
        traceId: '1',
        startTimeMs: i * 10,
        durationMs: 5,
        dbSystem: 'postgresql',
        operation: 'SELECT',
        statement: 'SELECT * FROM todos WHERE id = $1',
        normalizedStatement: 'SELECT * FROM todos WHERE id = $1',
        resource: 'todos',
        isError: false,
      }))

      expect(isNPlusOneProblem(items, 3)).toBe(true)
    })
  })

  describe('findDuplicateQueries: inlined values (regression)', () => {
    it('groups a classic SELECT N+1 whose display statements are inlined', () => {
      const queries: DatabaseQuerySpan[] = Array(6).fill(null).map((_, i) => ({
        spanId: `${i}`,
        traceId: '1',
        startTimeMs: i * 3,
        durationMs: 2,
        dbSystem: 'postgresql',
        operation: 'SELECT',
        statement: `SELECT * FROM todos WHERE id = ${i + 1}`, // values inlined for display
        normalizedStatement: 'SELECT * FROM todos WHERE id = $1',
        resource: 'todos',
        parameters: [`${i + 1}`],
        isError: false,
      }))

      const groups = findDuplicateQueries(queries, 5)
      expect(groups).toHaveLength(1)
      expect(groups[0].count).toBe(6)
      expect(groups[0].suspectedNPlusOne).toBe(true)
    })
  })

  describe('findDuplicateQueries', () => {
    it('should find duplicate query groups', () => {
      const queries: DatabaseQuerySpan[] = [
        ...Array(3).fill(null).map((_, i) => ({
          spanId: `${i}`,
          traceId: '1',
          startTimeMs: i * 10,
          durationMs: 10,
          dbSystem: 'postgresql',
          operation: 'SELECT',
          statement: 'SELECT * FROM users WHERE id = $1',
          resource: 'users',
          parameters: [`${i + 1}`],
          isError: false,
        })),
        {
          spanId: '3',
          traceId: '1',
          startTimeMs: 30,
          durationMs: 5,
          dbSystem: 'postgresql',
          operation: 'SELECT',
          statement: 'SELECT * FROM posts',
          resource: 'posts',
          isError: false,
        },
      ]

      const groups = findDuplicateQueries(queries, 3)
      expect(groups).toHaveLength(1)
      expect(groups[0].count).toBe(3)
      expect(groups[0].suspectedNPlusOne).toBe(true)
      expect(groups[0].totalDurationMs).toBe(30)
    })
  })

  describe('generateTraceWarnings', () => {
    it('should generate warnings based on analysis', () => {
      const duplicateGroups = [{
        signature: 'test',
        statement: 'SELECT * FROM users',
        count: 3,
        totalDurationMs: 30,
        suspectedNPlusOne: true,
      }]

      const warnings = generateTraceWarnings(duplicateGroups, 2, 1)
      expect(warnings).toContain('duplicate')
      expect(warnings).toContain('slow')
      expect(warnings).toContain('error')
    })
  })

  describe('calculateQueryCounts', () => {
    it('should calculate query counts correctly', () => {
      const queries: DatabaseQuerySpan[] = [
        {
          spanId: '1',
          traceId: '1',
          startTimeMs: 0,
          durationMs: 100, // Slow query
          dbSystem: 'postgresql',
          operation: 'SELECT',
          statement: 'SELECT * FROM users',
          isError: false,
        },
        {
          spanId: '2',
          traceId: '1',
          startTimeMs: 10,
          durationMs: 10,
          dbSystem: 'postgresql',
          operation: 'SELECT',
          statement: 'SELECT * FROM users', // Same signature
          isError: true, // Error query
        },
        {
          spanId: '3',
          traceId: '1',
          startTimeMs: 20,
          durationMs: 10,
          dbSystem: 'postgresql',
          operation: 'SELECT',
          statement: 'SELECT * FROM posts', // Different signature
          isError: false,
        },
      ]

      const counts = calculateQueryCounts(queries, 80)
      expect(counts.slowQueryCount).toBe(1)
      expect(counts.errorCount).toBe(1)
      expect(counts.uniqueQueryCount).toBe(2)
    })
  })
})
