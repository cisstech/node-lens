const { NodeSDK } = require('@opentelemetry/sdk-node')
const { generateFrontendMonitoringScript, NodeLensFrontHttpInstrumentation } = require('@cisstech/node-lens-server')

const sdk = new NodeSDK({
  instrumentations: [
    new NodeLensFrontHttpInstrumentation({
      injectScript: generateFrontendMonitoringScript(),
    }),
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
