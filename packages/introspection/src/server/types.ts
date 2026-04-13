export type { OpenAPIObject } from '@nestjs/swagger';

export const PLUGIN_NAME = '@cisstech/node-lens-introspection';
export const PLUGIN_COMMANDS = {
  LIST_MODULES: 'list-modules',
  LIST_PROVIDERS: 'list-providers',
  LIST_ROUTES: 'list-routes',
  GET_APP_INFO: 'get-app-info',
} as const

export interface ApolloDriverConfig {
  useGlobalPrefix?: boolean;
  path?: string;
  introspection?: boolean;
}

export interface AutoTraceOptions {
  /** Enable/disable automatic tracing @default false */
  enabled?: boolean;
  /** Only trace specific provider types @default ['service'] */
  providerTypes?: NestProviderInfo['type'][];
  /** Include/exclude specific providers by name (supports glob patterns) */
  includeProviders?: string[];
  /** Exclude specific providers by name (supports glob patterns) */
  excludeProviders?: string[];
  /** Include/exclude specific methods by name (supports glob patterns) */
  includeMethods?: string[];
  /** Exclude specific methods by name (supports glob patterns) */
  excludeMethods?: string[];
}

export interface IntrospectionPluginOptions {
  /**
   * Control automatic tracing of provider methods
   * @default { enabled: false }
   */
  autoTrace?: Partial<AutoTraceOptions>;

  /**
   * Optional list of GraphQL endpoint paths.
   * Useful for non-NestJS apps.
   * The endpoints should be hosted in the same server as node-lens.
   * Examples: ['/graphql', '/api/graphql']
   */
  graphqlEndpoints?: string[];
}

export interface NestProviderInfo {
  id: string;
  name: string;
  type: 'service' | 'guard' | 'interceptor' | 'pipe' | 'middleware' | 'factory' | 'value';
  methods: string[];
}

export interface NestModuleInfo {
  id: string;
  name: string;
  isGlobal?: boolean;
  imports: { id: string; name: string; }[];
  exports: { type: 'module' | 'provider'; id: string; name: string; }[];
  providers: NestProviderInfo[];  // Names of providers
  controllers: string[];// Names of controllers
}

export interface RouteInfo {
  /**
   * HTTP method, e.g. 'GET', 'POST', etc.
   */
  method: RouteMethod;

  /**
   * controller base + method path, e.g. '/users/:id'
   */
  path: string;

  /**
   * Controller and method names (only in nestjs environment)
   * Will be empty string for Express/Fastify pure apps
   */
  controller?: string;   // Controller class name

  /**
   * Method name inside controller (only in nestjs environment)
   * Will be empty string for Express/Fastify pure apps
   */
  handler?: string;

  /**
   * Module that owns this route (only in nestjs environment)
   * Will be empty string for Express/Fastify pure apps
   */
  module?: string;

  /**
   * If route is versioned, the version(s) applied (only in nestjs environment)
   * e.g. '1', '2', or ['1','2']
   * If no versioning, this will be undefined
   * If versioning is set to 'ALL', this will be '*'
   * If versioning type is URI, this is derived from the path prefix (e.g. /v1/)
   * If versioning type is HEADER or MEDIA_TYPE, this is derived from the @Version() decorator
   * If multiple versions are applied, this will be an array of versions
   */
  versions?: string | string[];

  isGraphql?: boolean
}

/**
 * Supported route methods:
 * - Classic HTTP methods (uppercase)
 * - GraphQL operations as pseudo-methods (lowercase): 'query' | 'mutation'
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD' | 'ALL';
export type GraphQLMethod = 'query' | 'mutation';
export type RouteMethod = HttpMethod | GraphQLMethod;

export interface VersioningInfo {
  globalPrefix?: string; // ex: 'api'
  versioning?: {
    enabled: boolean;
    type?: 'URI' | 'HEADER' | 'MEDIA_TYPE' | 'CUSTOM';
    defaultVersion?: string | string[]; // ex: '1' or ['1','2']
    uriPrefix?: string; // ex: 'v'
    headerName?: string; // when HEADER
    mediaTypeKey?: string; // when MEDIA_TYPE
  };
}

export interface ListRoutesResult {
  routes: RouteInfo[];
  versioning?: VersioningInfo;
  /**
   * Discovered GraphQL endpoint paths (e.g. ['/graphql', '/api/graphql']).
   * Client can use these to run introspection queries directly.
   */
  graphqlEndpoints?: string[];
}
