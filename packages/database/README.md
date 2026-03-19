# @cisstech/node-lens-database

Captures your app's database queries, groups them under the request that
triggered them, and flags the two problems you can't see from the code: N+1
bursts and slow queries. Works with PostgreSQL, MySQL, MongoDB, and Redis.

In the dashboard you get, per request: the queries it ran, how many were
duplicates, which were slow, and the SQL for each. A query playground lets you
run ad-hoc queries and `EXPLAIN` against your configured connections.

For the full tour (traces, N+1 detection, playground), see the
[feature tour](../../docs/database/features.md).

## Configure

```javascript
const { DatabasePlugin } = require('@cisstech/node-lens-database')

new DatabasePlugin({
  slowQueryMs: 80,
  connections: {
    postgresql: {
      main: { host: 'localhost', port: 5432, user: 'user', password: 'password' },
    },
  },
})
```

| Option | Default | Purpose |
|--------|---------|---------|
| `slowQueryMs` | `80` | Duration above which a query is marked slow. |
| `duplicateBurstThreshold` | `5` | How many identical queries in one request trigger an N+1 flag. |
| `redactParams` | `false` | Hide bind parameters (also disables value inlining). |
| `connections` | none | Per-engine connections (`postgresql`, `mysql`, `mongodb`, `redis`), each a map of name → `{ host, port, user, password, options }`. Needed for the query playground and `EXPLAIN`. |

Query capture works without `connections`; they're only required for the
playground and `EXPLAIN`, which open their own connection.
