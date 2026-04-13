/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  InstrumentationBase,
  InstrumentationConfig,
  InstrumentationNodeModuleDefinition,
  isWrapped,
} from '@opentelemetry/instrumentation';
import { ApolloDriverConfig } from '../types';

const NAME = 'nestjs-graphql-instrumentation';
const VERSION = '1.0.0';

export interface NestJSGraphQLInstrumentationConfig extends InstrumentationConfig {
  onSetupApollo?: (config: ApolloDriverConfig) => void
}

export class NestJSGraphQLInstrumentation extends InstrumentationBase<NestJSGraphQLInstrumentationConfig> {
  constructor(config: NestJSGraphQLInstrumentationConfig = {}) {
    super(NAME, VERSION, config);
  }

  init() {
    return [
      this.patchNestjsGraphQL(),
    ].filter(Boolean) as InstrumentationNodeModuleDefinition[];
  }

  private patchNestjsGraphQL() {
    const { onSetupApollo } = this.getConfig();
    return new InstrumentationNodeModuleDefinition(
      '@nestjs/graphql',
      ['*'],
      (moduleExports) => {
        const GraphQLModule = moduleExports?.GraphQLModule;
        if (!GraphQLModule) {
          return moduleExports;
        }

        if (isWrapped(GraphQLModule.forRoot)) {
          this._unwrap(GraphQLModule, 'forRoot');
        }

        this._wrap(
          GraphQLModule,
          'forRoot',
          (original: (...args: any[]) => any) =>
            function patchedForRoot(this: any, ...args: any[]) {
              const options = args[0] || {};
              onSetupApollo?.(options);
              return original.apply(this, args);
            }
        );

        if (isWrapped(GraphQLModule.forRootAsync)) {
          this._unwrap(GraphQLModule, 'forRootAsync');
        }

        this._wrap(
          GraphQLModule,
          'forRootAsync',
          (original: (...args: any[]) => any) =>
            function patchedForRootAsync(this: any, ...args: any[]) {
              const asyncOptions = args[0] || {};
              onSetupApollo?.(asyncOptions);
              return original.apply(this, args);
            }
        );

        return moduleExports;
      }, (moduleExports) => {
        if (isWrapped(moduleExports?.GraphQLModule?.forRoot)) {
          this._unwrap(moduleExports?.GraphQLModule, 'forRoot');
        }
        if (isWrapped(moduleExports?.GraphQLModule?.forRootAsync)) {
          this._unwrap(moduleExports?.GraphQLModule, 'forRootAsync');
        }
        return moduleExports;
      }
    );
  }
}
