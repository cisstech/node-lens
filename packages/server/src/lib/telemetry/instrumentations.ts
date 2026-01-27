/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import type { NestApplication } from '@nestjs/core';
import {
  InstrumentationBase,
  InstrumentationConfig,
  InstrumentationNodeModuleDefinition,
  isWrapped,
} from '@opentelemetry/instrumentation';
import type { Application as ExpressApp } from 'express';
import type { FastifyInstance } from 'fastify';
import type * as http from 'http';

export interface NodeLensBackendInstrumentationConfig extends InstrumentationConfig {
  callbacks?: {
    onListen: (info: {
      port: number;
      platform: 'express' | 'fastify';
      platformApp: any;
      framework: 'nestjs' | 'express' | 'fastify';
      frameworkVersion: string;
      nestApp?: NestApplication;
      nestModule?: Function;
    }) => void;
    onLoadExpress?: (app: typeof import('express'), version?: string) => void;
    onLoadFastify?: (app: typeof import('fastify'), version?: string) => void;
    onLoadNestCore?: (
      nestApp: typeof import('@nestjs/core'),
      version?: string
    ) => void;
    onLoadNestCommon?: (
      nestCommon: typeof import('@nestjs/common'),
      version?: string
    ) => void;
  };
  instrumentations?: NodeLensModuleInstrumentationDefinition[];
}

export interface NodeLensFrontendInstrumentationConfig extends InstrumentationConfig {
  /** Script to inject into HTML */
  injectScript: string;
}

/**
 * Instrumentation module definition
 */
export interface NodeLensModuleInstrumentationDefinition {
  path: string;
  versions: string[];
  patch?: (
    moduleExports: any,
    moduleVersion: string | undefined,
    wrap: (obj: any, method: string, wrapper: any) => void
  ) => any;
}


class InstrumentationUtils {
  /**
   * Check if a file path is an HTML index file
   */
  static isHtmlIndex(filePath: string): boolean {
    if (!filePath || typeof filePath !== 'string') return false;
    return /\/index\.html$/i.test(filePath);
  }

  /**
   * Check if content is HTML
   */
  static isHtmlContent(content: string): boolean {
    return typeof content === 'string' && content.includes('<html');
  }

  /**
   * Check if script is already injected in HTML content
   */
  static isScriptAlreadyInjected(html: string, script: string): boolean {
    return html.includes(script);
  }
  static processData(data: any, processor: (content: string) => string): any {
    if (Buffer.isBuffer(data)) {
      const content = data.toString('utf8');
      const processed = processor(content);
      return Buffer.from(processed, 'utf8');
    } else if (typeof data === 'string') {
      return processor(data);
    }
    return data;
  }
  /**
   * Inject script into HTML content (with deduplication)
   */
  static injectScript(html: string, script: string, filePath = 'unknown'): string {
    if (!this.isHtmlContent(html) || !script) return html;

    if (this.isScriptAlreadyInjected(html, script)) {
      console.log('[NodeLens] Script already injected, skipping:', filePath);
      return html;
    }

    console.log('[NodeLens] Injecting monitoring script into:', filePath);

    const injectedHtml = html.replace('</body>', `${script}\n</body>`);
    this.logInjection('injectScript', filePath);
    return injectedHtml;
  }

  /**
   * Log successful injection
   */
  static logInjection(method: string, filePath: string) {
    console.log(`[NodeLens] Script injected via ${method}:`, filePath);
  }
}


/**
 * Instrumentation for Node.js HTTP apps:
 * - Detects nestjs apps and underlying adapters (express/fastify)
 * - Detects direct express and fastify apps
 * - Delayed detection on `.listen`
 */
export class NodeLensBackendInstrumentation extends InstrumentationBase<NodeLensBackendInstrumentationConfig> {
  constructor(config: NodeLensBackendInstrumentationConfig = {}) {
    super('node-lens-backend-instrumentation', '1.0.0', config);
  }

