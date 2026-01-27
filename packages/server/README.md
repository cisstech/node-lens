# @cisstech/node-lens-server

The core of NodeLens: it bridges OpenTelemetry to the dashboard and hosts the
plugin system. Your app never imports this at runtime; the
[`nls` CLI](../cli) loads it. You import it to **write a plugin** or to configure
a session in `nodelens.config.js`.

> New here? Start with the [root README](../../README.md) for install and quick
> start, and the [plugin authoring guide](../../docs/PLUGIN_AUTHORING.md) to build
> a plugin. This page documents the server's own API.

## `createNodeLens(options)`

`nodelens.config.js` exports one call to `createNodeLens`. It wires the event
bus, the event store, the SSE channel, and your plugins, then waits for the CLI
to hand it the running app.

```js
const { createNodeLens } = require('@cisstech/node-lens-server')
const { RequestPlugin } = require('@cisstech/node-lens-request')

module.exports = createNodeLens({
  plugins: [new RequestPlugin({ captureBody: true })],
})
```

| Option | Default | Purpose |
|--------|---------|---------|
| `plugins` | `[]` | The plugin instances to run. |
| `baseUrl` | `/node-lens/` | URL prefix the dashboard and APIs are mounted under. |
| `hostname` | app's origin | Override the host used to build dashboard URLs. |
| `eventStore` | `{ backend: 'file', path: './.node-lens/events' }` | Where captured events are buffered. |
| `metricCollectionInterval` | `60000` | Metric export interval, in ms. |

## How data flows

```
your app → OpenTelemetry SDK → NodeLens exporters → EventBus
                                                       ├─ plugins transform & re-emit
                                                       └─ SseManager → dashboard (live)
                                                          + FileEventStore (history / MCP)
```

The CLI installs the OTel SDK with the NodeLens exporters and each plugin's
`instrumentations()`, then calls `nodeLens.listen(app)` once the app is
listening. Each monitoring run is a fresh session (the store resets on boot), and
every SSE/command/history request is authenticated with a per-session token.

## What it exports for plugin authors

- `NodeLensPlugin`: the interface your plugin class implements.
- `EventBus`, and the OTel event constants `OTEL_TRACE_EVENT`, `OTEL_LOG_EVENT`,
  `OTEL_METRIC_EVENT`, plus the `TraceData` / `LogData` / `MetricData` shapes.
- `BaseCommandHandler`, `CommandChain`: for `handleCommand` implementations.
- `EventStore`, `SSEEvent`, `HistoryQuery`, `HistoryResult`, `FilterExpr`: the
  event-store types the client reads through.
- `AppInfo`: framework/port info passed to `onListen` and `isAvailable`.

See the [authoring guide](../../docs/PLUGIN_AUTHORING.md) for how these fit
together.

## Develop

```bash
npx nx build node-lens-server
npx nx test node-lens-server
```
