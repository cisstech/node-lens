const { RequestPlugin } = require('@cisstech/node-lens-request')
const { DatabasePlugin } = require('@cisstech/node-lens-database')
const { LoggingPlugin } = require('@cisstech/node-lens-logging')
const { IntrospectionPlugin } = require('@cisstech/node-lens-introspection')
const { createNodeLens } = require('@cisstech/node-lens-server')

module.exports = createNodeLens({
  metricCollectionInterval: 60_000,
  plugins: [
    new RequestPlugin({
      captureBody: true,
      includeHeaders: true,
    }),
    new DatabasePlugin({
      connections: {
        postgresql: {
          nodelens_todo: {
            host: 'localhost',
            port: 5432,
            user: 'user',
            password: 'password',
            options: {
              ssl: false,
              connectionTimeoutMillis: 5000,
            },
          },
        },
        mongodb: {
          nodelens_todo: {
            host: 'localhost',
            port: 27017,
            user: 'user',
            password: 'password',
            database: 'nodelens_todo',
            options: {
              connectTimeoutMS: 5000,
            },
          },
        },
        redis: {
          nodelens_todo: {
            host: 'localhost',
            port: 6379,
            password: 'password',
          },
        },
      },
    }),
    new LoggingPlugin(),
    // NestJS-only; hides itself automatically on other frameworks.
    new IntrospectionPlugin(),
  ],
})
