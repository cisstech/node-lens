import type { NestProviderInfo } from '../types'

/**
 * Classify a NestJS provider based on its prototype methods
 * @param providerRef - The NestJS provider reference
 * @returns The provider type classification
 */
export function classifyNestProvider(providerRef: any): NestProviderInfo['type'] {
  const proto = providerRef.metatype?.prototype
  if (!proto) return 'value'

  // Check for specific NestJS interfaces
  if (typeof proto.canActivate === 'function') return 'guard'
  if (typeof proto.intercept === 'function') return 'interceptor'
  if (typeof proto.transform === 'function') return 'pipe'
  if (typeof proto.use === 'function') return 'middleware'

  // Check if it's a factory function
  if (typeof providerRef.provide === 'function' || providerRef.useFactory) {
    return 'factory'
  }

  // Default to service for classes
  return 'service'
}

/**
 * Extract method names from a provider prototype
 * @param proto - The provider prototype
 * @returns Array of method names (excluding constructor and inherited methods)
 */
export function extractProviderMethods(proto: any): string[] {
  if (!proto) return []

  const methods: string[] = []
  const methodNames = Object.getOwnPropertyNames(proto)

  for (const methodName of methodNames) {
    // Skip constructor and common inherited methods
    if (methodName === 'constructor') continue
    if (methodName.startsWith('_')) continue // Skip private methods
    
    const descriptor = Object.getOwnPropertyDescriptor(proto, methodName)
    if (descriptor && typeof descriptor.value === 'function') {
      methods.push(methodName)
    }
  }

  return methods.sort()
}