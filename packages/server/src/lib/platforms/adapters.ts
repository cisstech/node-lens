import type * as express from 'express'
import type * as fastify from 'fastify'
import { ServerResponse } from 'http'

export type RequestHandler = (req: express.Request | fastify.FastifyRequest, res: express.Response | fastify.FastifyReply) => void | Promise<void>

export interface PlatformAdapter {
  mountStatic(basePath: string, distPath: string): void
  get(path: string, handler: RequestHandler): void
  delete(path: string, handler: RequestHandler): void
  post(path: string, handler: RequestHandler): void
  put(path: string, handler: RequestHandler): void
  patch(path: string, handler: RequestHandler): void
  head(path: string, handler: RequestHandler): void
  options(path: string, handler: RequestHandler): void
  mountRedirect(fromPath: string, toPath: string): void
  addCorsMiddleware(pathPrefix: string): void
}

export class ExpressPlatformAdapter implements PlatformAdapter {
  constructor(private app: express.Application) { }

  mountStatic(basePath: string, distPath: string): void {
    const express = require('express')
    if (express) {
      this.app.use(basePath, express.static(distPath))
    }
  }

  get(path: string, handler: RequestHandler): void {
    this.app.get(path, handler as express.RequestHandler)
  }

  delete(path: string, handler: RequestHandler): void {
    this.app.delete(path, handler as express.RequestHandler)
  }

  post(path: string, handler: RequestHandler): void {
    this.app.post(path, handler as express.RequestHandler)
  }

  put(path: string, handler: RequestHandler): void {
    this.app.put(path, handler as express.RequestHandler)
  }

  patch(path: string, handler: RequestHandler): void {
    this.app.patch(path, handler as express.RequestHandler)
  }

  head(path: string, handler: RequestHandler): void {
    this.app.head(path, handler as express.RequestHandler)
  }

  options(path: string, handler: RequestHandler): void {
    this.app.options(path, handler as express.RequestHandler)
  }

  mountRedirect(fromPath: string, toPath: string): void {
    this.app.get(fromPath, (req: express.Request, res: express.Response) => {
      res.redirect(301, toPath)
    })
  }

  addCorsMiddleware(pathPrefix: string): void {
    this.app.use((req, res, next) => {
      if (!req.url.startsWith(pathPrefix)) return next()

      this.setCorsHeaders(res)

      if (req.method === 'OPTIONS') {
        return res.status(204).end()
      }

      next()
    })
  }

  private setCorsHeaders(res: ServerResponse): void {
    try {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader(
        "Access-Control-Allow-Methods",
        "POST, GET, PUT, DELETE, OPTIONS"
      );
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept, Authorization"
      );
    } catch {
      // ignore
    }
  }
}

export class FastifyPlatformAdapter implements PlatformAdapter {
  constructor(private app: fastify.FastifyInstance) { }

  mountStatic(basePath: string, distPath: string): void {
    const fastifyStatic = require('@fastify/static')
    if (fastifyStatic) {
      this.app.register(fastifyStatic, {
        root: distPath,
        prefix: basePath + '/',
        decorateReply: false
      })
    }
  }

  get(path: string, handler: RequestHandler): void {
    this.app.get(path, async (request: fastify.FastifyRequest, reply: fastify.FastifyReply) => {
      await handler(request, reply)
    })
  }
  delete(path: string, handler: RequestHandler): void {
    this.app.delete(path, async (request: fastify.FastifyRequest, reply: fastify.FastifyReply) => {
      await handler(request, reply)
    })
  }
  post(path: string, handler: RequestHandler): void {
    this.app.post(path, async (request: fastify.FastifyRequest, reply: fastify.FastifyReply) => {
      await handler(request, reply)
    })
  }
  put(path: string, handler: RequestHandler): void {
    this.app.put(path, async (request: fastify.FastifyRequest, reply: fastify.FastifyReply) => {
      await handler(request, reply)
    })
  }
  patch(path: string, handler: RequestHandler): void {
    this.app.patch(path, async (request: fastify.FastifyRequest, reply: fastify.FastifyReply) => {
      await handler(request, reply)
    })
  }
  head(path: string, handler: RequestHandler): void {
    this.app.head(path, async (request: fastify.FastifyRequest, reply: fastify.FastifyReply) => {
      await handler(request, reply)
    })
  }
  options(path: string, handler: RequestHandler): void {
    this.app.options(path, async (request: fastify.FastifyRequest, reply: fastify.FastifyReply) => {
      await handler(request, reply)
    })
  }

  mountRedirect(fromPath: string, toPath: string): void {
    this.app.get(fromPath, (request: fastify.FastifyRequest, reply: fastify.FastifyReply) => {
      reply.redirect(toPath, 301)
    })
  }

  addCorsMiddleware(pathPrefix: string): void {
    this.app.addHook('onRequest', (req, reply, done) => {
      if (!req.raw?.url?.startsWith(pathPrefix)) return done()

      this.setCorsHeaders(reply.raw)

      if (req.raw.method === 'OPTIONS') {
        reply.status(204).send()
        return
      }

      done()
    })
  }

  private setCorsHeaders(res: ServerResponse): void {
    try {
      res.setHeader?.('Access-Control-Allow-Origin', '*')
      res.setHeader?.('Access-Control-Allow-Methods', 'GET, OPTIONS')
      res.setHeader?.('Access-Control-Allow-Headers', 'Content-Type, Accept, Range')
    } catch {
      // ignore
    }
  }
}
