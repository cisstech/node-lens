# Database plugin features

A tour of what the Database plugin gives you. Configuration options are in the
[package README](../../packages/database/README.md).

## Traces

Queries are grouped under the request (or background task) that ran them. Each
trace card shows the route, total duration, how many queries ran and how many
were unique, and badges for duplicate/N+1, slow, and error counts. Traces with
problems get a red edge so they stand out.

- **Filter tabs**: All, Errors, Slow, N+1, HTTP, Background.
- **Search** across route, method, statement, resource, operation, and engine.
- **Advanced filters** (toggle): database engine, duration range, query type,
  time range, and a resource filter, with a live "N of M traces" count.
- **Clear traces** and infinite scroll; new traces stream in live.

## Trace detail

Open a trace to see:

- A **timeline in request**: where each query landed within the request, and the
  window the database work spanned.
- The **queries** it ran, each with its engine, operation, resource, duration
  (slow ones highlighted), statement and parameters, connection metadata, any
  error with its stack trace, and the call stack that led to it.
- **Warnings** and **duplicate groups**: the repeated statement, how many times
  it ran, the total time it cost, and whether it looks like an N+1.

Per-query actions include copy (SQL, query, or command depending on the engine),
copy with parameters, and, for PostgreSQL and MySQL, **Explain** to run the
query plan inline.

## N+1 and slow detection

- A query's signature is its operation, resource, and parameterized statement
  (bind placeholders unified), so repeated executions of the same prepared
  statement group together.
- A **duplicate group** forms when the same signature runs at least
  `duplicateBurstThreshold` times (default 5) in one trace.
- It is flagged as a **suspected N+1** when that burst is a `SELECT`: looping
  over varying parameters is the classic case, and a burst of identical reads is
  flagged too.
- A query is **slow** when it runs at or above `slowQueryMs` (default 80 ms).

## Query playground

Run ad-hoc queries against your configured connections.

- Pick a connection (the list comes from the `connections` you configured).
- Write the query in an editor that switches to SQL or JSON for the engine, with
  Cmd/Ctrl+Enter to run. A banner warns on destructive statements
  (DROP/DELETE/TRUNCATE).
- Results show as a table with row count and timing, exportable as **CSV** or
  **JSON**.
- **Templates** give per-engine starter queries, and the last 10 queries are
  kept in history to rerun.

## Supported engines

Queries are captured and shown for **PostgreSQL, MySQL, MongoDB, and Redis**. The
query playground runs against all four; `EXPLAIN` is available for PostgreSQL and
MySQL.
