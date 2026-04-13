import {
  CommandChain,
  NodeLensPlugin,
  type AppInfo,
} from '@cisstech/node-lens-server';
import type { OpenAPIObject } from '@nestjs/swagger';
import type { Instrumentation } from '@opentelemetry/instrumentation';

import type { ApolloDriverConfig, IntrospectionPluginOptions } from './types';
import { PLUGIN_NAME } from './types';

// Import command handlers
import {
  ListModulesCommandHandler,
  ListProvidersCommandHandler,
  ListRoutesCommandHandler
} from './commands';

// Import instrumentations
import { NestJSGraphQLInstrumentation } from './instrumentations/graphql';
import { OpenApiSchemaInstrumentation } from './instrumentations/openapi';

// Import auto-tracing utilities
import { NestTraceInterceptor } from './interceptors';

export { getTraceMetadata, hasTraceMetadata, Trace } from './decorators';
export * from './types';
export { traceMethod as traceProviderMethod } from './utils';

/**
 * Clean, command-based introspection plugin for NodeLens
 *
 * Provides on-demand inspection of:
 * - NestJS modules, providers, and dependency graph
 * - Application routes (NestJS, Express, Fastify)
 * - OpenAPI schemas and GraphQL endpoints
 * - Versioning configuration
 */
export class IntrospectionPlugin implements NodeLensPlugin {
  readonly icon = 'layers';
  readonly tagName = 'nl-introspection';
  readonly displayName = 'Introspection';
  readonly description = 'Visualize modules, providers, and routes';
  readonly packageName = PLUGIN_NAME;

  private commandChain: CommandChain;
  private appInfo?: AppInfo;
  private options: IntrospectionPluginOptions;

  // Data collectors for instrumentations
  private openApiSchemas: OpenAPIObject[] = [];
  private apolloConfigs: ApolloDriverConfig[] = [];
  private configuredGraphqlEndpoints: string[] = [];

  constructor(options: IntrospectionPluginOptions = {}) {
    this.options = {
      autoTrace: {
        enabled: options.autoTrace?.enabled ?? false,
        providerTypes: options.autoTrace?.providerTypes ?? ['service'],
        includeProviders: options.autoTrace?.includeProviders ?? ['*'],
        excludeProviders: options.autoTrace?.excludeProviders ?? [
          '*Logger*', '*Config*', '*Module*', '*Guard*', '*Interceptor*'
        ],
        includeMethods: options.autoTrace?.includeMethods ?? ['*'],
        excludeMethods: options.autoTrace?.excludeMethods ?? [
          'constructor', 'toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf',
          'propertyIsEnumerable', 'toLocaleString', 'get*', 'set*'
        ]
      },
    };

    // Capture configured GraphQL endpoints if provided
    this.configuredGraphqlEndpoints = Array.isArray(options.graphqlEndpoints)
      ? options.graphqlEndpoints
      : []

    // Setup command chain with all handlers
    this.commandChain = this.createCommandChain();
  }

  private createCommandChain(): CommandChain {
    return new CommandChain()
      .addHandler(new ListModulesCommandHandler(() => this.appInfo))
      .addHandler(new ListProvidersCommandHandler(() => this.appInfo, this.options.autoTrace))
      .addHandler(new ListRoutesCommandHandler(
        () => this.appInfo,
        () => this.apolloConfigs,
        () => this.configuredGraphqlEndpoints
      ))
  }

  bindToEventBus(): void {
    // This plugin exposes data through commands only; no event subscriptions needed.
  }

  isAvailable(appInfo: AppInfo): boolean {
    return appInfo?.framework === 'nestjs';
  }

  instrumentations(): Instrumentation[] {
    return [
      new OpenApiSchemaInstrumentation({
        onCreateDocument: (document) => {
          this.openApiSchemas.push(document);
        }
      }),
      new NestJSGraphQLInstrumentation({
        onSetupApollo: (config) => {
          this.apolloConfigs.push(config);
        }
      })
    ];
  }

  onListen(appInfo: AppInfo): void {
    this.appInfo = appInfo;
    this.applyGlobalTraceInterceptor(appInfo);
  }

  async handleCommand(command: string, payload?: unknown): Promise<unknown> {
    try {
      return await this.commandChain.execute(command, payload);
    } catch (error) {
      console.error(`[IntrospectionPlugin] Command '${command}' failed:`, error);
      throw error;
    }
  }

  private applyGlobalTraceInterceptor(appInfo: AppInfo): void {
    try {
      // Inject global interceptor for controllers
      appInfo.nestApp?.useGlobalInterceptors(new NestTraceInterceptor());

      console.log('[IntrospectionPlugin] Auto-tracing setup completed with global interceptor')
    } catch (error) {
      console.warn('[IntrospectionPlugin] Failed to setup auto-tracing:', error);
    }
  }
}
