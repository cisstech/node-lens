import type * as express from 'express'
import type * as fastify from 'fastify'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isExpress = (app: any): app is express.Application => {
  return app && typeof app.use === 'function' && typeof app.get === 'function' && !app.addHook
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isFastify = (app: any): app is fastify.FastifyInstance => {
  return app && typeof app.addHook === 'function' && typeof app.register === 'function'
}
