import { AppInfo, BaseCommandHandler } from '@cisstech/node-lens-server'
import { extractNestModules, resolveModuleExports } from '../extractors/nest-module-extractor'
import { createProviderLookupMap } from '../extractors/nest-provider-extractor'
import { PLUGIN_COMMANDS, type NestModuleInfo } from '../types'


/**
 * Command handler for listing NestJS modules
 */
export class ListModulesCommandHandler extends BaseCommandHandler {
  constructor(private getAppInfo: () => AppInfo | undefined) {
    super()
  }

  protected canHandle(command: string): boolean {
    return command === PLUGIN_COMMANDS.LIST_MODULES
  }

  protected async execute(): Promise<NestModuleInfo[]> {
    const appInfo = this.getAppInfo()

    if (!appInfo || !appInfo.nestApp) {
      return []
    }

    try {
      const modules = extractNestModules(appInfo)

      // Resolve module exports
      const modulesMap = new Map<unknown, NestModuleInfo>()
      modules.forEach(module => modulesMap.set(module.id, module))

      const providersMap = createProviderLookupMap(appInfo)
      resolveModuleExports(modules, modulesMap, providersMap)

      return modules
    } catch (error) {
      console.error('[ListModulesCommandHandler] Error listing modules:', error)
      return []
    }
  }
}
