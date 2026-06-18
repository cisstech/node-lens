# Writing a NodeLens plugin

A NodeLens plugin is a single npm package that ships **two build outputs**:

| Output | Module system | Runs in | Path (required, hard-coded) |
|--------|---------------|---------|------------------------------|
| Server | CommonJS | your Node app process | `dist/src/server/index.js` |
| Client | ESM | the dashboard (browser) | `dist/src/client/index.js` |

The server half subscribes to OpenTelemetry data, transforms it, and emits your
own events (and optionally answers commands). The client half is a custom
element that renders those events as a tab in the dashboard. NodeLens wires the
two together by a shared **`tagName`**.

> The full, runnable example this guide describes ships in
> [`samples/plugins/slowest/`](../samples/plugins/slowest/), a plugin in three
> files with no build step.

---

## 1. The contract

Your server entry must export a class implementing `NodeLensPlugin`
(from `@cisstech/node-lens-server`):

```ts
export interface NodeLensPlugin {
  readonly icon: string          // codicon name or emoji, shown on the tab
  readonly tagName: string       // custom-element tag your client registers
  readonly displayName: string   // tab label
  readonly packageName: string   // your npm package name, also the event scope
  readonly description: string
  readonly maxEvents?: Record<string, number> // per-event-type retention cap

  bindToEventBus(eventBus: EventBus): void     // subscribe / re-emit here

  instrumentations?(): Instrumentation[]       // OTel instrumentations to install
  handleCommand?(command: string, payload?: any): Promise<any> // client → server calls

  // Lifecycle (all optional)
  onListen?(appInfo: AppInfo): void
  onLoadExpress?(express: any, version: string): void
  onLoadFastify?(fastify: any, version: string): void
  onLoadNestCore?(nestCore: any, version: string): void
  onLoadNestCommon?(nestCommon: any, version: string): void
}
```

`icon`, `tagName`, `displayName`, `packageName`, `description` and
`bindToEventBus` are **required**; everything else is optional. `distPath` /
`entryUrl` are filled in by the framework, so you do not set them.

---

## 2. Server side (`src/server/index.ts`, CommonJS)

Subscribe to the OpenTelemetry events NodeLens broadcasts, then re-emit your own
domain events **scoped to your package name**:

```js
const { OTEL_TRACE_EVENT } = require('@cisstech/node-lens-server')

const PLUGIN_NAME = '@you/node-lens-slowest'

class SlowestPlugin {
  icon = 'flame'
  tagName = 'nl-slowest'
  displayName = 'Slowest'
  packageName = PLUGIN_NAME
  description = 'Top slowest HTTP endpoints'
  // Keep only the newest N events of each type on disk / in the live buffer.
  maxEvents = { slowest: 1 }

  bindToEventBus(eventBus) {
    eventBus.on(OTEL_TRACE_EVENT, (info) => {
      const spans = info.data || []           // TraceData[] for one export batch
      // …aggregate…
      eventBus.emit('slowest', ranking, PLUGIN_NAME) // (eventType, data, scope)
    })
  }

  // Optional: answer client → server calls
  async handleCommand(command, payload) {
    if (command === 'ranking') return this.currentRanking()
    throw new Error(`Unknown command: ${command}`)
  }
}

module.exports = { SlowestPlugin }
```

Available OTel event constants (all from `@cisstech/node-lens-server`):
`OTEL_TRACE_EVENT`, `OTEL_LOG_EVENT`, `OTEL_METRIC_EVENT`. The payload is
`{ event, data, scope }`; `data` is the batch (e.g. `TraceData[]`).

**Spans are OTel-shaped.** `span.kind` is the numeric `SpanKind`
(`1` = SERVER), and times are `HrTime` tuples (`[seconds, nanos]`), so use
`hrTimeToMilliseconds` from `@opentelemetry/core` to convert. Emit domain data
in whatever plain-JSON shape your client wants.

---

## 3. Client side (`src/client/index.ts`, ESM)

Register a custom element under the **exact `tagName`** your server declared.
NodeLens creates the element and assigns it a `client` property, an instance of
`NodeLensClient`, through which you read events and call commands:

```js
class NlSlowest extends HTMLElement {
  set client(c) { this._client = c; this.refresh() }

  async refresh() {
    // Pull historical events for your scope…
    const { events } = await this._client.events.list('@you/node-lens-slowest')
    // …and/or subscribe to live ones:
    this._client.events.subscribe('@you/node-lens-slowest', (e) => this.render(e.data))
    // …and/or call a server command:
    const ranking = await this._client.commands.execute('@you/node-lens-slowest', 'ranking')
    this.render(ranking)
  }
}
customElements.define('nl-slowest', NlSlowest)
```

`client` exposes:

- `client.events.list(scope, opts?)` → `{ events, totalCount }` (history)
- `client.events.subscribe(scope, cb, signal?)` → live events
- `client.events.clear(scope, eventType?)`
- `client.commands.execute(pluginPackageName, command, payload?)` → your `handleCommand` result

You may use any UI library (the built-in plugins use [Lit](https://lit.dev)) or
none, as long as you register a custom element with the right tag. The design
system components (`nl-table`, `nl-tabs`, `nl-tree`, …) are exported from
`@cisstech/node-lens-client` if you want them.

---

## 4. Events vs Commands

- **Events** (server → client, push): continuous data such as requests, queries, and logs.
  Stored in the event store (respecting `maxEvents`) and streamed live over SSE.
- **Commands** (client → server, request/response): on-demand actions, such as running an
  `EXPLAIN`, replay a request, fetch a computed ranking. Implement `handleCommand`.

Command and history calls are authenticated with the session token
automatically by `NodeLensClient`; you do not handle auth in your plugin.

---

## 5. Packaging & discovery

- `package.json`: `"main": "dist/src/server/index.js"`, `"type": "commonjs"`.
- Build (or hand-write) the two outputs at the exact paths in the table above:
  `PluginManager` discovers `node_modules/<pkg>/dist/src/client/index.js` and
  serves it to the dashboard.
- Install the plugin in the monitored project and add it to `nodelens.config.js`:

```js
const { createNodeLens } = require('@cisstech/node-lens-server')
const { SlowestPlugin } = require('@you/node-lens-slowest')

module.exports = createNodeLens({ plugins: [new SlowestPlugin()] })
```

Start `nls monitor …`; your tab appears in the dashboard, and (if your plugin
emits useful runtime signals) the data is also queryable by AI agents through
[`nls mcp`](./MCP.md).
