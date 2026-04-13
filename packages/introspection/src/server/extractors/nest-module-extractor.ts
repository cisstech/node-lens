import { AppInfo } from '@cisstech/node-lens-server'
import type { NestModuleInfo } from '../types'
import { ModuleRef, NestApplication } from './nest-types'

/**
 * Extract NestJS modules information from the application
 * @param appInfo - The running application detected by Node Lens
 * @returns Array of module information
 */
export function extractNestModules(appInfo: AppInfo): NestModuleInfo[] {
  const nestApp = appInfo.nestApp as NestApplication | undefined
  if (!nestApp?.container?.modules) {
    return []
  }

  const modules: NestModuleInfo[] = []
  const modulesContainer = nestApp.container.modules

  try {
    for (const [, moduleRef] of modulesContainer.entries()) {
      // Skip internal NestJS modules
      if (moduleRef.name === 'InternalCoreModule') continue

      const moduleInfo = buildModuleInfo(moduleRef)
      modules.push(moduleInfo)
    }
  } catch (error) {
    console.warn('[IntrospectionPlugin] Error extracting NestJS modules:', error)
  }

  return modules
}

/**
 * Build module information from a module reference
 * @param moduleRef - The NestJS module reference
 * @returns Module information object
 */
function buildModuleInfo(moduleRef: ModuleRef): NestModuleInfo {
  const moduleInfo: NestModuleInfo = {
    id: moduleRef.id,
    name: moduleRef.name || moduleRef.metatype?.name || String(moduleRef.token),
    isGlobal: moduleRef.isGlobal,
    imports: [],
    providers: [],
    controllers: [],
    exports: [],
  }

  // Extract imports
  for (const importRef of moduleRef.imports) {
    if (importRef.name && importRef.name !== 'InternalCoreModule') {
      moduleInfo.imports.push({
        id: importRef.id,
        name: importRef.name || importRef.metatype?.name || String(importRef.token)
      })
    }
  }

  // Extract controllers
  for (const [, controllerRef] of moduleRef.controllers) {
    if (controllerRef.metatype?.name) {
      moduleInfo.controllers.push(controllerRef.metatype.name)
    }
  }

  // Extract exports (will be resolved later)
  for (const exportRef of moduleRef.exports) {
    moduleInfo.exports.push(exportRef as { type: 'module' | 'provider'; id: string; name: string })
  }

  return moduleInfo
}

/**
 * Resolve module exports after all modules are processed
 * @param modules - Array of modules to resolve exports for
 * @param modulesMap - Map of module tokens to module info
 * @param providersMap - Map of provider tokens to provider info
 */
export function resolveModuleExports(
  modules: NestModuleInfo[],
  modulesMap: Map<unknown, NestModuleInfo>,
  providersMap: Map<unknown, { id: string; name: string }>
): void {
  for (const moduleInfo of modules) {
    moduleInfo.exports = moduleInfo.exports
      .map((exp) => {
        // Check if it's a module
        const mod = modulesMap.get(exp)
        if (mod) {
          return { type: 'module' as const, id: mod.id, name: mod.name }
        }

        // Check if it's a provider
        const prov = providersMap.get(exp)
        if (prov) {
          return { type: 'provider' as const, id: prov.id, name: prov.name }
        }

        return null
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
  }
}
