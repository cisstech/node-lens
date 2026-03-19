import { describe, it, expect } from '@jest/globals'
import {
  PostgreSQLEngine,
  MongoDBEngine,
  MySQLEngine,
  RedisEngine,
  DatabaseEngineFactory,
} from './database-engines'

describe('DatabaseEngines', () => {
  describe('PostgreSQLEngine', () => {
    const engine = new PostgreSQLEngine()

    it('should extract basic SELECT info', () => {
      const attributes = {
        'db.system': 'postgresql',
        'db.statement': 'SELECT * FROM todos WHERE id = $1',
        'db.name': 'nodelens_todo',
        'db.user': 'user',
        'net.peer.name': 'localhost',
        'net.peer.port': 5432,
        'db.postgresql.values': ['123'],
        'db.postgresql.command': 'SELECT',
        'db.postgresql.row_count': 1,
      }

      const info = engine.extractInfo(attributes)

      expect(info).toEqual({
        system: 'postgresql',
        operation: 'SELECT',
        statement: expect.any(String), // Formatted SQL
        normalizedStatement: 'SELECT * FROM todos WHERE id = $1', // template preserved
        resource: 'todos',
        parameters: ['123'],
        metadata: {
          database: 'nodelens_todo',
          user: 'user',
          host: 'localhost',
          port: 5432,
          values: ['123'],
          command: 'SELECT',
          rowCount: 1,
        },
      })
    })

    it('should handle complex table names', () => {
      const attributes = {
        'db.system': 'postgresql',
        'db.statement': 'UPDATE "user_profiles" SET name = $1 WHERE id = $2',
      }

      const info = engine.extractInfo(attributes)
      expect(info.resource).toBe('user_profiles')
    })

    it('should ignore system tables', () => {
      const attributes = {
        'db.system': 'postgresql',
        'db.statement': 'SELECT * FROM information_schema.tables',
      }

      const info = engine.extractInfo(attributes)
      expect(info.resource).toBeUndefined()
    })
  })

  describe('MongoDBEngine', () => {
    const engine = new MongoDBEngine()

    it('should extract find operation info', () => {
      const attributes = {
        'db.system': 'mongodb',
        'db.name': 'nodelens_todo',
        'db.mongodb.collection': 'todos',
        'db.operation': 'find',
        'db.statement': '{"find":"todos","filter":{}}',
        'db.mongodb.result_count': 5,
      }

      const info = engine.extractInfo(attributes)

      expect(info).toEqual({
        system: 'mongodb',
        operation: 'SELECT',
        statement: expect.any(String), // Formatted MongoDB statement
        resource: 'todos',
        parameters: [{}], // Parameters extracted from JSON filter
        metadata: {
          database: 'nodelens_todo',
          collection: 'todos',
          statement: '{"find":"todos","filter":{}}',
          resultCount: 5,
          insertedId: undefined,
          matchedCount: undefined,
          modifiedCount: undefined,
          deletedCount: undefined,
        },
      })
    })

    it('should normalize operations correctly', () => {
      const testCases = [
        { operation: 'insertOne', expected: 'INSERT' },
        { operation: 'updateMany', expected: 'UPDATE' },
        { operation: 'deleteOne', expected: 'DELETE' },
        { operation: 'aggregate', expected: 'AGGREGATE' },
      ]

      testCases.forEach(({ operation, expected }) => {
        const attributes = {
          'db.system': 'mongodb',
          'db.mongodb.collection': 'test',
          'db.operation': operation,
        }

        const info = engine.extractInfo(attributes)
        expect(info.operation).toBe(expected)
      })
    })
  })

  describe('MySQLEngine', () => {
    const engine = new MySQLEngine()

    it('should extract basic query info', () => {
      const attributes = {
        'db.system': 'mysql',
        'db.statement': 'SELECT * FROM todos WHERE completed = ?',
        'db.name': 'nodelens_todo',
        'db.user': 'user',
        'net.peer.name': 'localhost',
        'net.peer.port': 3307,
        'db.mysql.affected_rows': 0,
        'db.mysql.insert_id': 0,
        'db.mysql.field_count': 3,
      }

      const info = engine.extractInfo(attributes)

      expect(info).toEqual({
        system: 'mysql',
        operation: 'SELECT',
        statement: expect.any(String), // Formatted SQL
        normalizedStatement: 'SELECT * FROM todos WHERE completed = ?', // template preserved
        resource: 'todos',
        parameters: undefined,
        metadata: {
          database: 'nodelens_todo',
          user: 'user',
          host: 'localhost',
          port: 3307,
          affectedRows: 0,
          insertId: 0,
          fieldCount: 3,
        },
      })
    })

    it('should handle CREATE TABLE statements', () => {
      const attributes = {
        'db.system': 'mysql',
        'db.statement': `
          CREATE TABLE IF NOT EXISTS todos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            task VARCHAR(255) NOT NULL,
            completed BOOLEAN DEFAULT false
          );
        `,
      }

      const info = engine.extractInfo(attributes)
      expect(info.operation).toBe('CREATE')
      expect(info.resource).toBe('todos')
    })
  })

  describe('RedisEngine', () => {
    const engine = new RedisEngine()

    it('should extract GET command info', () => {
      const attributes = {
        'db.system': 'redis',
        'db.statement': 'get todo:123',
        'net.peer.name': 'localhost',
        'net.peer.port': 6379,
        'db.connection_string': 'redis://localhost:6379',
        'db.redis.command': 'get',
        'db.redis.key': 'todo:123',
        'db.redis.args': '["todo:123"]',
        'db.redis.response_type': 'string',
        'db.redis.response_value': 'value_content',
        'db.redis.response_length': 0,
      }

      const info = engine.extractInfo(attributes)

      expect(info).toEqual({
        system: 'redis',
        operation: 'GET',
        statement: expect.any(String), // Formatted Redis command
        resource: 'todo:123',
        parameters: ['todo:123'],
        metadata: {
          host: 'localhost',
          port: 6379,
          connectionString: 'redis://localhost:6379',
          command: 'get todo:123',
          responseType: 'string',
          responseValue: 'value_content',
          responseLength: 0,
        },
      })
    })

    it('should handle KEYS pattern commands', () => {
      const attributes = {
        'db.system': 'redis',
        'db.statement': 'keys todo:*',
        'db.redis.command': 'keys',
        'db.redis.key': 'todo:*',
        'db.redis.args': '["todo:*"]',
      }

      const info = engine.extractInfo(attributes)
      expect(info.operation).toBe('KEYS')
      expect(info.resource).toBe('pattern:todo:*')
    })

    it('should handle MGET commands with multiple keys', () => {
      const attributes = {
        'db.system': 'redis',
        'db.statement': 'mget key1 key2 key3',
        'db.redis.command': 'mget',
        'db.redis.args': '["key1", "key2", "key3"]',
      }

      const info = engine.extractInfo(attributes)
      expect(info.operation).toBe('MGET')
      expect(info.resource).toBe('key1, key2, key3')
    })

    it('should fallback to statement parsing when command attributes are missing', () => {
      const attributes = {
        'db.system': 'redis',
        'db.statement': 'set mykey myvalue',
      }

      const info = engine.extractInfo(attributes)
      expect(info.operation).toBe('SET')
      expect(info.resource).toBe('mykey')
    })
  })

  describe('DatabaseEngineFactory', () => {
    it('should get correct engine for each database system', () => {
      expect(DatabaseEngineFactory.getEngine('postgresql')).toBeInstanceOf(PostgreSQLEngine)
      expect(DatabaseEngineFactory.getEngine('mongodb')).toBeInstanceOf(MongoDBEngine)
      expect(DatabaseEngineFactory.getEngine('mysql')).toBeInstanceOf(MySQLEngine)
      expect(DatabaseEngineFactory.getEngine('redis')).toBeInstanceOf(RedisEngine)
    })

    it('should handle normalized system names', () => {
      expect(DatabaseEngineFactory.getEngine('pg')).toBeInstanceOf(PostgreSQLEngine)
      expect(DatabaseEngineFactory.getEngine('postgres')).toBeInstanceOf(PostgreSQLEngine)
      expect(DatabaseEngineFactory.getEngine('mongo')).toBeInstanceOf(MongoDBEngine)
      expect(DatabaseEngineFactory.getEngine('mysql2')).toBeInstanceOf(MySQLEngine)
      expect(DatabaseEngineFactory.getEngine('ioredis')).toBeInstanceOf(RedisEngine)
    })

    it('should return undefined for unsupported systems', () => {
      expect(DatabaseEngineFactory.getEngine('unknown')).toBeUndefined()
      expect(DatabaseEngineFactory.getEngine('')).toBeUndefined()
    })

    it('should list all supported systems', () => {
      const systems = DatabaseEngineFactory.getSupportedSystems()
      expect(systems).toContain('postgresql')
      expect(systems).toContain('mongodb')
      expect(systems).toContain('mysql')
      expect(systems).toContain('redis')
    })
  })
})
