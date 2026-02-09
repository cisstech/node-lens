# @cisstech/node-lens-cli

The `nls` command. It runs your app with NodeLens attached and serves the MCP
server for AI agents. Install it globally:

```bash
npm install -g @cisstech/node-lens-cli
```

See the [root README](../../README.md) for the full quick start.

## `nls monitor`

Starts your app with the OpenTelemetry SDK and NodeLens loaded, then prints the
dashboard URL once the app is listening.

```bash
nls monitor --mode backend node app.js
nls monitor --mode backend npm start
nls monitor --mode frontend npm run dev    # inject the dashboard into a dev server
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
nls mcp [--cwd <path>]
```

`--cwd` (or `$NODE_LENS_CWD`) sets where to look for the session; otherwise it
searches up from the current directory.
