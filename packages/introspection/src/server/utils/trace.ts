/* eslint-disable @typescript-eslint/no-explicit-any */
// utils/trace.ts
import { SpanStatusCode, trace } from '@opentelemetry/api';

const WRAPPED = Symbol.for('nl.trace.wrapped');

type AnyFn = (...args: any[]) => any;

export interface TraceOpts {
  /** Custom span name or a factory based on `this` */
  spanName?: string | ((self: any) => string);
  /** Attributes to attach to the span (object or factory) */
  attributes?: Record<string, any> | ((self: any) => Record<string, any>);
  /**
   * Also define the wrapper on the concrete instance when you pass an instance.
   * This helps override any method references that frameworks might have cached.
   * Defaults to true.
   */
  patchPrototypeToo?: boolean;
}

const isFn = (v: unknown): v is AnyFn => typeof v === 'function';
const isThenable = (v: any): v is Promise<any> => v && typeof v.then === 'function';

/**
 * Wrap a class method to create an active span on invocation.
 * - Works when `target` is a **prototype** (e.g., `UserService.prototype`)
 *   or a **live instance** (e.g., `controllerInstance`).
 * - Won’t double-wrap.
 * - Skips getters/setters.
 * - Properly records exceptions and sets SpanStatusCode.ERROR.
 *
 * Returns true if it successfully wrapped; otherwise false.
 */
export function traceMethod(target: any, methodName: string, opts: TraceOpts = {}): boolean {
  if (!target || !methodName || methodName === 'constructor') return false;

  // Find the property owner in the prototype chain
  let holder: any = target;
  while (holder && !Object.prototype.hasOwnProperty.call(holder, methodName)) {
    holder = Object.getPrototypeOf(holder);
  }
  if (!holder) return false;

  const desc = Object.getOwnPropertyDescriptor(holder, methodName);
  if (!desc) return false;

  // Don’t touch accessors
  if ('get' in desc || 'set' in desc) return false;

  const original = desc.value as AnyFn;
  if (!isFn(original)) return false;
  if ((original as any)[WRAPPED]) return false; // already wrapped

  const tracer = trace.getTracer('node-lens-introspection');

  const wrapper = function nlWrapped(this: any, ...args: any[]) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    const name =
      (typeof opts.spanName === 'function'
        ? opts.spanName(self)
        : opts.spanName) ||
      `${self?.constructor?.name || holder?.constructor?.name || 'Provider'}.${methodName}()`;

    const attributes =
      (typeof opts.attributes === 'function'
        ? opts.attributes(self)
        : opts.attributes) || undefined;

    // Start BEFORE executing original -> parent span properly contains child spans
    return tracer.startActiveSpan(name, { attributes }, (span) => {
      try {
        const out = original.apply(self, args);
        if (isThenable(out)) {
          return out
            .then((res) => {
              span.end();
              return res;
            })
            .catch((err) => {
              span.recordException(err);
              span.setStatus({ code: SpanStatusCode.ERROR });
              span.end();
              throw err;
            });
        }
        span.end();
        return out;
      } catch (err) {
        span.recordException(err as any);
        span.setStatus({ code: SpanStatusCode.ERROR });
        span.end();
        throw err;
      }
    });
  };

  // Mark wrapper so we don’t rewrap later
  Object.defineProperty(wrapper, WRAPPED, { value: true });

  // Patch the property owner (prototype or instance where it’s defined)
  Object.defineProperty(holder, methodName, {
    value: wrapper,
    configurable: true,
    writable: true,
  });

  // If target is an instance and holder is its prototype, also shadow on the instance.
  // This beats any cached references Nest/Express may have captured during bootstrap.
  const patchPrototypeToo = opts.patchPrototypeToo !== false;
  if (patchPrototypeToo && target !== holder) {
    Object.defineProperty(target, methodName, {
      value: wrapper,
      configurable: true,
      writable: true,
    });
  }

  return true;
}

/** Convenience: wrap several methods at once. */
export function traceMethods(target: any, methodNames: string[], opts?: TraceOpts): void {
  for (const m of methodNames) {
    traceMethod(target, m, opts);
  }
}