  init() {
    const instrumentation = this;

    class WrapHolder {
      private wraps: Array<[any, string]> = [];

      push(wrap: [any, string]) {
        this.wraps.push(wrap);
      }

      unwrap() {
        this.wraps.forEach(([obj, method]) => {
          if (isWrapped(obj[method])) {
            instrumentation._unwrap(obj, method);
          }
        });
      }
    }


    const nestWraps = new WrapHolder();
    const fastifyWraps = new WrapHolder();
    const expressWraps = new WrapHolder();

    const instrumentations =
      this.getConfig().instrumentations || [];

    return [
      // custom instrumentations from plugins
      ...instrumentations.map(({ path, versions, patch }) => {
        const wrapHolder = new WrapHolder();
        return new InstrumentationNodeModuleDefinition(
          path,
          versions,
          (moduleExports, moduleVersion) => {
            if (typeof patch === 'function') {
              return patch(
                moduleExports,
                moduleVersion,
                (obj, method, wrapper) => {
                  if (isWrapped(obj[method])) instrumentation._unwrap(obj, method);
                  instrumentation._wrap(obj, method, wrapper);
                  wrapHolder.push([obj, method]);
                }
              );
            }
            return moduleExports;
          },
          () => {
            wrapHolder.unwrap();
          }
        );
      }),

      // nestjs core
      new InstrumentationNodeModuleDefinition(
        '@nestjs/core',
        ['*'],
        (moduleExports, moduleVersion) => {
          const callbacks = instrumentation.getConfig().callbacks;
          const { onListen, onLoadNestCore } = callbacks || {};

          if (typeof onLoadNestCore === 'function') {
            onLoadNestCore(moduleExports, moduleVersion);
          }

          if (!moduleExports?.NestFactory) return moduleExports;

          const factory = moduleExports.NestFactory;
          const application = moduleExports.NestApplication;

          if (isWrapped(factory.create)) instrumentation._unwrap(factory, 'create');
          if (isWrapped(application.listen)) instrumentation._unwrap(application, 'listen');

          let platform: 'express' | 'fastify' = 'express';
          let platformApp: any = null;
          let nestApp: NestApplication | null = null;
          let nestModule: Function | null = null;

          instrumentation._wrap(factory, 'create', (original: any) =>
            async function create(this: any, ...args: any[]) {
              if (args.length >= 2) {
                const adapter = args[1];
                if (typeof adapter === 'object' && typeof adapter.constructor === 'function') {
                  const name = adapter.constructor.name as string;
                  platform =
                    {
                      FastifyAdapter: 'fastify' as const,
                      ExpressAdapter: 'express' as const,
                    }[name] || 'express' as const;
                }
              }

              nestApp = await original.apply(this, args) as NestApplication;
              nestModule = args[0];
              platformApp = nestApp.getHttpAdapter().getInstance();

              return nestApp;
            }
          );

          instrumentation._wrap(application.prototype, 'listen', (original: any) =>
            function listen(this: any, ...args: any[]) {
              const port = args[0] || 3000;
              if (typeof onListen === 'function') {
                onListen({
                  port,
                  platform,
                  platformApp,
                  framework: 'nestjs',
                  frameworkVersion: moduleVersion || 'unknown',
                  nestApp: nestApp || undefined,
                  nestModule: nestModule || undefined,
                });
              }
              return original.apply(this, args);
            }
          );

          nestWraps.push([factory, 'create']);
          nestWraps.push([application.prototype, 'listen']);

          return moduleExports;
        },
        () => nestWraps.unwrap()
      ),

      // nestjs common
      new InstrumentationNodeModuleDefinition(
        '@nestjs/common',
        ['*'],
        (moduleExports, moduleVersion) => {
          const callbacks = instrumentation.getConfig().callbacks;
          const { onLoadNestCommon } = callbacks || {};

          if (typeof onLoadNestCommon === 'function') {
            onLoadNestCommon(moduleExports, moduleVersion);
          }

          return moduleExports;
        }
      ),

      // express
      new InstrumentationNodeModuleDefinition(
        'express',
        ['*'],
        (moduleExports, moduleVersion) => {
          const callbacks = instrumentation.getConfig().callbacks;
          const { onListen, onLoadExpress } = callbacks || {};

          if (typeof onLoadExpress === 'function') {
            onLoadExpress(moduleExports, moduleVersion);
          }

          if (!moduleExports?.application) return moduleExports;

          const appProto = moduleExports.application;

          if (isWrapped(appProto.listen)) instrumentation._unwrap(appProto, 'listen');

          instrumentation._wrap(appProto, 'listen', (original: any) =>
            function patchedListen(this: any, ...args: any[]) {
              const app = this as ExpressApp;
              const port = args[0] || 3000;

              if (typeof onListen === 'function') {
                onListen({
                  port,
                  framework: 'express',
                  platform: 'express',
                  platformApp: app,
                  frameworkVersion: moduleVersion || 'unknown',
                });
              }

              return original.apply(this, args);
            }
          );

          expressWraps.push([appProto, 'listen']);
          return moduleExports;
        },
        () => expressWraps.unwrap()
      ),

      // fastify
      new InstrumentationNodeModuleDefinition(
        'fastify',
        ['*'],
        (moduleExports, moduleVersion) => {
          const callbacks = instrumentation.getConfig().callbacks;
          const { onListen, onLoadFastify } = callbacks || {};

          if (typeof onLoadFastify === 'function') {
            onLoadFastify(moduleExports, moduleVersion);
          }

          if (!moduleExports?.prototype?.listen) return moduleExports;
          const proto = moduleExports.prototype;

          if (isWrapped(proto.listen)) this._unwrap(proto, 'listen');

          this._wrap(proto, 'listen', (original: any) =>
            function listen(this: FastifyInstance, ...args: any[]) {
              const app = this;
              const port = args[0] || 3000;
              if (typeof onListen === 'function') {
                onListen({
                  port,
                  framework: 'fastify',
                  platform: 'fastify',
                  platformApp: app,
                  frameworkVersion: moduleVersion || 'unknown',
                });
              }

              return original.apply(this, args);
            }
          );

          fastifyWraps.push([proto, 'listen']);
          return moduleExports;
        },
        () => fastifyWraps.unwrap()
      ),
    ];
  }
}

