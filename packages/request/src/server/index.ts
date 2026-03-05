/* eslint-disable @typescript-eslint/no-explicit-any */
import { buildSpanTree, OTEL_TRACE_EVENT, TraceData, type EventBus, type NodeLensPlugin } from '@cisstech/node-lens-server'
import { SpanKind } from '@opentelemetry/api'
import { hrTimeToMilliseconds } from '@opentelemetry/core'
import type { Instrumentation } from '@opentelemetry/instrumentation'
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express'
import { GraphQLInstrumentation } from '@opentelemetry/instrumentation-graphql'
import { GrpcInstrumentation } from '@opentelemetry/instrumentation-grpc'
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http'
import { NetInstrumentation } from '@opentelemetry/instrumentation-net'
import { SocketIoInstrumentation } from '@opentelemetry/instrumentation-socket.io'
import * as fs from 'fs'
import { IncomingMessage, ServerResponse } from 'http'
import * as yaml from 'js-yaml'
import * as path from 'path'
import { CollectionGroup, CollectionsEvent, PLUGIN_EVENTS, PLUGIN_NAME, PluginOptions, RequestEvent, RequestOperation, VariablesEvent } from './types'
import { parseSearchParams } from './utils'

export * from './types'

export class RequestPlugin implements NodeLensPlugin {
  readonly icon = 'arrow-swap';
  readonly tagName = 'nl-request';
  readonly displayName = 'Request';
  readonly description = 'A plugin to monitor requests';
  readonly packageName = PLUGIN_NAME;
  readonly maxEvents = {
    [PLUGIN_EVENTS.VARIABLES]: 1,
    [PLUGIN_EVENTS.COLLECTIONS]: 1,
    [PLUGIN_EVENTS.REQUEST]: 200,
  }
  private options: Required<PluginOptions>
  private eventBus?: EventBus

  private collections: CollectionGroup[] = []

  constructor(options: PluginOptions = {}) {
    this.options = {
      includeHeaders: options.includeHeaders ?? true,
      captureBody: options.captureBody ?? true,
      maxBodySize: options.maxBodySize ?? 1024 * 1024, // 1MB limit for dev
      variablesFile: options.variablesFile || '',
      collectionsDir: options.collectionsDir || '',
    }
  }

  bindToEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus
    eventBus.on<TraceData[]>(OTEL_TRACE_EVENT, (event) => {
      const tree = buildSpanTree(event.data, ['resource'])

      for (const root of tree) {
        // Forward only HTTP server spans (incoming requests)
        if (root.kind !== SpanKind.SERVER || !root.attributes['http.method']) continue

        const headers = {
          request: JSON.parse((root.attributes['http.request.headers'] + '').replaceAll('undefined', 'null') || '{}') || {},
          response: JSON.parse((root.attributes['http.response.headers'] + '').replaceAll('undefined', 'null') || '{}') || {},
        }

        const searchParams = parseSearchParams(root.attributes['http.url'] as string)
        const request: RequestEvent = {
          id: root.spanId,
          traceId: root.traceId,
          timestamp: root.timestamp,
          request: {
            headers: this.options.includeHeaders ? headers.request : {},
            size: Number(headers.request['content-length'] || 0),
            body: this.options.captureBody ? root.attributes['http.request.body'] : null,
            url: root.attributes['http.url'] as string,
            path: root.attributes['http.route'] as string,
            query: Array.from(searchParams?.entries() || []).reduce((acc, [key, value]) => {
              acc[key] = value
              return acc
            }, {} as Record<string, string>),
            method: root.attributes['http.method'] as string,
          },
          response: {
            headers: this.options.includeHeaders ? headers.response : {},
            size: Number(headers.response['content-length'] || 0),
            body: this.options.captureBody ? root.attributes['http.response.body'] : null,
            duration: hrTimeToMilliseconds(root.duration),
            statusCode: Number(root.attributes['http.status_code'] || 0),
          },
          operations: root.children?.map((span) => this.traceDataToOperation(span)),
        }

        this.eventBus?.emit(PLUGIN_EVENTS.REQUEST, request, this.packageName)
      }
    })

