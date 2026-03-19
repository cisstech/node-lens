/**
 * Database system context definitions
 * Simplified to only include fields actually used by the client
 */
export interface DatabaseSystemContext {
  type: 'sql' | 'nosql' | 'keyvalue'
  system: string // 'postgresql', 'mysql', 'mongodb', 'redis', etc.
}

/**
 * Database system registry
 * Each system defines its type for playground behavior
 */
export const DATABASE_SYSTEMS: Record<string, DatabaseSystemContext> = {
  postgresql: {
    type: 'sql',
    system: 'postgresql'
  },
  mysql: {
    type: 'sql',
    system: 'mysql'
  },
  mongodb: {
    type: 'nosql',
    system: 'mongodb'
  },
  redis: {
    type: 'keyvalue',
    system: 'redis'
  }
}

/**
 * Get database system context by system name
 */
export function getDatabaseSystemContext(system: string): DatabaseSystemContext | undefined {
  return DATABASE_SYSTEMS[system.toLowerCase()]
}

/**
 * Get query templates for a specific database system
 */
export interface QueryTemplate {
  id: string
  name: string
  description: string
  category: string
  query: string
  parameters?: { name: string; description: string; defaultValue?: string }[]
}

export function getQueryTemplates(system: string): QueryTemplate[] {
  const systemContext = getDatabaseSystemContext(system)
  if (!systemContext) return []

  switch (systemContext.type) {
    case 'sql':
      return SQL_TEMPLATES
    case 'nosql':
      return system === 'mongodb' ? MONGODB_TEMPLATES : []
    case 'keyvalue':
      return system === 'redis' ? REDIS_TEMPLATES : []
    default:
      return []
  }
}

const SQL_TEMPLATES: QueryTemplate[] = [
  {
    id: 'select-all',
    name: 'Select All',
    description: 'Select all records from a table',
    category: 'Basic',
    query: 'SELECT * FROM users LIMIT 10;'
  },
  {
    id: 'select-with-where',
    name: 'Select with WHERE',
    description: 'Select records with conditions',
    category: 'Basic',
    query: 'SELECT id, name, email FROM users WHERE active = true ORDER BY created_at DESC LIMIT 10;'
  },
  {
    id: 'insert-record',
    name: 'Insert Record',
    description: 'Insert a new record',
    category: 'DML',
    query: `INSERT INTO users (name, email, active) VALUES ('John Doe', 'john@example.com', true);`
  },
  {
    id: 'update-record',
    name: 'Update Record',
    description: 'Update existing records',
    category: 'DML',
    query: 'UPDATE users SET active = false WHERE last_login < \'2023-01-01\';'
  },
  {
    id: 'create-table',
    name: 'Create Table',
    description: 'Create a new table',
    category: 'DDL',
    query: `CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`
  },
  {
    id: 'explain-query',
    name: 'Explain Query',
    description: 'Analyze query execution plan',
    category: 'Performance',
    query: 'EXPLAIN ANALYZE SELECT * FROM users WHERE email = \'john@example.com\';'
  }
]

const MONGODB_TEMPLATES: QueryTemplate[] = [
  {
    id: 'find-all',
    name: 'Find All',
    description: 'Find all documents in a collection',
    category: 'Basic',
    query: '{ "collection": "users", "filter": {}, "limit": 10 }'
  },
  {
    id: 'find-with-filter',
    name: 'Find with Filter',
    description: 'Find documents with specific criteria',
    category: 'Basic',
    query: '{ "collection": "users", "filter": { "active": true }, "limit": 20 }'
  },
  {
    id: 'find-by-id',
    name: 'Find by ID',
    description: 'Find document by ObjectId',
    category: 'Basic',
    query: '{ "collection": "users", "filter": { "_id": { "$oid": "507f1f77bcf86cd799439011" } }, "limit": 1 }'
  },
  {
    id: 'find-recent',
    name: 'Find Recent',
    description: 'Find recently created documents',
    category: 'Basic',
    query: '{ "collection": "users", "filter": { "createdAt": { "$gte": { "$date": "2024-01-01" } } }, "limit": 50 }'
  }
]

const REDIS_TEMPLATES: QueryTemplate[] = [
  {
    id: 'get-key',
    name: 'Get Key',
    description: 'Get value of a key',
    category: 'Basic',
    query: 'GET mykey'
  },
  {
    id: 'set-key',
    name: 'Set Key',
    description: 'Set a key-value pair',
    category: 'Basic',
    query: 'SET mykey "Hello World"'
  },
  {
    id: 'scan-keys',
    name: 'Scan Keys',
    description: 'Scan keys with pattern',
    category: 'Basic',
    query: 'SCAN 0 MATCH user:* COUNT 10'
  },
  {
    id: 'list-keys',
    name: 'List Keys',
    description: 'Get all keys (use carefully)',
    category: 'Basic',
    query: 'KEYS *'
  },
  {
    id: 'hash-operations',
    name: 'Hash Operations',
    description: 'Work with hash data type',
    category: 'Data Types',
    query: 'HGETALL user:1001'
  },
  {
    id: 'list-operations',
    name: 'List Operations',
    description: 'Work with list data type',
    category: 'Data Types',
    query: 'LRANGE mylist 0 -1'
  },
  {
    id: 'info-command',
    name: 'Server Info',
    description: 'Get Redis server information',
    category: 'Monitoring',
    query: 'INFO server'
  }
]