/**
 * Instrumentation to detects and inject monitoring script into HTML responses.
 * This works for frontend served by Node.js HTTP servers.
 * - vite
 * - webpack dev server
 * - express static serving
 * - fastify static serving
 * - ...etc.
 */
export class NodeLensFrontHttpInstrumentation extends InstrumentationBase<NodeLensFrontendInstrumentationConfig> {
  constructor(config: NodeLensFrontendInstrumentationConfig) {
    super('node-lens-front-http-instrumentation', '1.0.0', config);
  }

  init() {
    return [this._createHttpInstrumentation()];
  }

  /**
   * Create instrumentation for 'http' module
   */
  private _createHttpInstrumentation() {
    return new InstrumentationNodeModuleDefinition(
      'http',
      ['*'],
      (moduleExports: typeof http) => {
        return this._wrapHttpModule(moduleExports);
      }
    );
  }

  /**
   * Wrap HTTP module to intercept HTML responses
   */
  private _wrapHttpModule(moduleExports: typeof http) {
    const config = this.getConfig();
    if (!config.injectScript) return moduleExports;

    if (
      moduleExports.ServerResponse &&
      !isWrapped(moduleExports.ServerResponse.prototype.end)
    ) {

      const originalEnd = moduleExports.ServerResponse.prototype.end;

      moduleExports.ServerResponse.prototype.end = function (
        this: http.ServerResponse & { req?: http.IncomingMessage },
        chunk?: any,
        encoding?: any
      ) {
        const contentType = (this.getHeader('content-type') as string) || '';

        const _isHtmlResponse = (ct: string, body: any) => {
          if (ct.includes('text/html')) return true;
          if (body && typeof body === 'string' && InstrumentationUtils.isHtmlContent(body)) return true;
          if (Buffer.isBuffer(body) && InstrumentationUtils.isHtmlContent(body.toString())) return true;
          return false;
        };

        const _injectIntoHtmlResponse = (body: any, script: string) => {
          const url = this.req?.url || 'unknown';
          InstrumentationUtils.logInjection('HTTP response', url);

          const html = String(body).toString();
          const injectedHtml = InstrumentationUtils.injectScript(html, script, url);
          if (this.getHeader('content-length')) {
            this.setHeader('content-length', Buffer.byteLength(injectedHtml));
          }
          return injectedHtml;
        };

        if (
          _isHtmlResponse(contentType, chunk) &&
          InstrumentationUtils.isHtmlIndex(this.req?.url || '')
        ) {
          chunk = _injectIntoHtmlResponse(chunk, config.injectScript);
        }

        return originalEnd.call(this, chunk, encoding);
      };
    }

    return moduleExports;
  }
}


export class NodeLensFrontFsInstrumentation extends InstrumentationBase<NodeLensFrontendInstrumentationConfig> {
  constructor(config: NodeLensFrontendInstrumentationConfig) {
    super('node-lens-front-fs-instrumentation', '1.0.0', config);
  }

  init() {
    return [
      this._createFsInstrumentation(),
      this._createFsPromisesInstrumentation()
    ];
  }

  /**
   * Create instrumentation for 'fs' module
   */
  _createFsInstrumentation() {
    return new InstrumentationNodeModuleDefinition(
      'fs',
      ['*'],
      (moduleExports) => {
        return this._wrapFsModule(moduleExports);
      }
    );
  }

  /**
   * Create instrumentation for 'fs/promises' module
   */
  _createFsPromisesInstrumentation() {
    return new InstrumentationNodeModuleDefinition(
      'fs/promises',
      ['*'],
      (moduleExports) => {
        return this._wrapFsPromisesModule(moduleExports);
      }
    );
  }

