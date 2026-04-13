import { AppInfo, joinUrlSegments } from '@cisstech/node-lens-server';
import type { RouteInfo } from '../types';
import { ControllerRef, METHOD_METADATA, NestApplication, PATH_METADATA, RequestMethod } from './nest-types';

/**
 * Extract routes from the application (supports NestJS, Express, Fastify)
 * @param appInfo - The running application detected by Node Lens
 * @returns Array of route information
 */
export function extractRoutes(appInfo: AppInfo): RouteInfo[] {
  switch (appInfo.framework) {
    case 'nestjs':
      return extractNestJsRoutes(appInfo)
    case 'express':
      return extractExpressRoutes(appInfo)
    case 'fastify':
      return extractFastifyRoutes(appInfo)
    default:
      return []
  }
}

/**
 * Extract routes from NestJS application
 */
function extractNestJsRoutes(appInfo: AppInfo): RouteInfo[] {
  const routes: RouteInfo[] = []

  if (!appInfo.nestApp) {
    return routes
  }

  try {
    const nestApp = appInfo.nestApp as unknown as NestApplication
    const modulesContainer = nestApp.container?.modules

    if (!modulesContainer) {
      return routes
    }

    for (const [, moduleRef] of modulesContainer.entries()) {
      if (moduleRef.name === 'InternalCoreModule') continue

      for (const [, controllerRef] of moduleRef.controllers) {
        const controllerRoutes = extractRoutesFromNestController(controllerRef, moduleRef.name)
        routes.push(...controllerRoutes)
      }
    }
  } catch (error) {
    console.warn('[IntrospectionPlugin] Error extracting NestJS routes:', error)
  }

  return routes
}

/**
 * Extract routes from a NestJS controller
 */
function extractRoutesFromNestController(controllerRef: ControllerRef, moduleName: string): RouteInfo[] {
  const routes: RouteInfo[] = []
  const proto = controllerRef.metatype?.prototype
  const instance = controllerRef.instance

  if (!instance || !proto) {
    return routes
  }

  try {
    // Get base path from @Controller()
    const controllerPath: string = Reflect.getMetadata(PATH_METADATA, instance.constructor) || ''
    const controllerName = instance.constructor.name

    // Get all method names from the controller
    const methodNames = Object.getOwnPropertyNames(proto).filter(name =>
      name !== 'constructor' && typeof proto[name] === 'function'
    )

    for (const methodName of methodNames) {
      const methodPath = Reflect.getMetadata(PATH_METADATA, proto[methodName] as object)
      const httpMethod = Reflect.getMetadata(METHOD_METADATA, proto[methodName] as object)

      if (httpMethod !== undefined && methodPath !== undefined) {
        const fullPath = joinUrlSegments(controllerPath, methodPath)

        const httpMethods: Record<number, string> = {
          [RequestMethod.GET]: 'GET',
          [RequestMethod.POST]: 'POST',
          [RequestMethod.PUT]: 'PUT',
          [RequestMethod.DELETE]: 'DELETE',
          [RequestMethod.PATCH]: 'PATCH',
          [RequestMethod.ALL]: 'ALL',
          [RequestMethod.OPTIONS]: 'OPTIONS',
          [RequestMethod.HEAD]: 'HEAD',
        };

        routes.push({
          method: (httpMethods[httpMethod] || 'ALL') as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD' | 'ALL',
          path: fullPath,
          controller: controllerName,
          handler: methodName,
          module: moduleName
        })
      }
    }
  } catch (error) {
    console.warn(`[IntrospectionPlugin] Error extracting routes from controller:`, error)
  }

  return routes
}

/**
 * Extract routes from Express application
 */
function extractExpressRoutes(appInfo: AppInfo): RouteInfo[] {
  const routes: RouteInfo[] = []

  type ExpressLayer = { route?: { path: string; methods: Record<string, boolean> }; name?: string; regexp?: RegExp; handle?: { stack: unknown[] } }
  type ExpressRouter = { stack: ExpressLayer[] }

  const platformApp = appInfo.platformApp as { _router?: ExpressRouter, router?: ExpressRouter }

  const router = platformApp.router || platformApp._router;
  if (!router?.stack) {
    return routes
  }

  try {
    for (const layer of router.stack) {
      if (layer.route) {
        // Direct route
        const path = layer.route.path
        for (const method of Object.keys(layer.route.methods)) {
          routes.push({
            method: method.toUpperCase() as RouteInfo['method'],
            path,
            controller: '',
            handler: '',
            module: ''
          })
        }
      } else if (layer.name === 'router' && layer.handle?.stack) {
        // Nested router
        const basePath = extractExpressBasePath(layer.regexp || /^\//)

        for (const nestedLayer of layer.handle.stack as Array<{ route?: { path: string; methods: Record<string, boolean> } }>) {
          if (nestedLayer.route) {
            const fullPath = joinUrlSegments(basePath, nestedLayer.route.path)
            for (const method of Object.keys(nestedLayer.route.methods)) {
              routes.push({
                method: method.toUpperCase() as RouteInfo['method'],
                path: fullPath,
                controller: '',
                handler: '',
                module: ''
              })
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn('[IntrospectionPlugin] Error extracting Express routes:', error)
  }

  return routes
}

/**
 * Extract routes from Fastify application
 */
function extractFastifyRoutes(appInfo: AppInfo): RouteInfo[] {
  const routes: RouteInfo[] = []
  const platformApp = appInfo.platformApp as { printRoutes?: (options: { commonPrefix: boolean }) => string }

  if (typeof platformApp?.printRoutes !== 'function') {
    return routes
  }

  try {
    const routesText = platformApp.printRoutes({ commonPrefix: false })
    const lines = routesText.split('\n').map((l: string) => l.trim()).filter(Boolean)

    for (const line of lines) {
      // Parse Fastify route output format: "METHOD /path"
      const match = line.match(/^(\w+)\s+(.+)$/)
      if (match) {
        const [, method, path] = match
        routes.push({
          method: method.toUpperCase() as RouteInfo['method'],
          path,
          controller: '',
          handler: '',
          module: ''
        })
      }
    }
  } catch (error) {
    console.warn('[IntrospectionPlugin] Error extracting Fastify routes:', error)
  }

  return routes
}

/**
 * Extract base path from Express router regex
 */
function extractExpressBasePath(regex: RegExp): string {
  return regex.source
    .replace(/\\\//g, '/')
    .replace(/\$.*/, '')
    .replace(/^\^/, '')
    .replace(/\?.*/, '')
}
