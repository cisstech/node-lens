const { join } = require('path')

const setupMonitoring = () => {
  // OpenTelemetry
  const { NodeSDK } = require('@opentelemetry/sdk-node')
  const { resourceFromAttributes } = require('@opentelemetry/resources')
  const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } = require('@opentelemetry/semantic-conventions')
  const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics')
  const { SimpleLogRecordProcessor } = require('@opentelemetry/sdk-logs')
  const { BatchSpanProcessor } = require('@opentelemetry/sdk-trace-base')

  // Instrumentations
  const {
    NodeLensMetricExporter,
    NodeLensTraceExporter,
    NodeLensLogRecordExporter,
    NodeLensBackendInstrumentation,
  } = require('@cisstech/node-lens-server')

  // NodeLens SDK
  const nodeLens = require(join(process.cwd(), 'nodelens.config.js'))

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'node-lens-app',
    [ATTR_SERVICE_VERSION]: '1.0.0',
  })

  const logProcessor = new SimpleLogRecordProcessor(new NodeLensLogRecordExporter(nodeLens.eventBus))

  // Flush spans quickly so traces appear in the dashboard near-instantly. Still
  // batched (not per-span) so all of a request's spans reach the plugins
  // together and can be grouped into one trace.
  const spanProcessor = new BatchSpanProcessor(new NodeLensTraceExporter(nodeLens.eventBus), {
    scheduledDelayMillis: 500,
  })

  const sdk = new NodeSDK({
    // https://www.npmjs.com/package/@opentelemetry/auto-instrumentations-node
    resource,
    metricReader: new PeriodicExportingMetricReader({
      exporter: new NodeLensMetricExporter(nodeLens.eventBus),
      exportIntervalMillis: nodeLens.options.metricCollectionInterval,
    }),
    spanProcessors: [spanProcessor],
    logRecordProcessors: [logProcessor],
    instrumentations: [
      new NodeLensBackendInstrumentation({
        callbacks: {
          onListen: (appInfo) => {
            nodeLens.listen(appInfo)
          },
          onLoadExpress: (express, version) => {
            nodeLens.onLoadExpress(express, version)
          },
          onLoadFastify: (fastify, version) => {
            nodeLens.onLoadFastify(fastify, version)
          },
          onLoadNestCore: (nestCore, version) => {
            nodeLens.onLoadNestCore(nestCore, version)
          },
          onLoadNestCommon: (nestCommon, version) => {
            nodeLens.onLoadNestCommon(nestCommon, version)
          },
        },
      }),
      ...nodeLens.instrumentations,
    ],
  })

  sdk.start()

  const shutdown = () => {
    sdk
      .shutdown()
      .then(() => console.log('[NodeLens] SDK shut down successfully'))
      .catch((error) => console.log('[NodeLens] Error shutting down SDK', error))
      .finally(() => process.exit(0))
  }

  // Gracefully shutdown SDK if a SIGTERM is received
  process.on('SIGTERM', shutdown)
  // Gracefully shutdown SDK if a SIGINT is received
  process.on('SIGINT', shutdown)
  // Gracefully shutdown SDK if Node.js is exiting normally
  process.once('beforeExit', shutdown)

  console.log('[NodeLens] initialized')
}

const envProxy = new Proxy(process.env, {
  set(target, prop, value) {
    if (prop === 'NODE_LENS_MONITOR' && value === 'true') {
      setupMonitoring()
    }
    target[prop] = value
    return true
  },
})

process.env = envProxy
