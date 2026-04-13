// NestJS types (from @nestjs/common)

export enum VersioningType {
  URI = 0,
  HEADER = 1,
  MEDIA_TYPE = 2,
  CUSTOM = 3
}

export interface ProviderRef {
  id: string
  name: string
  metatype?: {
    name: string
    prototype?: object
  }
  instance?: object
  token: unknown
}

export interface ControllerRef {
  metatype?: { name: string, prototype: Record<string, unknown> }
  instance?: { constructor: { name: string } }
}

export interface ModuleRef {
  id: string
  token: unknown
  isGlobal: boolean
  imports: ModuleRef[]
  controllers: Map<unknown, ControllerRef>
  exports: Array<{ type: 'module' | 'provider'; id: string; name: string } | unknown>
  name: string
  metatype?: { name: string }
  providers: Map<unknown, ProviderRef>
}

export interface NestVersioning {
  type?: VersioningType
  defaultVersion?: string | string[]
  prefix?: string | false
  header?: string
  key?: string
}

export interface ApplicationConfig {
  getGlobalPrefix(): string
  getVersioning?(): NestVersioning
}

export interface NestApplication {
  container?: {
    modules: Map<unknown, ModuleRef>
  }
  config: ApplicationConfig
}


// constants from @nestjs/common/constants
export const PATH_METADATA = 'path';
export const METHOD_METADATA = 'method';

// Mimic RequestMethod enum from @nestjs/common/enums/request-method.enum.ts
export enum RequestMethod {
  GET = 0,
  POST = 1,
  PUT = 2,
  DELETE = 3,
  PATCH = 4,
  ALL = 5,
  OPTIONS = 6,
  HEAD = 7,
  SEARCH = 8,
  PROPFIND = 9,
  PROPPATCH = 10,
  MKCOL = 11,
  COPY = 12,
  MOVE = 13,
  LOCK = 14,
  UNLOCK = 15
}

