# node-lens-example-slowest

A complete NodeLens plugin in three files, with **no build step**: the source
lives directly at the `dist/src/{server,client}/index.js` paths NodeLens
discovers. It tracks the slowest HTTP endpoints and renders them as a dashboard
tab, and answers a `ranking` command.

Use it as the reference for [docs/PLUGIN_AUTHORING.md](../../../docs/PLUGIN_AUTHORING.md):

- [`dist/src/server/index.js`](dist/src/server/index.js): the `NodeLensPlugin`
  class (subscribes to `OTEL_TRACE_EVENT`, emits `slowest`, handles `ranking`).
- [`dist/src/client/index.js`](dist/src/client/index.js): the `nl-slowest`
  custom element that reads data via the injected `client`.

To try it, install it into a monitored project and add `new SlowestPlugin()` to
`nodelens.config.js`.
