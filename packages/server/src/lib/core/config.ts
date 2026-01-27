import type { NodeLensPlugin } from '../plugins/types'

/**
 * Event store configuration options
 */
export interface EventStoreOptions {
  /** Storage backend type */
  backend?: 'file' // 'sqlite' will be added later
  /** Directory or file path for storage */
  path?: string
}

/**
 * NodeLens configuration options
 */
export interface NodeLensOptions {
  /** Plugin instances to register */
  plugins?: NodeLensPlugin[]

  /**
   * Base path for NodeLens endpoints and assets
   * @default '/node-lens/'
   */
  baseUrl?: string

  /**
   * Base URL of the monitored server
   * Useful when behind a reverse proxy
   * @default 'http://localhost:[port]'
   */
  hostname?: string

  /**
   * Event persistence configuration
   * If undefined, file-based storage at './.node-lens/events' is used
   * @example { backend: 'file', path: './.node-lens/events' }
   */
  eventStore?: EventStoreOptions

  /**
   * Runtime metrics collection interval in milliseconds
   * If undefined, metrics are not collected
   * @default 60000
   */
  metricCollectionInterval?: number
}
