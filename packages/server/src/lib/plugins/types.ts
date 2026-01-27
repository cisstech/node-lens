/* eslint-disable @typescript-eslint/no-explicit-any */
import type * as nestCore from '@nestjs/core'
import type { Instrumentation } from '@opentelemetry/instrumentation'
import type { EventBus } from '../events/types'

type ClassType<T = unknown> = new (...args: any[]) => T

/**
 * Application information provided to plugins during initialization
 */
export interface AppInfo {
  /** Port the application is listening on */
  port: number
  /** Underlying platform (web server) */
  platform: 'express' | 'fastify'
  /** Platform-specific application instance */
  platformApp: any
  /** High-level framework being used */
  framework: 'nestjs' | 'express' | 'fastify'
  /** Framework version string */
  frameworkVersion: string
  /** NestJS application instance (when framework is 'nestjs') */
  nestApp?: nestCore.NestApplication
  /** NestJS root module class (when framework is 'nestjs') */
  nestModule?: ClassType
}

/**
 * Plugin interface for extending NodeLens functionality
 */
export interface NodeLensPlugin {
  /** Distribution path for client-side assets */
  distPath?: string
  /** Entry URL for the plugin UI */
  entryUrl?: string
  /** Icon for the plugin (emoji or string) */
  readonly icon: string
  /** Custom element tag name for the plugin UI component */
  readonly tagName: string
  /** Human-readable plugin name */
  readonly displayName: string
  /** NPM package name */
  readonly packageName: string
  /** Brief description of plugin functionality */
  readonly description: string
  /** Event storage limits per event type */
  readonly maxEvents?: Record<string, number>

  /** Initialize plugin with event bus access */
  bindToEventBus(eventBus: EventBus): void

  /**
   * Whether this plugin applies to the running app. Returning false keeps it out
   * of the dashboard (e.g. a NestJS-only plugin on an Express app). Defaults to
   * available when omitted.
   */
  isAvailable?(appInfo: AppInfo): boolean

  /** Provide OpenTelemetry instrumentations for automatic tracing */
  instrumentations?(): Instrumentation[]

  /** Handle commands from client-side plugin components */
  handleCommand?(command: string, payload?: any): Promise<any>

  /** Called when application starts listening for requests */
  onListen?: (appInfo: AppInfo) => void

  /** Called when Express framework is loaded (before app creation) */
  onLoadExpress?: (express: typeof import('express'), version: string) => void

  /** Called when Fastify framework is loaded (before app creation) */
  onLoadFastify?: (fastify: typeof import('fastify'), version: string) => void

  /** Called when NestJS core is loaded (before app creation) */
  onLoadNestCore?: (nestCore: typeof import('@nestjs/core'), version: string) => void

  /** Called when NestJS common is loaded (before app creation) */
  onLoadNestCommon?: (nestCommon: typeof import('@nestjs/common'), version: string) => void
}
