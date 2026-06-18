# Introspection plugin features

A tour of what the Introspection plugin gives you. See the
[package README](../../packages/introspection/README.md).

This plugin is for **NestJS** apps. It detects the framework and only appears in
the dashboard when the app is running NestJS.

## Exploring the app

Three tabs, with a Refresh button to reload them:

- **Modules**: each module with its global flag, imports, providers,
  controllers, and exports.
- **Providers**: each provider grouped by kind (service, guard, interceptor,
  pipe, and so on) with its methods.
- **Routes**: every route with its method, path, `controller.handler`, and
  module. GraphQL resolvers appear as `query` and `mutation` routes, and route
  versioning is surfaced so the request playground can build versioned URLs.

## Tracing provider methods

Beyond the structure view, the plugin can wrap provider methods in spans so they
show up in request timelines.

### The `@Trace` decorator

Mark a method to always trace it:

```ts
import { Trace } from '@cisstech/node-lens-introspection'

class UserService {
  @Trace()
  findAll() { /* ... */ }
}
```

The span is named `ClassName.method` by default and records exceptions.
`@Trace` works whether or not automatic tracing is enabled.

### Automatic tracing

With `autoTrace.enabled`, the plugin wraps provider methods that pass the
include/exclude globs, without touching your code:

```js
new IntrospectionPlugin({
  autoTrace: {
    enabled: true,
    providerTypes: ['service'],
    excludeProviders: ['*Logger*', '*Config*'],
    excludeMethods: ['get*', 'set*'],
  },
})
```

Defaults trace `service` providers, skip logger/config/module/guard/interceptor
providers, and skip getters, setters, and lifecycle helpers. See the
[package README](../../packages/introspection/README.md) for every option.
