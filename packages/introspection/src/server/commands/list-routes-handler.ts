import { AppInfo, BaseCommandHandler, joinUrlSegments } from '@cisstech/node-lens-server';
import { extractVersioningInfo } from '../extractors';
import { extractGraphQLResolvers } from '../extractors/nest-graphql-extractor';
import { extractRoutes } from '../extractors/route-extractor';
import { ApolloDriverConfig, ListRoutesResult, PLUGIN_COMMANDS, VersioningInfo } from '../types';

/**
 * Command handler for listing application routes (supports NestJS, Express, Fastify)
 */
export class ListRoutesCommandHandler extends BaseCommandHandler {
  constructor(
    private getAppInfo: () => AppInfo | undefined,
    private getApolloConfigs?: () => ApolloDriverConfig[],
    private getConfiguredGraphqlEndpoints?: () => string[]
  ) {
    super()
  }

  protected canHandle(command: string): boolean {
    return command === PLUGIN_COMMANDS.LIST_ROUTES
  }

  protected async execute(): Promise<ListRoutesResult> {
    const appInfo = this.getAppInfo()

    if (!appInfo) {
      return { routes: [] }
    }

    try {
      const routes = extractRoutes(appInfo)
      const versioning = extractVersioningInfo(appInfo)
      const apolloEndpoints = this.applyVersioningToGraphEndpoints(this.getApolloConfigs?.() || [], versioning)
      const gqlRoutes = extractGraphQLResolvers(appInfo, apolloEndpoints)

      // Forward configured endpoints to the frontend (normalize leading slash)
      const configured = (this.getConfiguredGraphqlEndpoints?.() || [])
        .filter(Boolean)
        .map((p) => (p.startsWith('/') ? p : `/${p}`))
      return {
        routes: routes.concat(gqlRoutes),
        versioning,
        graphqlEndpoints: configured
      }
    } catch (error) {
      console.error('[ListRoutesCommandHandler] Error listing routes:', error)
      return { routes: [] }
    }
  }

  private applyVersioningToGraphEndpoints(configs: ApolloDriverConfig[], versioning?: VersioningInfo): string[] {
    return configs.map((config) => {
      const path = config.path || '/graphql'
      if (config.useGlobalPrefix && versioning?.globalPrefix) {
        return joinUrlSegments('/', versioning.globalPrefix, path)
      }
      // ensure leading slash
      return path.startsWith('/') ? path : `/${path}`
    })
  }
}
