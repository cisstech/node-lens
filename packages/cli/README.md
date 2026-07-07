# @cisstech/node-lens-cli

The `nls` command. It runs your app with NodeLens attached and serves the MCP
server for AI agents. It is a local dev tool, so install it as a dev dependency
alongside the core server and the dashboard, which it pulls in for you:

```bash
npm install -D @cisstech/node-lens-cli     # yarn: yarn add -D @cisstech/node-lens-cli
```

Run it through your package runner (`npx` for npm or pnpm, `yarn` for Yarn) so it
resolves the local install. See the [root README](../../README.md) for the full
quick start, including which plugins to add.

## `nls monitor`

Starts your app with the OpenTelemetry SDK and NodeLens loaded, then prints the
dashboard URL once the app is listening.

```bash
npx nls monitor --mode backend node app.js
npx nls monitor --mode backend npm start
npx nls monitor --mode frontend npm run dev    # inject the dashboard into a dev server
```

| Option | Purpose |
|--------|---------|
| `--mode <backend\|frontend>` | Instrument a backend process, or inject the UI into a frontend dev server. Required. |
| `--cwd <path>` | Working directory to run the command in. Defaults to the current directory. |

**Setup note.** Add `process.env.NODE_LENS_MONITOR = 'true'` as the first line
of your entry file. The CLI may launch your app through `npm`/`yarn`/`nx`, and
this flag tells NodeLens to attach to your actual app process rather than the
launcher.

## `nls mcp`

Runs a [Model Context Protocol](https://modelcontextprotocol.io) server that
gives an AI agent read-only access to the running session's data. See the
[MCP guide](../../docs/MCP.md).

```bash
npx nls mcp [--cwd <path>]
```

`--cwd` (or `$NODE_LENS_CWD`) sets where to look for the session; otherwise it
searches up from the current directory.
