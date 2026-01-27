/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Event information passed to event handlers
 */
export type EventInfo<T = any> = {
  /** Optional scope to namespace events (typically plugin name) */
  scope?: string
  /** Event name identifier */
  event: string
  /** Event payload data */
  data: T
}

/**
 * Function signature for handling events
 */
export type EventHandler<T = any> = (info: EventInfo<T>) => void

/**
 * Function to unsubscribe from an event
 */
export type EventDisposable = () => void

/**
 * Event bus interface for pub/sub messaging between components
 */
export interface EventBus {
  /** Emit an event with optional scope */
  emit<T = any>(event: string, data: T, scope?: string): void
  /** Subscribe to an event, returns unsubscribe function */
  on<T = any>(event: string, handler: EventHandler<T>): EventDisposable
  /** Unsubscribe from an event */
  off<T = any>(event: string, handler: EventHandler<T>): void
  /** Subscribe to an event once, auto-unsubscribes after first call */
  once<T = any>(event: string, handler: EventHandler<T>): EventDisposable
}