  /**
   * Wrap fs module methods
   */
  _wrapFsModule(moduleExports: any) {
    const config = this.getConfig();
    if (!config.injectScript) return moduleExports;

    // Wrap readFile (async)
    if (moduleExports.readFile && !isWrapped(moduleExports.readFile)) {
      const original = moduleExports.readFile;
      moduleExports.readFile = (filePath: string, options: any, callback: any) => {
        // Handle argument variations
        const actualCallback = typeof options === 'function' ? options : callback;
        const actualOptions = typeof options === 'function' ? undefined : options;

        const wrappedCallback = (err: any, data: any) => {
          if (!err && InstrumentationUtils.isHtmlIndex(filePath)) {
            data = InstrumentationUtils.processData(data, (content) => {
              if (InstrumentationUtils.isHtmlContent(content)) {
                InstrumentationUtils.logInjection('fs.readFile', filePath);
                return InstrumentationUtils.injectScript(content, config.injectScript, filePath);
              }
              return content;
            });
          }
          return actualCallback(err, data);
        };

        return original.call(this, filePath, actualOptions, wrappedCallback);
      };
    }

    // Wrap readFileSync
    if (moduleExports.readFileSync && !isWrapped(moduleExports.readFileSync)) {
      const original = moduleExports.readFileSync;
      moduleExports.readFileSync = (filePath: string, options: any) => {
        const data = original.call(this, filePath, options);

        if (InstrumentationUtils.isHtmlIndex(filePath)) {
          return InstrumentationUtils.processData(data, (content) => {
            if (InstrumentationUtils.isHtmlContent(content)) {
              InstrumentationUtils.logInjection('fs.readFileSync', filePath);
              return InstrumentationUtils.injectScript(content, config.injectScript, filePath);
            }
            return content;
          });
        }

        return data;
      };
    }

    // Wrap writeFile (async)
    if (moduleExports.writeFile && !isWrapped(moduleExports.writeFile)) {
      const original = moduleExports.writeFile;
      moduleExports.writeFile = (filePath: string, data: any, options: any, callback: any) => {
        // Handle argument variations
        const actualCallback = typeof options === 'function' ? options : callback;
        const actualOptions = typeof options === 'function' ? undefined : options;

        if (InstrumentationUtils.isHtmlIndex(filePath)) {
          data = InstrumentationUtils.processData(data, (content) => {
            if (InstrumentationUtils.isHtmlContent(content)) {
              InstrumentationUtils.logInjection('fs.writeFile', filePath);
              return InstrumentationUtils.injectScript(content, config.injectScript, filePath);
            }
            return content;
          });
        }

        return original.call(this, filePath, data, actualOptions, actualCallback);
      };
    }

    // Wrap writeFileSync
    if (moduleExports.writeFileSync && !isWrapped(moduleExports.writeFileSync)) {
      const original = moduleExports.writeFileSync;
      moduleExports.writeFileSync = (filePath: string, data: any, options: any) => {
        if (InstrumentationUtils.isHtmlIndex(filePath)) {
          data = InstrumentationUtils.processData(data, (content) => {
            if (InstrumentationUtils.isHtmlContent(content)) {
              InstrumentationUtils.logInjection('fs.writeFileSync', filePath);
              return InstrumentationUtils.injectScript(content, config.injectScript, filePath);
            }
            return content;
          });
        }

        return original.call(this, filePath, data, options);
      };
    }

    return moduleExports;
  }

  /**
   * Wrap fs/promises module methods
   */
  _wrapFsPromisesModule(moduleExports: any) {
    const config = this.getConfig();
    if (!config.injectScript) return moduleExports;

    // Wrap readFile (promise-based)
    if (moduleExports.readFile && !isWrapped(moduleExports.readFile)) {
      const original = moduleExports.readFile;
      moduleExports.readFile = async (filePath: string, options: any) => {
        const data = await original.call(this, filePath, options);

        if (InstrumentationUtils.isHtmlIndex(filePath)) {
          return InstrumentationUtils.processData(data, (content) => {
            if (InstrumentationUtils.isHtmlContent(content)) {
              InstrumentationUtils.logInjection('fs/promises.readFile', filePath);
              return InstrumentationUtils.injectScript(content, config.injectScript, filePath);
            }
            return content;
          });
        }

        return data;
      };
    }

    // Wrap writeFile (promise-based)
    if (moduleExports.writeFile && !isWrapped(moduleExports.writeFile)) {
      const original = moduleExports.writeFile;
      moduleExports.writeFile = async (filePath: string, data: any, options: any) => {
        if (InstrumentationUtils.isHtmlIndex(filePath)) {
          data = InstrumentationUtils.processData(data, (content) => {
            if (InstrumentationUtils.isHtmlContent(content)) {
              InstrumentationUtils.logInjection('fs/promises.writeFile', filePath);
              return InstrumentationUtils.injectScript(content, config.injectScript, filePath);
            }
            return content;
          });
        }

        return original.call(this, filePath, data, options);
      };
    }

    return moduleExports;
  }
}
