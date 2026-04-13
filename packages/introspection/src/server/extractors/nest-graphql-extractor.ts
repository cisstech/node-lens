import type { AppInfo } from '@cisstech/node-lens-server'
import type { RouteInfo, RouteMethod } from '../types'
import { NestApplication, ProviderRef } from './nest-types'

/**
 * Extract GraphQL operations (resolvers) as RouteInfo entries.
 * KISS approach: best-effort detection of @Resolver classes and @Query/@Mutation methods.
 */
export function extractGraphQLResolvers(appInfo: AppInfo, graphqlEndpoints: string[] = []): RouteInfo[] {
  const routes: RouteInfo[] = []
  const endpoint = graphqlEndpoints[0] || '/graphql'

  try {
    const nestApp = appInfo.nestApp as unknown as NestApplication | undefined
    const modules = nestApp?.container?.modules
    if (!modules) return routes

    for (const [, moduleRef] of modules.entries()) {
      for (const [, providerRef] of moduleRef.providers) {
        const resolverRoutes = extractFromProvider(providerRef, moduleRef.name || moduleRef.metatype?.name || String(moduleRef.token), endpoint)
        routes.push(...resolverRoutes)
      }
    }
  } catch (err) {
    console.warn('[IntrospectionPlugin] Error extracting GraphQL resolvers:', err)
  }

  return routes
}

function extractFromProvider(providerRef: ProviderRef, moduleName: string, endpoint: string): RouteInfo[] {
  const out: RouteInfo[] = []
  const instance = providerRef.instance
  const proto = providerRef.metatype?.prototype as Record<string, unknown> | undefined
  if (!instance || !proto) return out

  // Heuristic: consider any provider that has at least one method marked as Query/Mutation
  const descriptors = Object.getOwnPropertyDescriptors(proto)
  const methodEntries = Object.entries(descriptors).filter(([n, d]) => n !== 'constructor' && typeof d.value === 'function')

  for (const [name, desc] of methodEntries) {
    const fn = desc.value
    // Determine GraphQL operation type via metadata
    const opType = getGraphQLOperationType(fn)
    if (!opType) continue
    const method: RouteMethod = opType

    const controllerName = providerRef.metatype?.name || (instance as { constructor?: { name?: string } })?.constructor?.name || String(providerRef.token)
    out.push({
      method,
      path: endpoint,
      controller: controllerName,
      handler: name,
      module: moduleName,
      isGraphql: true,
    })
  }

  return out
}

function getGraphQLOperationType(target: unknown): 'query' | 'mutation' | undefined {
  const typeMeta = getFirstMetadata(target, [
    'graphql:resolver_type',
    'RESOLVER_TYPE_METADATA',
    // legacy/fallback keys if any
    'graphql:query',
    'graphql:mutation',
  ])

  if (typeof typeMeta === 'string') {
    const v = typeMeta.toLowerCase()
    if (v === 'query' || v === 'mutation') return v
    // Some decorators might store boolean flags under specific keys
    if (typeMeta === 'graphql:query') return 'query'
    if (typeMeta === 'graphql:mutation') return 'mutation'
  }

  // Try boolean presence flags
  if (hasMetadata(target, 'graphql:query')) return 'query'
  if (hasMetadata(target, 'graphql:mutation')) return 'mutation'

  return undefined
}

function getFirstMetadata(target: unknown, keys: string[]): unknown {
  for (const k of keys) {
    const v = getMetadata(target, k)
    if (v !== undefined) return v
  }
  return undefined
}

function hasMetadata(target: unknown, key: string): boolean {
  return getMetadata(target, key) !== undefined
}

function getMetadata(target: unknown, key: string): unknown {
  try {
    // Using reflect-metadata if available in Nest app context
    type ReflectWithMetadata = typeof Reflect & { getMetadata?: (k: string, t: unknown) => unknown }
    const R = Reflect as ReflectWithMetadata
    return typeof R.getMetadata === 'function' ? R.getMetadata(key, target) : undefined
  } catch {
    return undefined
  }
}
