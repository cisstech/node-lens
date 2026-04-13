import { AppInfo, BaseCommandHandler } from '@cisstech/node-lens-server'
import { extractNestProviders } from '../extractors/nest-provider-extractor'
import { PLUGIN_COMMANDS, type AutoTraceOptions, type NestProviderInfo } from '../types'

/**
 * Command handler for listing NestJS providers with filtering options
 */
export class ListProvidersCommandHandler extends BaseCommandHandler {
  constructor(
    private getAppInfo: () => AppInfo | undefined,
    private autoTraceOptions?: AutoTraceOptions
  ) {
    super()
  }

  protected canHandle(command: string): boolean {
    return command === PLUGIN_COMMANDS.LIST_PROVIDERS
  }

  protected async execute(): Promise<NestProviderInfo[]> {
    const appInfo = this.getAppInfo()

    if (!appInfo || !appInfo.nestApp) {
      return []
    }

    try {
      return extractNestProviders(appInfo, this.autoTraceOptions)
    } catch (error) {
      console.error('[ListProvidersCommandHandler] Error listing providers:', error)
      return []
    }
  }
}
