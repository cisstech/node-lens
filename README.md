# NodeLens

[![CI](https://github.com/cisstech/node-lens/actions/workflows/ci.yml/badge.svg)](https://github.com/cisstech/node-lens/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@cisstech/node-lens-cli.svg)](https://www.npmjs.com/package/@cisstech/node-lens-cli)
[![license](https://img.shields.io/github/license/cisstech/node-lens)](https://github.com/cisstech/node-lens/blob/main/LICENSE)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)

NodeLens shows you what your Node.js app actually does at runtime: every HTTP
request, database query, and log line, correlated, while it runs on your
machine. You start your app through one command and open a local dashboard.
Nothing leaves your laptop: no account, no collector, no cloud.

Your editor and your AI agent read source code. Neither can see that one request
fired the same query eleven times, which endpoint is slow, or which log line
belongs to which request. NodeLens makes that visible, and it can hand the same
live picture to a coding agent over [MCP](docs/MCP.md), so it debugs from what
the app *does*, not just what the code *says*.

## What it shows you

- **Requests**: each HTTP request as a timeline of its middleware and downstream
  calls, with headers, body, status, and duration. Replay a request or copy it
  as cURL.
- **Database**: queries grouped under the request that triggered them, with N+1
  bursts and slow queries flagged. Run ad-hoc queries and `EXPLAIN` from the
  dashboard. Works with PostgreSQL, MySQL, MongoDB, and Redis.
- **Logs**: `console`, Pino, and NestJS logs, tied back to the request that
  produced them.

## Quick start

NodeLens is a local dev tool, so install it as dev dependencies: the `nls` CLI
plus the plugins for what you want to see. The CLI brings the core server and
the dashboard with it, so this is everything you need.

```bash
# npm
npm install -D @cisstech/node-lens-cli @cisstech/node-lens-request @cisstech/node-lens-database @cisstech/node-lens-logging

# yarn
yarn add -D @cisstech/node-lens-cli @cisstech/node-lens-request @cisstech/node-lens-database @cisstech/node-lens-logging
```

On a NestJS app, add `@cisstech/node-lens-introspection` for a module, provider,
and route view.

Add a `nodelens.config.js` at your project root, listing the plugins you
installed:

```javascript
const { createNodeLens } = require('@cisstech/node-lens-server')
const { RequestPlugin } = require('@cisstech/node-lens-request')
const { DatabasePlugin } = require('@cisstech/node-lens-database')
const { LoggingPlugin } = require('@cisstech/node-lens-logging')

module.exports = createNodeLens({
  plugins: [new RequestPlugin(), new DatabasePlugin(), new LoggingPlugin()],
})
```

Add this as the first line of your app's entry file, so NodeLens attaches to
your app and not to the `npm`/`yarn`/`nx` process that may launch it:

```javascript
process.env.NODE_LENS_MONITOR = 'true'
```

Because the CLI is a local install, run it through your package runner: `npx`
for npm or pnpm, `yarn` for Yarn.

```bash
npx nls monitor --mode backend node app.js     # or: npm start, nx serve api, ...
# yarn: yarn nls monitor --mode backend node app.js
```

The CLI prints the dashboard URL once your app starts listening, by default
`http://localhost:<your-app-port>/node-lens/assets/`. Open it in a browser and
requests, queries, and logs stream in live.

### Watch it inside your frontend

`--mode frontend` injects the same dashboard as an overlay into a running
frontend dev server (Vite, `ng serve`, `next dev`, and the like), so you read it
from within your own app instead of a separate page. Start your backend in
`--mode backend` first (it opens the session the overlay reads from), then run
the frontend under NodeLens:

```bash
npx nls monitor --mode frontend npm run dev    # or: nx serve app, vite, ng serve, ...
```

Toggle the panel from inside your app with `Ctrl/Cmd` + `Shift` + `L`.

Want to see it before wiring up your own app? The [blog sample](samples/blog/)
runs a small app with intentional N+1s and slow queries to explore.

## Give it to your AI agent

`nls mcp` runs a Model Context Protocol server that exposes the current
session's runtime data (recent requests, N+1 findings, slow queries, correlated
logs) to agents like Claude Code and Cursor. Everything stays local.

```bash
npx nls mcp     # yarn: yarn nls mcp
```

The [MCP guide](docs/MCP.md) has a 60-second local test and the agent config.

## How it works

`nls monitor` starts your app with the OpenTelemetry SDK attached. NodeLens
turns that telemetry into events, plugins shape those events into what you see,
and the dashboard streams them live over Server-Sent Events. Each run is a fresh
session, and the dashboard and MCP APIs are gated by a per-session token so
other pages in your browser can't read your traffic.

## Packages

| Package | What it does | Version |
|---------|--------------|---------|
| [`@cisstech/node-lens-cli`](packages/cli) | The `nls` CLI: runs your app under monitoring and serves the MCP server. | [![npm](https://img.shields.io/npm/v/@cisstech/node-lens-cli.svg)](https://www.npmjs.com/package/@cisstech/node-lens-cli) |
| [`@cisstech/node-lens-server`](packages/server) | Core: the OpenTelemetry bridge, event store, and plugin API. | [![npm](https://img.shields.io/npm/v/@cisstech/node-lens-server.svg)](https://www.npmjs.com/package/@cisstech/node-lens-server) |
| [`@cisstech/node-lens-request`](packages/request) | HTTP requests, timelines, and a request playground. | [![npm](https://img.shields.io/npm/v/@cisstech/node-lens-request.svg)](https://www.npmjs.com/package/@cisstech/node-lens-request) |
| [`@cisstech/node-lens-database`](packages/database) | Database queries, N+1 detection, and a query playground. | [![npm](https://img.shields.io/npm/v/@cisstech/node-lens-database.svg)](https://www.npmjs.com/package/@cisstech/node-lens-database) |
| [`@cisstech/node-lens-logging`](packages/logging) | Logs correlated to requests. | [![npm](https://img.shields.io/npm/v/@cisstech/node-lens-logging.svg)](https://www.npmjs.com/package/@cisstech/node-lens-logging) |
| [`@cisstech/node-lens-introspection`](packages/introspection) | NestJS modules, providers, and routes (NestJS apps only). | [![npm](https://img.shields.io/npm/v/@cisstech/node-lens-introspection.svg)](https://www.npmjs.com/package/@cisstech/node-lens-introspection) |

## Writing a plugin

A plugin is a package that reads OpenTelemetry data on the server and renders a
tab in the dashboard. The [authoring guide](docs/PLUGIN_AUTHORING.md) has the
contract and a runnable, no-build example.

## Requirements

- Node.js 22
- A CommonJS entry file (the CLI instruments via `--require`)
- A `nodelens.config.js` in your project root with at least one plugin

## Development

This is an Nx workspace.

```bash
npx nx run-many -t build     # build all packages
npx nx run-many -t test      # run tests
npx nx release               # version and publish (add --dry-run to preview)
```

## License

MIT. See [LICENSE](LICENSE).
