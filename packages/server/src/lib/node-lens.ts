/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Instrumentation } from '@opentelemetry/instrumentation'
import { randomBytes } from 'crypto'
import { readFileSync } from 'fs'
import { writeFile } from 'fs/promises'
import { ServerResponse } from 'http'
import { join } from 'path'
import { NodeLensEventBus } from './events/bus'
import { EventStore } from './events/store'
import { FileEventStore } from './events/file-store'
import { SseManager } from './networking/sse'
import { StaticAssetManager } from './assets/manager'
import { ExpressPlatformAdapter, FastifyPlatformAdapter, PlatformAdapter } from './platforms/adapters'
import { RouteManager } from './networking/routes'
import { PluginManager } from './plugins/manager'
import { EventBus } from './events/types'
import { NodeLensOptions } from './core/config'
import { AppInfo, NodeLensPlugin } from './plugins/types'

/**
 * Main NodeLens server orchestrator that coordinates monitoring, plugins, and client connections.
 * Provides platform-agnostic instrumentation for Express, Fastify, and NestJS applications.
 */
export class NodeLens {
  private events: EventBus
  private store?: EventStore
  private sseManager: SseManager
  private options: Required<NodeLensOptions>
  private pluginManager: PluginManager
  private staticAssetManager: StaticAssetManager
  private routeManager: RouteManager
  private platformAdapter?: PlatformAdapter
  private appInfo: AppInfo | null = null
  /** Identifies this monitoring run so the dashboard can scope the live view. */
  private readonly sessionId: string = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  private readonly sessionStartedAt: number = Date.now()
  /**
   * Per-session secret. The dashboard receives it in its bootstrap URL and must
   * echo it on every SSE/command/history request, so other web pages open in the
   * same browser cannot read captured traffic or run plugin commands (e.g.
   * arbitrary SQL) against the local app.
   */
  private readonly sessionToken: string = randomBytes(24).toString('hex')

  /** SSE endpoint path for client connections */
  get ssePath(): string {
    return this.staticAssetManager.getSsePath()
  }

  /** Current configuration (excluding sensitive plugin instances) */
  get configuration(): Omit<NodeLensOptions, 'plugins'> {
    return structuredClone({
      ...this.options,
      plugins: undefined,
    })
  }

  /** Event bus for component communication */
  get eventBus(): EventBus {
    return this.events
  }

  /** OpenTelemetry instrumentations from all registered plugins */
  get instrumentations(): ReadonlyArray<Instrumentation> {
    const plugins = this.pluginManager.getPluginsArray()
    return plugins.flatMap((p) => p.instrumentations?.() || [])
  }

  constructor(options: Partial<NodeLensOptions> = {}) {
    this.options = {
      plugins: options.plugins ?? [],
      baseUrl: options.baseUrl ?? '/node-lens/',
      hostname: options.hostname || '',
      eventStore: options.eventStore || { backend: 'file', path: './.node-lens/events' },
      metricCollectionInterval: options.metricCollectionInterval ?? 60_000,
    }

    this.events = new NodeLensEventBus()

    // Initialize managers
    this.pluginManager = new PluginManager(this.options.baseUrl)
    this.staticAssetManager = new StaticAssetManager({
      baseUrl: this.options.baseUrl,
      hostname: this.options.hostname
    })

    if (this.options.eventStore.backend === 'file') {
      const store = new FileEventStore({
        baseDir: this.options.eventStore.path || './.node-lens',
        maxEventsOverrides: this.options.plugins.reduce((acc, p) => {
          if (p.maxEvents) {
            for (const [event, max] of Object.entries(p.maxEvents)) {
              acc[`${p.packageName}:${event}`] = max
            }
          }
          return acc
        }, {} as Record<string, number>),
      })
      this.store = store
      // Fresh session: drop any events persisted by a previous run so the live
      // view only ever shows the current process's traffic.
      store.reset().catch((err) => console.error('[NodeLens] event store reset failed:', err))
    }

    this.routeManager = new RouteManager(this.options.baseUrl, this.pluginManager.getPlugins(), this.store)
    this.sseManager = new SseManager(this.events, this.store)
    this.sseManager.setHandshakeDataProvider(() => this.handshake())

    for (const plugin of this.options.plugins) {
      this.registerPlugin(plugin)
    }
  }

