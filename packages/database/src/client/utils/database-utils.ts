import type { DatabaseSystemInfo, FilterOption } from '../types.js'

/**
 * Database system configuration and utilities
 */
export class DatabaseSystemRegistry {
  private static readonly SYSTEM_INFO: Record<string, DatabaseSystemInfo> = {
    postgresql: {
      icon: 'database',
      color: '#336791',
      resourceType: 'table',
      displayName: 'PostgreSQL'
    },
    postgres: {
      icon: 'database',
      color: '#336791',
      resourceType: 'table',
      displayName: 'PostgreSQL'
    },
    pg: {
      icon: 'database',
      color: '#336791',
      resourceType: 'table',
      displayName: 'PostgreSQL'
    },
    mysql: {
      icon: 'database',
      color: '#4479a1',
      resourceType: 'table',
      displayName: 'MySQL'
    },
    mysql2: {
      icon: 'database',
      color: '#4479a1',
      resourceType: 'table',
      displayName: 'MySQL'
    },
    mongodb: {
      icon: 'json',
      color: '#47a248',
      resourceType: 'collection',
      displayName: 'MongoDB'
    },
    mongo: {
      icon: 'json',
      color: '#47a248',
      resourceType: 'collection',
      displayName: 'MongoDB'
    },
    redis: {
      icon: 'layers',
      color: '#dc382d',
      resourceType: 'key',
      displayName: 'Redis'
    },
    ioredis: {
      icon: 'layers',
      color: '#dc382d',
      resourceType: 'key',
      displayName: 'Redis'
    },
    memcached: {
      icon: 'layers',
      color: '#1f8dd6',
      resourceType: 'key',
      displayName: 'Memcached'
    },
    oracle: {
      icon: 'database',
      color: '#f80000',
      resourceType: 'table',
      displayName: 'Oracle'
    },
    sqlite: {
      icon: 'database',
      color: '#003b57',
      resourceType: 'table',
      displayName: 'SQLite'
    }
  }

  static getSystemInfo(dbSystem?: string): DatabaseSystemInfo {
    if (!dbSystem) {
      return {
        icon: 'database',
        color: 'var(--nl-color-info)',
        resourceType: 'resource',
        displayName: 'Unknown'
      }
    }

    return this.SYSTEM_INFO[dbSystem.toLowerCase()] || {
      icon: 'database',
      color: 'var(--nl-color-info)',
      resourceType: 'resource',
      displayName: dbSystem.charAt(0).toUpperCase() + dbSystem.slice(1)
    }
  }

  static getIcon(dbSystem?: string): string {
    return this.getSystemInfo(dbSystem).icon
  }

  static getColor(dbSystem?: string): string {
    return this.getSystemInfo(dbSystem).color
  }

  static getResourceType(dbSystem?: string): string {
    return this.getSystemInfo(dbSystem).resourceType
  }

  static getDisplayName(dbSystem?: string): string {
    return this.getSystemInfo(dbSystem).displayName
  }

  static getDatabaseOptions(systems: Set<string>): FilterOption[] {
    const options: FilterOption[] = [{ value: 'all', label: 'All Databases' }]

    Array.from(systems)
      .sort()
      .forEach(system => {
        options.push({
          value: system,
          label: this.getDisplayName(system)
        })
      })

    return options
  }

  static supportsExplain(dbSystem?: string): boolean {
    if (!dbSystem) return false
    const normalized = dbSystem.toLowerCase()
    return ['postgresql', 'postgres', 'pg', 'mysql', 'mysql2'].includes(normalized)
  }

  static getActionLabel(dbSystem?: string): string {
    if (!dbSystem) return 'Copy Query'

    const normalized = dbSystem.toLowerCase()
    if (['redis', 'ioredis'].includes(normalized)) {
      return 'Copy Command'
    }
    if (['mongodb', 'mongo'].includes(normalized)) {
      return 'Copy Query'
    }
    return 'Copy SQL'
  }
}
