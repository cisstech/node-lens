# Request plugin features

A tour of what the Request plugin gives you. Configuration options are in the
[package README](../../packages/request/README.md).

## Live requests

Every HTTP request your app handles shows up in a live list (newest first), with
method, path, duration, status, and time. NodeLens skips its own dashboard
traffic so it doesn't pollute the view.

- **Filter** by method, status class (2xx/3xx/4xx/5xx), and duration, plus a
  free-text search over path and method. Filters persist across reloads.
- **Sort** by clicking any column header (method, path, duration, status, time).
- **Highlighting**: 5xx rows are marked as errors, 4xx as warnings, and requests
  over 500 ms as slow.
- **Clear** removes the captured requests.

## Request detail

Expand a request to see its URL, trace id, sizes, and timing, with four tabs:

- **Timeline**: the operation tree for the request (middleware, database calls,
  outgoing HTTP, and more), described below.
- **Headers**: request and response headers, each value copyable.
- **Query**: parsed query parameters.
- **Body**: request and response bodies, pretty-printed for JSON.

Three actions sit above the tabs:

- **Replay** opens the request in the Playground and re-sends it.
- **Copy as cURL** copies a ready-to-run cURL command.
- **Export trace as JSON** downloads the full captured event.

## Timeline

The timeline draws the span tree as horizontal bars on a time axis, colored by
type (middleware, database, HTTP, cache, GraphQL, error, other) with a legend
you can click to hide a type.

- Operations over 100 ms are highlighted as bottlenecks.
- **Collapse/expand** any node, or all at once; very short operations
  auto-collapse.
- **Compact view** and **hide operations under 1 ms** reduce noise.
- **Focus** isolates a subtree and rescales the axis; reset to zoom back out.
- **Search operations** by name, keeping matching subtrees.
- **Hover** a bar for a popover of timing, attributes, and events; pin it to keep
  it open. Spans that threw show the exception message and stack trace.
- Keyboard shortcuts: Shift+C collapse/expand all, H compact, F duration filter;
  when a popover is pinned, arrow keys move between operations.

## Playground

A Postman-style panel for exercising your own routes, split between a route
explorer and a request editor.

### Route explorer

Routes are discovered automatically from your app (via the Introspection
plugin's route data). NodeLens detects whether the app is NestJS or Express and
groups accordingly (module then controller for Nest, path prefix otherwise). You
can search by free text or with field filters like `method:`, `module:`,
`controller:`, and `handler:`. GraphQL endpoints, when present, are introspected
and listed as `query` and `mutation` entries.

### Request editor

Pick a method and URL, then send. Headers and query parameters are edited as
key/value rows, and the body supports JSON, form-urlencoded, multipart form
data, and GraphQL (query plus variables), with the `Content-Type` managed for
you. Selecting a route prefills the method, URL, and version headers; GraphQL
routes build a typed query template from the schema.

When you send a request to your own app, NodeLens matches it to the trace it
just captured and shows that request's full timeline inline, so you can send and
inspect in one place.

### Variables

Variables let you parameterize requests with `{{name}}` placeholders in the URL,
headers, query, and body, resolved on each send. They are loaded from the file
you point `variablesFile` at, and come in two kinds:

- **text**: a literal value substituted as-is.
- **function**: a JavaScript expression evaluated on every send, for dynamic
  values (timestamps, tokens, random ids). This runs locally in your dev tool,
  so treat it as a local-only convenience.

### Collections

Collections are saved requests grouped by name, loaded from the directory you
point `collectionsDir` at. Click one to load it into the editor. Each saved
request carries its method, URL, headers, query, body, and GraphQL settings, the
same shape a request uses.

### History

Every send is saved to a per-browser history (last 50). Apply one to restore the
full request state, or clear the list.

> Variables and collections are read-only in the dashboard: they come from the
> server files above. Editing or saving them from the UI is not supported yet.
