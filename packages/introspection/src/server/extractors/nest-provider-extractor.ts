import { AppInfo } from '@cisstech/node-lens-server'
import { getTraceMetadata, hasTraceMetadata } from '../decorators'
import type { AutoTraceOptions, NestProviderInfo } from '../types'
import { shouldTraceMethod, shouldTraceProvider, traceMethod } from '../utils'
import { classifyNestProvider, extractProviderMethods } from '../utils/provider-classifier'
import { ModuleRef, NestApplication, ProviderRef } from './nest-types'


/**
 * Extract NestJS providers information from all modules
 * @param appInfo - The running application detected by Node Lens
 * @returns Array of provider information
 */
export function extractNestProviders(appInfo: AppInfo, autoTraceOptions?: AutoTraceOptions): NestProviderInfo[] {
  const nestApp = appInfo.nestApp as NestApplication | undefined
  if (!nestApp?.container?.modules) {
    return []
  }

  const providers: NestProviderInfo[] = []
  const modulesContainer = nestApp.container.modules

  try {
    for (const [, moduleRef] of modulesContainer.entries()) {
      for (const [, providerRef] of moduleRef.providers) {
        const provider = buildProviderInfo(providerRef)
        if (provider) {
          providers.push(provider)
          traceMethodCalls(provider, moduleRef, providerRef, autoTraceOptions)
        }
      }

    }
  } catch (error) {
    console.warn('[IntrospectionPlugin] Error extracting NestJS providers:', error)
  }

  return providers
}

/**
 * Create a lookup map of providers by token
 * @param nestApp - The NestJS application instance
 * @returns Map of provider tokens to provider info
 */
export function createProviderLookupMap(appInfo: AppInfo): Map<unknown, { id: string; name: string }> {
  const nestApp = appInfo.nestApp as NestApplication | undefined
  const providersMap = new Map<unknown, { id: string; name: string }>()
  if (!nestApp?.container?.modules) {
    return providersMap
  }

  try {
    for (const [, moduleRef] of nestApp.container.modules.entries()) {
      for (const [, providerRef] of moduleRef.providers) {
        const providerName = providerRef.name || providerRef.metatype?.name || String(providerRef.token)
        providersMap.set(providerRef.token, {
          id: providerRef.id,
          name: providerName
        })
      }
    }
  } catch (error) {
    console.warn('[IntrospectionPlugin] Error creating provider lookup map:', error)
  }

  return providersMap
}


/**
 * Build provider information from a provider reference
 * @param providerRef - The NestJS provider reference
 * @returns Provider information object or null if invalid
 */
function buildProviderInfo(providerRef: ProviderRef): NestProviderInfo | null {
  const proto = providerRef.metatype?.prototype
  const instance = providerRef.instance

  if (!proto || !instance) {
    return null
  }

  const providerName = providerRef.name || providerRef.metatype?.name || String(providerRef.token)
  const providerType = classifyNestProvider(providerRef)
  const methods = extractProviderMethods(proto)

  return {
    id: providerRef.id,
    name: providerName,
    type: providerType,
    methods
  }
}

function traceMethodCalls(
  provider: NestProviderInfo,
  moduleRef: ModuleRef,
  providerRef: ProviderRef,
  options?: AutoTraceOptions
): void {
  const instance = providerRef.instance
  const proto = providerRef.metatype?.prototype
  if (!instance || !proto) {
    return
  }

  const canTraceProvider = shouldTraceProvider(provider.name, provider.type, options);
  provider.methods.forEach(method => {
    // Check if method has @Trace decorator - if so, it takes precedence over global disabling
    const hasDecorator = hasTraceMetadata(proto, method);
    const shouldTrace = hasDecorator || (canTraceProvider && shouldTraceMethod(method, options))
    if (!shouldTrace) return

    const decoratorMetadata = hasDecorator ? getTraceMetadata(proto, method) : {};
    traceMethod(proto, method, {
      spanName: decoratorMetadata.spanName,
      attributes: {
        'nestjs.module': moduleRef.name || moduleRef.metatype?.name || String(moduleRef.token),
        'nestjs.provider': provider.name,
        'nestjs.method': method,
        'nestjs.provider.type': provider.type,
        'nestjs.traced.via': hasDecorator ? 'decorator' : 'config',
        ...decoratorMetadata.attributes
      },
    });
  })

}
