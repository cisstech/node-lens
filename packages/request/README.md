# @cisstech/node-lens-request

Captures every HTTP request your app handles and shows it as an interactive
timeline in the dashboard: the middleware and downstream calls it made, its
headers and body, status, and duration. You can replay a request or copy it as
cURL, and a built-in playground lets you explore your routes and send requests.

Instruments HTTP, Express, Fastify, NestJS, and GraphQL.

For everything it does (live view, timeline, and the Postman-style playground
with variables and collections), see the
[feature tour](../../docs/request/features.md).

## Configure

```javascript
const { RequestPlugin } = require('@cisstech/node-lens-request')

new RequestPlugin({ captureBody: true, includeHeaders: true })
```

| Option | Default | Purpose |
|--------|---------|---------|
| `includeHeaders` | `true` | Capture request/response headers. |
| `captureBody` | `true` | Capture request/response bodies (truncated at `maxBodySize`). |
| `maxBodySize` | `1048576` | Max body bytes to keep, per message. |
| `variablesFile` | none | Path to variables the request playground can substitute. |
| `collectionsDir` | none | Directory of saved request collections for the playground. |
