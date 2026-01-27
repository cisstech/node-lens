/* eslint-disable @typescript-eslint/no-explicit-any */
import { EventBus, EventDisposable, EventHandler, EventInfo } from './types'

/**
 * Thread-safe event bus implementation supporting scoped events and wildcard subscriptions.
 * Enables decoupled communication between NodeLens components and plugins.
 */
export class NodeLensEventBus implements EventBus {
  private listeners = new Map<string, Set<EventHandler>>()

  emit<T = any>(event: string, data: T, scope?: string): void {
    const directHandlers = this.listeners.get(event)
    const globalHandlers = this.listeners.get('*')

    const notify = (handlers: Set<EventHandler> | undefined) => {
      if (!handlers) return
      for (const handler of handlers) {
        try {
          handler({ event, data, scope })
        } catch (error) {
          console.error(`[NodeLens] Error in event handler for "${event}":`, error)
        }
      }
    }

    notify(directHandlers)
    notify(globalHandlers)
  }

  on<T = any>(event: string, handler: EventHandler<T>): EventDisposable {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }

    const handlers = this.listeners.get(event)
    if (handlers) {
      handlers.add(handler)
    }

    // Return unsubscribe function
    return () => this.off(event, handler)
  }

  off<T = any>(event: string, handler: EventHandler<T>): void {
    const handlers = this.listeners.get(event)
    if (handlers) {
      handlers.delete(handler)
      if (handlers.size === 0) {
        this.listeners.delete(event)
      }
    }
  }

  once<T = any>(event: string, handler: EventHandler<T>): EventDisposable {
    const onceHandler = (info: EventInfo<T>) => {
      handler(info)
      this.off(event, onceHandler)
    }

    return this.on(event, onceHandler)
  }
}
