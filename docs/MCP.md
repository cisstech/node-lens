# NodeLens MCP server: runtime data for AI agents

Your AI coding agent reads your **source code**, but it can't see what the app
actually does at runtime: which requests fire, how many DB queries each one
triggers, which are slow, what got logged. `nls mcp` closes that gap. It runs a
[Model Context Protocol](https://modelcontextprotocol.io) server (stdio) that
exposes the current NodeLens session's captured data as read-only tools, so an
agent like Claude Code or Cursor can ask *"is this endpoint doing an N+1?"* and
get a precise, grounded answer instead of guessing from the code.

Everything stays local. The MCP server reads `.node-lens/.info.json` for the
running session's origin and token, then queries the same token-gated history
API the dashboard uses. No data leaves your machine.

## Connect it to your project

You almost certainly have NodeLens as a project dev dependency:

```bash
npm i -D @cisstech/node-lens-cli     # or: yarn add -D @cisstech/node-lens-cli
```

The MCP config lives in one file, `.mcp.json`, at your project root. Claude Code
reads it both in the terminal and in the VS Code and JetBrains extensions. Other
clients such as Cursor use their own MCP config file, with the same `command`
and `args`. Reference the CLI through your package runner so it resolves the
local install, no global needed:

```json
{
  "mcpServers": {
    "nodelens": { "command": "npx", "args": ["nls", "mcp"] }
  }
}
```

Use `"command": "yarn"` (same `args`) in a Yarn project. On first load the
client asks you to approve the project MCP server once. Accept it, and the
server stays connected across restarts.

> The server searches upward from its working directory for
> `.node-lens/.info.json`. Clients launch `.mcp.json` servers from the project
> root, so it finds the session automatically. Pass `--cwd <abs-path>` only if
> you run it from elsewhere. Avoid the relative `--cwd .`, which depends on who
> spawned the process.

## Terminal session vs. editor extension: the PATH gap

This is the number one reason a working config "breaks in the extension." A
terminal Claude Code inherits your shell's `PATH`, including nvm, `fnm`, or a
global npm bin dir. A GUI-launched editor extension does not: macOS and Windows
GUI apps start from a minimal environment, so `npx`, `yarn`, or `node` managed
by a version manager may simply not be found (`spawn ENOENT`).

Pick the fix that matches how you launch the editor:

- **Launch Claude Code from the editor's integrated terminal.** It inherits your
  shell env, so the `npx`/`yarn` config above just works. Simplest fix.
- **Commit a wrapper that re-establishes the environment.** Robust and portable
  across the team, and it only depends on `/bin/bash`, which always exists.
  Create `bin/nls-mcp.sh`:

  ```bash
  #!/usr/bin/env bash
  # Re-establish a version manager if present (no-op otherwise), then exec the
  # locally-installed CLI. The client spawns us with cwd = project root.
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use >/dev/null 2>&1
  exec node_modules/.bin/nls mcp "$@"
  ```

  ```jsonc
  // .mcp.json
  { "mcpServers": { "nodelens": { "command": "bash", "args": ["bin/nls-mcp.sh"] } } }
  ```

- **Pin absolute paths per machine.** When you can't use a wrapper, put a
  machine-specific config in your user-scope MCP settings (not the committed
  project `.mcp.json`), using absolute paths so nothing depends on `PATH`:

  ```json
  {
    "mcpServers": {
      "nodelens": {
        "command": "/Users/you/.nvm/versions/node/vXX/bin/node",
        "args": ["node_modules/.bin/nls", "mcp", "--cwd", "/abs/path/to/project"]
      }
    }
  }
  ```

Run NodeLens under the same Node version as your app (honor your `.nvmrc`). The
wrapper's `nvm use` handles this, and the absolute-path form pins it explicitly.

## Verify without an agent (60 seconds)

Confirm the server works before wiring up any editor. From a clone of the
NodeLens repo (the [blog sample](../samples/blog/) is built to produce
interesting traces):

```bash
# 1. start the database and the monitored app
docker compose up -d postgres
node packages/cli/bin/nls.js monitor --mode backend node samples/blog/index.js

# 2. in a second terminal, generate traffic and smoke-test the MCP tools
node samples/blog/traffic.mjs
node samples/blog/mcp-smoke.mjs
```

`mcp-smoke.mjs` spawns `nls mcp`, performs the JSON-RPC handshake, and prints
the result of every tool. You should see `find_n1_queries` flag `GET /posts`,
`list_slow_queries` flag `GET /search`, and an `ERROR` log for `GET /boom`.

Using NodeLens in your own project instead? Run the equivalent smoke test with
your local CLI. The tools return "not running" until a `nls monitor` session
exists, then pick it up automatically:

```bash
npx nls monitor --mode backend <your app start command>   # terminal 1
# generate some traffic against your app, then in terminal 2:
npx nls mcp   # or point your agent at it and ask nodelens_status
```

## Tools

| Tool | What it answers |
|------|-----------------|
| `nodelens_status` | Is a session running? How much has it captured? (call first) |
| `list_requests` | Recent HTTP requests, filterable by method / status / path / min duration |
| `get_request` | Full detail of one request by `traceId`: headers, body, timeline |
| `find_n1_queries` | Requests with N+1 / duplicate-query bursts, with the repeated SQL and count |
| `list_slow_queries` | Individual slow DB queries, slowest first, with route + `traceId` |
| `get_recent_logs` | Recent logs, filterable by severity / text / `traceId` |

## Example

> **You:** `GET /posts` feels slow. What's going on?
>
> **Agent** (calls `find_n1_queries`): NodeLens shows `GET /posts` fires the same
> `SELECT name FROM authors WHERE id = $1` **8 times** and
> `SELECT count(*) FROM comments WHERE post_id = $1` **8 times** in one request
> (both `suspectedNPlusOne`). That's a double N+1, so batch the authors with
> `WHERE id = ANY($1)` and fetch the counts in one grouped query.

The agent found and explained a real runtime problem without you copy-pasting
logs or traces.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `spawn npx ENOENT` / `command not found` in the extension only | GUI app didn't inherit your shell `PATH` | Launch from the integrated terminal, or use the `bin/nls-mcp.sh` wrapper / absolute paths |
| Tools always report "not running" | No `nls monitor` session, or config points at the wrong project | Start a monitor session; check the server's cwd / `--cwd` resolves to the dir holding `.node-lens/` |
| Server never appears in the client | `.mcp.json` not at project root, or approval declined | Move it to the root; re-approve the server on next load |
| Wrong data or wrong Node behavior | Server ran under a different Node than the app | Run both under the same version (`.nvmrc`); the wrapper's `nvm use` handles it |
