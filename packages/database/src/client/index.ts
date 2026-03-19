// Export the new modular components
export { DatabasePlugin } from './components/database-plugin.js'
export { DatabaseTraceItem as TraceItemComponent } from './components/trace-item.js'

// Export utilities for potential reuse
export { DatabaseSystemRegistry } from './utils/database-utils.js'
export { QueryFormatter } from './utils/query-utils.js'
export { FilterService } from './utils/filter-utils.js'
export * from './utils/format-utils.js'

// Export services
export { TraceService } from './services/trace-service.js'
export { ActionService } from './services/action-service.js'

// Export types
export type * from './types.js'
