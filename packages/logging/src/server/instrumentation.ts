/* eslint-disable @typescript-eslint/no-unsafe-function-type */
/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { context, trace } from '@opentelemetry/api';
import {
  InstrumentationBase,
  InstrumentationNodeModuleDefinition,
  isWrapped,
} from '@opentelemetry/instrumentation';
import { formatConsoleArgs, formatNestLogger, formatPinoArgs } from './formatters';

const NAME = 'node-lens-logging';
const VERSION = '1.0.0';

export class NodeLensLoggingInstrumentation extends InstrumentationBase<any> {
  constructor(config: any = {}) {
    super(NAME, VERSION, config);
  }

  init() {
    return [
      this.patchConsole(),
      this.patchNestLogger(),
      this.patchPino(),
    ].filter(Boolean) as InstrumentationNodeModuleDefinition[];
  }

  private patchConsole() {
    const levels: (keyof Console)[] = ['log', 'error', 'warn', 'info', 'debug'];
    const instr = this;

    for (const level of levels) {
      if (typeof (console as any)[level] !== 'function') continue;
      if (isWrapped((console as any)[level])) instr._unwrap(console, level);

      this._wrap(console, level, (original: Function) =>
        function patchedConsole(this: any, ...args: any[]) {
          const { message, attributes } = formatConsoleArgs(args);
          instr.emitLog(level.toUpperCase(), message, { logger: 'console', ...attributes });
          return original.apply(this, args);
        }
      );
    }
    return undefined;
  }

  private patchNestLogger() {
    const instr = this;
    return new InstrumentationNodeModuleDefinition(
      '@nestjs/common',
      ['*'],
      (moduleExports) => {
        const Logger = moduleExports?.Logger;
        if (!Logger) return moduleExports;

        const methods: (keyof typeof Logger.prototype)[] = [
          'log', 'error', 'warn', 'debug', 'verbose',
        ];

        for (const method of methods) {
          if (typeof Logger.prototype[method] !== 'function') continue;
          if (isWrapped(Logger.prototype[method])) this._unwrap(Logger.prototype, method);

          this._wrap(Logger.prototype, method, (original: Function) =>
            function patchedNestLogger(this: any, message: any, ...args: any[]) {
              const { message: formatted, attributes } = formatNestLogger(String(method), message, args);
              attributes['context'] = this.context || 'unknown';
              instr.emitLog(String(method).toUpperCase(), formatted, attributes);
              return original.apply(this, [message, ...args]);
            }
          );
        }
        return moduleExports;
      },
      (moduleExports) => {
        const Logger = moduleExports?.Logger;
        if (!Logger) return moduleExports
        const methods: (keyof typeof Logger.prototype)[] = [
          'log', 'error', 'warn', 'debug', 'verbose',
        ]
        for (const method of methods) {
          if (isWrapped(Logger.prototype[method])) {
            this._unwrap(Logger.prototype, method)
          }
        }
        return moduleExports
      });
  }

  private patchPino() {
    const instr = this;
    return new InstrumentationNodeModuleDefinition(
      'pino',
      ['*'],
      (moduleExports) => {
        if (!moduleExports?.prototype) return moduleExports;

        const levels: (keyof typeof moduleExports.prototype)[] = [
          'info', 'error', 'warn', 'debug', 'trace', 'fatal',
        ];

        for (const level of levels) {
          if (typeof moduleExports.prototype[level] !== 'function') continue;
          if (isWrapped(moduleExports.prototype[level]))
            this._unwrap(moduleExports.prototype, level);

          this._wrap(moduleExports.prototype, level, (original: Function) =>
            function patchedPino(this: any, ...args: any[]) {
              const { message, attributes } = formatPinoArgs(args);
              instr.emitLog(String(level).toUpperCase(), message, { logger: 'pino', ...attributes });
              return original.apply(this, args);
            }
          );
        }
        return moduleExports;
      }
      , (moduleExports) => {
        if (!moduleExports?.prototype) return moduleExports;
        const levels: (keyof typeof moduleExports.prototype)[] = [
          'info', 'error', 'warn', 'debug', 'trace', 'fatal',
        ]
        for (const level of levels) {
          if (isWrapped(moduleExports.prototype[level])) {
            this._unwrap(moduleExports.prototype, level)
          }
        }
        return moduleExports
      })
      ;
  }

  private emitLog(severity: string, message: string, attributes: Record<string, any>) {
    const span = trace.getSpan(context.active());
    const spanCtx = span?.spanContext();

    this.logger.emit({
      severityText: severity,
      body: message,
      timestamp: Date.now(),
      attributes: {
        ...attributes,
        spanId: spanCtx?.spanId,
        traceId: spanCtx?.traceId,
      }
    });
  }
}