  /**
   * Provide application instance (express/fastify/nest or similar)
   */
  listen(app: AppInfo): void {
    this.appInfo = app

    // Set up platform adapter
    if (app.platform === 'express') {
      this.platformAdapter = new ExpressPlatformAdapter(app.platformApp)
    } else if (app.platform === 'fastify') {
      this.platformAdapter = new FastifyPlatformAdapter(app.platformApp)
    } else {
      throw new Error(`Unsupported platform: ${app.platform}`)
    }

    // Update static asset manager with port info
    this.staticAssetManager = new StaticAssetManager({
      baseUrl: this.options.baseUrl,
      hostname: this.options.hostname,
      port: app.port
    })

    this.initializeRoutes()
    this.initializePlugins()
    this.mountClientAssets()

    this.pluginManager.getPluginsArray().forEach((plugin) => {
      plugin.onListen?.(app)
    })

    const dashboardUrl = `${this.staticAssetManager.getAssetsUrl()}/`
    console.log(`\n  🔎 NodeLens dashboard ready → ${dashboardUrl}\n`)
  }

  /**
   * Called when the Express framework is loaded.
   * Use this to monkey-patch Express internals if needed before the app is created.
   * @param express The Express module
   * @param version The version of Express
   * @returns A function to call when the plugin is ready
   */
  onLoadExpress(express: typeof import('express'), version: string): void {
    this.pluginManager.getPluginsArray().forEach((plugin) => {
      plugin.onLoadExpress?.(express, version)
    })
  }

  /**
   * Called when the Fastify framework is loaded.
   * Use this to monkey-patch Fastify internals if needed before the app is created.
   * @param fastify The Fastify module
   * @param version The version of Fastify
   * @returns A function to call when the plugin is ready
   */
  onLoadFastify(fastify: typeof import('fastify'), version: string): void {
    this.pluginManager.getPluginsArray().forEach((plugin) => {
      plugin.onLoadFastify?.(fastify, version)
    })
  }

  /**
   * Called when the NestJS core framework is loaded.
   * Use this to monkey-patch NestJS internals if needed before the app is created.
   * @param nestCore The NestJS core module
   * @param version The version of NestJS
   * @returns A function to call when the plugin is ready
   */
  onLoadNestCore(nestCore: typeof import('@nestjs/core'), version: string): void {
    this.pluginManager.getPluginsArray().forEach((plugin) => {
      plugin.onLoadNestCore?.(nestCore, version)
    })
  }

  /** Called when the NestJS common module is loaded.
   * Use this to monkey-patch NestJS common internals if needed before the app is created.
   * @param nestCommon The NestJS common module
   * @param version The version of NestJS
   * @returns A function to call when the plugin is ready
   */
  onLoadNestCommon(nestCommon: typeof import('@nestjs/common'), version: string) {
    this.pluginManager.getPluginsArray().forEach((plugin) => {
      plugin.onLoadNestCommon?.(nestCommon, version)
    })
  }

  /**
   * Add an SSE client for real-time updates
   */
  addSseClient(res: ServerResponse): number {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('Access-Control-Allow-Origin', '*')
    return this.sseManager.addClient(res)
  }

  private registerPlugin(plugin: NodeLensPlugin): void {
    this.pluginManager.registerPlugin(plugin)
    plugin.bindToEventBus(this.events)
  }

