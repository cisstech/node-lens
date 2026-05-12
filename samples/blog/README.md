# Blog sample

A small, deliberately imperfect blog API (Express + PostgreSQL). It works, but it
has the problems you'd actually hunt for in a real app, so NodeLens and the
[`nls mcp`](../../docs/MCP.md) tools have something real to find:

| Endpoint | What it demonstrates |
|----------|----------------------|
| `GET /posts` | **Double N+1**: one author lookup and one comment-count query per post |
| `GET /posts/:id` | N+1 on comment authors; `404` when missing |
| `POST /posts` | Validation → `400`; success → `201` |
| `GET /search?q=` | A slow endpoint (`pg_sleep` + unindexed `ILIKE`) |
| `GET /stats` | A heavier aggregation query |
| `GET /authors/:id` | A well-written endpoint (single query) for contrast |
| `GET /boom` | Always throws → `500` + error log |

## Run it

```bash
docker compose up -d postgres                                   # from the repo root
node packages/cli/bin/nls.js monitor --mode backend node samples/blog/index.js
node samples/blog/traffic.mjs                                   # in another terminal
```

Then open the dashboard URL the CLI printed, or point an AI agent at the data;
see [docs/MCP.md](../../docs/MCP.md). To smoke-test the MCP server directly:

```bash
node samples/blog/mcp-smoke.mjs
```

It uses the same `nodelens_todo` database as the other samples and creates its
own `authors` / `posts` / `comments` tables on first run.
