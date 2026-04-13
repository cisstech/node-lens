# @cisstech/node-lens-introspection

For NestJS apps: surfaces the module graph, providers, and routes (plus OpenAPI
and GraphQL endpoints) so you can explore an app's structure from the dashboard.
It detects the framework and only appears when you're running NestJS.

It can also trace provider methods on demand, either with the exported `@Trace`
decorator or automatically via `autoTrace`.

See the [feature tour](../../docs/introspection/features.md) for the tabs and
tracing options.

## Configure

```javascript
const { IntrospectionPlugin } = require('@cisstech/node-lens-introspection')

new IntrospectionPlugin({ autoTrace: { enabled: true } })
```

| Option | Default | Purpose |
|--------|---------|---------|
| `autoTrace` | `{ enabled: false }` | Auto-trace provider methods, with glob include/exclude for providers and methods. |
| `graphqlEndpoints` | none | GraphQL paths to inspect, for apps that don't expose them through Nest. |
