# @cisstech/node-lens-logging

Captures your app's logs and ties each one back to the request that produced it,
so you can read logs in the context of a trace instead of a flat stream. Shows
them live in the dashboard as a table or a timeline, filterable by severity and
text.

Captures `console`, Pino, and NestJS logger output. See the
[feature tour](../../docs/logging/features.md) for the views and filters. No
configuration:

```javascript
const { LoggingPlugin } = require('@cisstech/node-lens-logging')

new LoggingPlugin()
```
