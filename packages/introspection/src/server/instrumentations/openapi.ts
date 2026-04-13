/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  InstrumentationBase,
  InstrumentationConfig,
  InstrumentationNodeModuleDefinition,
  isWrapped,
} from '@opentelemetry/instrumentation'
import { OpenAPIObject } from '../types'

const NAME = 'node-lens-openapi-schema'
const VERSION = '1.0.0'

export interface OpenApiSchemaInstrumentationConfig extends InstrumentationConfig {
  onCreateDocument?: (document: OpenAPIObject) => void
}

export class OpenApiSchemaInstrumentation extends InstrumentationBase<OpenApiSchemaInstrumentationConfig> {
  constructor(config: OpenApiSchemaInstrumentationConfig = {}) {
    super(NAME, VERSION, config)
  }

  init() {
    return [this.patchNestjsSwagger()]
  }

  private patchNestjsSwagger() {
    const { onCreateDocument } = this.getConfig()
    return new InstrumentationNodeModuleDefinition('@nestjs/swagger', ['*'], (moduleExports) => {
      const SwaggerModule = moduleExports?.SwaggerModule
      if (!SwaggerModule) return moduleExports

      if (isWrapped(SwaggerModule.createDocument)) {
        this._unwrap(SwaggerModule, 'createDocument')
      }

      this._wrap(
        SwaggerModule,
        'createDocument',
        (original: (...args: any[]) => any) =>
          function patchedCreateDocument(this: any, ...args: any[]) {
            const document = original.apply(this, args) as OpenAPIObject
            onCreateDocument?.(document)
            return document
          },
      )

      return moduleExports
    }, (moduleExports) => {
      if (isWrapped(moduleExports?.SwaggerModule?.createDocument)) {
        this._unwrap(moduleExports?.SwaggerModule, 'createDocument')
      }
      return moduleExports
    })
  }
}
