# NodeLens MCP server: runtime data for AI agents

Your AI coding agent reads your **source code**, but it can't see what the app
actually does at runtime: which requests fire, how many DB queries each one
triggers, which are slow, what got logged. `nls mcp` closes that gap. It runs a
[Model Context Protocol](https://modelcontextprotocol.io) server (stdio) that
exposes the current NodeLens session's captured data as read-only tools, so an
agent like Claude Code or Cursor can ask *"is this endpoint doing an N+1?"* and
get a precise, grounded answer instead of guessing from the code.

Everything stays local: the MCP server reads `.node-lens/.info.json` for the
running session's origin and token, then queries the same token-gated history
API the dashboard uses. No data leaves your machine.

## Try it in 60 seconds

From a clone of this repo (the [blog sample](../samples/blog/) is built to
produce interesting traces):

```bash
# 1. start the database and the monitored app
docker compose up -d postgres
node packages/cli/bin/nls.js monitor --mode backend node samples/blog/index.js

# 2. in a second terminal, generate traffic and smoke-test the MCP tools
node samples/blog/traffic.mjs
node samples/blog/mcp-smoke.mjs
```

`mcp-smoke.mjs` spawns `nls mcp`, performs the JSON-RPC handshake, and prints
the result of every tool, so you can confirm the server works **without wiring
up an agent first**. You should see `find_n1_queries` flag `GET /posts`,
`list_slow_queries` flag `GET /search`, and an `ERROR` log for `GET /boom`.

## Connect an AI agent

Point your agent's MCP config at `nls mcp`. The server searches upward from its
working directory for `.node-lens/.info.json`, so it finds the session as long
as the working directory is inside your project; pass `--cwd` to be explicit.

**Claude Code**: add to `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "nodelens": { "command": "nls", "args": ["mcp"] }
  }
}
```

Use `"command": "nls"` when the CLI is installed globally
(`npm i -g @cisstech/node-lens-cli`). Working from a clone of this repo instead?
Point at the local binary and pass the project directory:

```json
{
  "mcpServers": {
    "nodelens": {
      "command": "node",
      "args": ["packages/cli/bin/nls.js", "mcp", "--cwd", "."]
    }
  }
}
```

The tools return "not running" until a `nls monitor` session exists, then pick
it up automatically, so you can leave the agent connected across restarts.

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