  private initializeRoutes(): void {
    if (!this.platformAdapter) {
      throw new Error('Platform adapter not initialized')
    }

    // Set up SSE route
    this.platformAdapter.get(this.ssePath, (req: any, res: any) => {
      if (!this.isAuthorized(req)) {
        return this.writeResponse(res, 403, { error: 'Forbidden' })
      }
      this.addSseClient(res as any)
    })

    // Set up plugin command API
    this.platformAdapter.get(this.routeManager.getPluginCommandPath(), async (req: any, res: any) => {
      this.applyCorsHeaders(res)
      if (!this.isAuthorized(req)) {
        return this.writeResponse(res, 403, { error: 'Forbidden' })
      }

      try {
        const { plugin: pluginName, command } = req.params || {}
        const payload = req.query?.payload ? JSON.parse(req.query.payload) : undefined

        const result = await this.routeManager.handlePluginCommand(pluginName, command, payload)
        return this.writeResponse(res, result.status, result.data)
      } catch (err) {
        console.error(`[NodeLens] Plugin command error:`, err)
        return this.writeResponse(res, 500, { error: 'Internal Server Error' })
      }
    })

    // Set up history routes
    this.platformAdapter.get(this.routeManager.getHistoryPath(), async (req: any, res: any) => {
      this.applyCorsHeaders(res)
      if (!this.isAuthorized(req)) {
        return this.writeResponse(res, 403, { error: 'Forbidden' })
      }

      const result = await this.routeManager.handleHistoryQuery(req.query || {})
      return this.writeResponse(res, result.status, result.data)
    })

    this.platformAdapter.delete(this.routeManager.getHistoryPath(), async (req: any, res: any) => {
      this.applyCorsHeaders(res)
      if (!this.isAuthorized(req)) {
        return this.writeResponse(res, 403, { error: 'Forbidden' })
      }

      const scope = String(req.query?.scope || '')
      const eventType = req.query?.eventType ? String(req.query.eventType) : undefined
      const result = await this.routeManager.handleHistoryClear(scope, eventType)
      return this.writeResponse(res, result.status, result.data)
    })
  }

  /** True when the request carries this session's token (query param or header). */
  private isAuthorized(req: any): boolean {
    const token = req?.query?.token ?? req?.headers?.['x-nodelens-token']
    return typeof token === 'string' && token === this.sessionToken
  }

