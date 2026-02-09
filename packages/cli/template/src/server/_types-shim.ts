// Temporary local type shim for building before @cisstech/node-lens-server is published.

import { IncomingMessage, ServerResponse } from 'http'

// Replace by removing this file and the path mapping once consuming published types.
export interface EventBus {
  emit<T = any>(event: string, data: T, scope?: string): void
}

export interface NodeLensPlugin {
  attach(eventBus: EventBus): void

  request?(req: IncomingMessage, res: ServerResponse): void
}