    this.loadVariables(this.options.variablesFile)
    this.loadCollections(this.options.collectionsDir)
  }

  instrumentations(): Instrumentation[] {
    return [
      new HttpInstrumentation({
        ignoreIncomingRequestHook: (req) => {
          return !!req.url?.includes('node-lens')
        },
        requestHook: (span, request) => {
          // Handle incoming requests (server side)
          if (request instanceof IncomingMessage && request.headers) {
            const req = request
            span.setAttribute('http.request.headers', JSON.stringify(req.headers))

            // Capture request body (incoming)
            let body = ''
            req.on('data', (chunk) => {
              body += chunk.toString()
              if (body.length > this.options.maxBodySize) {
                body = body.slice(0, this.options.maxBodySize) + '...[truncated]'
                req.removeAllListeners('data')
              }
            })
            req.on('end', () => {
              span.setAttribute('http.request.body', body)
            })
          }
        },
        responseHook: (span, response) => {
          const { maxBodySize } = this.options

          // Handle server responses (ServerResponse, writable)
          if (response instanceof ServerResponse) {
            const res = response

            // Patch write/end to capture body
            const chunks: Buffer[] = []
            const origWrite = res.write
            const origEnd = res.end

            res.write = function (chunk: any, ...args: any[]) {
              if (chunk) {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
              }
              return origWrite.apply(this, [chunk, ...args] as any)
            }

            res.end = function (chunk: any, ...args: any[]) {
              if (chunk) {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
              }
              const body = Buffer.concat(chunks as any).toString('utf8')
              const truncated = body.length > maxBodySize ? body.slice(0, maxBodySize) + '...[truncated]' : body

              span.setAttribute('http.response.body', truncated)
              span.setAttribute('http.response.headers', JSON.stringify(res.getHeaders()))

              return origEnd.apply(this, [chunk, ...args] as any)
            }
          }

          // Handle outgoing responses (IncomingMessage, readable)
          if (response instanceof IncomingMessage) {
            const res = response
            span.setAttribute('http.response.headers', JSON.stringify(res.headers))

            // Capture response body (outgoing request)
            let body = ''
            res.on('data', (chunk) => {
              body += chunk.toString()
              if (body.length > maxBodySize) {
                body = body.slice(0, maxBodySize) + '...[truncated]'
                res.removeAllListeners('data')
              }
            })
            res.on('end', () => {
              span.setAttribute('http.response.body', body)
            })
          }
        },
      }),
      new ExpressInstrumentation({
        requestHook: () => {
          //
        }
      }),
      new GraphQLInstrumentation({}),
      new SocketIoInstrumentation({}),
      new GrpcInstrumentation({}),
      new NetInstrumentation({}),
    ]
  }

  private traceDataToOperation(span: TraceData): RequestOperation {
    return {
      name: span.name,
      startTimeMs: hrTimeToMilliseconds(span.startTime),
      endTimeMs: hrTimeToMilliseconds(span.endTime),
      durationMs: hrTimeToMilliseconds(span.duration),
      attributes: span.attributes,
      isError: span.isError,
      events: span.events?.map((event) => ({
        name: event.name,
        time: hrTimeToMilliseconds(event.time),
        attributes: event.attributes,
      })),
      children: span.children?.map((child) => this.traceDataToOperation(child)),
    }
  }

  private loadVariables(file?: string) {
    if (!file) return
    const absFile = path.resolve(process.cwd(), file)
    if (!fs.existsSync(absFile)) {
      console.warn(`[RequestPlugin] Variables file does not exist: ${absFile}`)
      return
    }

    try {
      const raw = fs.readFileSync(absFile, 'utf-8')
      let parsed: any
      if (absFile.endsWith('.yaml') || absFile.endsWith('.yml')) {
        parsed = yaml.load(raw)
      } else {
        parsed = JSON.parse(raw)
      }

      if (parsed?.variables) {
        this.eventBus?.emit<VariablesEvent>(
          PLUGIN_EVENTS.VARIABLES,
          { variables: parsed.variables },
          this.packageName,
        )
      }
    } catch (err) {
      console.error(`[RequestPlugin] Failed to load variables: ${absFile}`, err)
    }
  }

  private loadCollections(dir?: string) {
    if (!dir) return
    const absDir = path.resolve(process.cwd(), dir)
    if (!fs.existsSync(absDir)) {
      console.warn(`[RequestPlugin] Collections directory does not exist: ${absDir}`)
      return
    }

    const files = this.walkDir(absDir)
    const groups: CollectionGroup[] = []

    for (const file of files) {
      try {
        const raw = fs.readFileSync(file, 'utf-8')
        let parsed: any
        if (file.endsWith('.yaml') || file.endsWith('.yml')) {
          parsed = yaml.load(raw)
        } else if (file.endsWith('.json')) {
          parsed = JSON.parse(raw)
        } else {
          continue
        }

        if (parsed?.collections) {
          groups.push(...parsed.collections)
        }
      } catch (err) {
        console.error(`[RequestPlugin] Failed to load collection ${file}:`, err)
      }
    }

    this.collections = groups
    if (this.collections.length > 0) {
      this.eventBus?.emit<CollectionsEvent>(
        PLUGIN_EVENTS.COLLECTIONS,
        { collections: this.collections },
        this.packageName,
      )
    }
  }

  private walkDir(dir: string, fileList: string[] = []): string[] {
    const files = fs.readdirSync(dir)
    for (const file of files) {
      const fullPath = path.join(dir, file)
      const stat = fs.statSync(fullPath)
      if (stat.isDirectory()) {
        this.walkDir(fullPath, fileList)
      } else {
        fileList.push(fullPath)
      }
    }
    return fileList
  }
}