  private applyCorsHeaders(response: any): void {
    try {
      response.setHeader?.('Access-Control-Allow-Origin', '*')
      response.setHeader?.('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
      response.setHeader?.('Access-Control-Allow-Headers', 'Content-Type, Accept')
    } catch {
      // ignore
    }
  }

  private writeResponse(response: any, status: number, data: any): void {
    if (response.status) {
      // Fastify-style
      if (data === null) {
        response.status(status).send()
      } else {
        response.status(status).send(data)
      }
    } else {
      // Express-style
      if (data === null) {
        response.status(status).end()
      } else {
        response.status(status).json(data)
      }
    }
  }

  private handshake() {
    return {
      timestamp: Date.now(),
      sessionId: this.sessionId,
      sessionStartedAt: this.sessionStartedAt,
      plugins: this.pluginManager.getHandshakePlugins(this.appInfo),
      appInfo: this.appInfo
        ? {
          port: this.appInfo.port,
          platform: this.appInfo.platform,
          framework: this.appInfo.framework,
          frameworkVersion: this.appInfo.frameworkVersion,
        }
        : null,
    }
  }

  private mountPluginAssets(plugin: NodeLensPlugin): void {
    if (!plugin.distPath || !this.appInfo || !this.platformAdapter) {
      console.warn(`[NodeLens] Cannot mount static assets for ${plugin.packageName} - missing distPath or platform adapter`)
      return
    }

    // Add CORS middleware for plugin paths
    this.platformAdapter.addCorsMiddleware(join(this.options.baseUrl, 'plugins'))

    // Mount static assets
    const baseUrl = this.staticAssetManager.getPluginBasePath(plugin.packageName)
    this.platformAdapter.mountStatic(baseUrl, plugin.distPath)
  }

  private mountClientAssets(): void {
    if (!this.platformAdapter) {
      throw new Error('Platform adapter not initialized')
    }

    const assetsPath = this.staticAssetManager.getAssetsPath()
    const assetsUrl = this.staticAssetManager.getAssetsUrl()
    // The dashboard authenticates by carrying the session token on its SSE URL;
    // it then reuses that token for command/history calls.
    const sseUrl = `${this.staticAssetManager.getSseUrl()}?token=${this.sessionToken}`

    const clientDir = join('node_modules', '@cisstech', 'node-lens-client', 'dist')

    const handleIndexHtml = async (req: any, res: any) => {
      try {
        const html = await this.staticAssetManager.processIndexHtml(clientDir, { assetsUrl, sseUrl })

        this.applyCorsHeaders(res)
        res.setHeader?.('Content-Type', 'text/html; charset=utf-8')
        this.writeResponse(res, 200, html)
      } catch (err) {
        console.error('[NodeLens] Error serving index.html:', err)
        this.writeResponse(res, 404, 'Not found')
      }
    }

    // Handle all variations of directory access
    this.platformAdapter.get(join(assetsPath, 'index.html'), handleIndexHtml)
    this.platformAdapter.get(assetsPath + '/', handleIndexHtml)
    this.platformAdapter.mountRedirect(assetsPath, assetsPath + '/')


    // Add CORS middleware for assets
    this.platformAdapter.addCorsMiddleware(assetsPath)

    // Serve other static assets normally
    this.platformAdapter.mountStatic(assetsPath, clientDir)

    // write .info file at .node-lens/.info.json so cli can inject monitoring script to frontend
    const info = JSON.stringify({ assetsUrl, sseUrl, token: this.sessionToken }, null, 2)
    const infoPath = join('.node-lens', '.info.json')
    writeFile(infoPath, info).catch((err) => {
      console.error('[NodeLens] Error writing .node-lens/.info.json:', err)
    })
  }

  private async initializePlugins(): Promise<void> {
    await this.pluginManager.setupPluginAssets()

    this.pluginManager.getPluginsArray().forEach((plugin) => {
      if (plugin.distPath) {
        this.mountPluginAssets(plugin)
      }
    })
  }
}

/**
 * Generates client-side monitoring script for embedding NodeLens UI in web applications.
 * Reads configuration from .node-lens/.info.json and returns HTML script tags.
 * This function is designed for synchronous usage in template engines.
 *
 * @returns HTML string containing NodeLens client setup, or empty string if configuration is missing
 */
export const generateFrontendMonitoringScript = () => {
  try {
    const infoPath = join('.node-lens', '.info.json');
    // Running as top level script so async is not possible
    const infoContent = readFileSync(infoPath, 'utf8');
    const info = JSON.parse(infoContent);
    if (!info.assetsUrl || !info.sseUrl) {
      console.warn('[NodeLens] Missing required URLs in .info.json')
      return ''
    }

    return `
    <!-- NodeLens Frontend Monitoring -->
    <node-lens></node-lens>
    <link rel="stylesheet" crossorigin href="${info.assetsUrl}/node-lens.css">
    <script type="module" crossorigin src="${info.assetsUrl}/node-lens2.js"></script>
    <script>
      // NodeLens client setup
      document.addEventListener('DOMContentLoaded', () => {
        if (typeof NodeLensClient !== 'undefined') {
          const client = new NodeLensClient();
          const nodeLens = document.querySelector('node-lens');

          if (nodeLens) {
            client.addEventListener("connectionStateChange", e => {
              nodeLens.state = e.detail;
              nodeLens.pushContent = true;
            });
          }

          client.connect("${info.sseUrl}");
          console.log('[NodeLens] Client connected to:', "${info.sseUrl}");
        } else {
          console.warn('[NodeLens] NodeLensClient not found - make sure node-lens.js is loaded');
        }
      });
    </script>`
  } catch (err) {
    console.warn('[NodeLens] Could not load .node-lens/.info.json:', err);
    return '';
  }
}

let nodeLensInstance: NodeLens | null = null

/**
 * Creates a singleton NodeLens instance with the provided configuration.
 * Throws an error if an instance already exists to prevent multiple monitoring setups.
 *
 * @param options Configuration options for NodeLens
 * @returns NodeLens instance
 */
export const createNodeLens = (options: NodeLensOptions = {}): NodeLens => {
  if (nodeLensInstance) {
    throw new Error('NodeLens instance already created')
  }

  nodeLensInstance = new NodeLens(options)
  return nodeLensInstance
}

/**
 * Returns the existing NodeLens singleton instance.
 * Throws an error if no instance has been created yet.
 *
 * @returns NodeLens instance
 */
export const getNodeLensInstance = (): NodeLens => {
  if (!nodeLensInstance) {
    throw new Error('NodeLens instance is not initialized')
  }
  return nodeLensInstance
}
