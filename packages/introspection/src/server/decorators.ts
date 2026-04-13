/* eslint-disable @typescript-eslint/no-explicit-any */
import { traceMethod } from './utils';

/**
 * Decorator to automatically trace a method when the IntrospectionPlugin is enabled.
 * This provides a declarative way to enable tracing without configuration.
 *
 * @example
 * ```typescript
 * import { Trace } from '@cisstech/node-lens-introspection';
 *
 * @Injectable()
 * export class UserService {
 *   @Trace({ spanName: 'UserService.findUser' })
 *   async findUser(id: string) {
 *     // Method implementation
 *   }
 *
 *   @Trace() // Uses default span name: UserService.createUser()
 *   async createUser(data: CreateUserDto) {
 *     // Method implementation
 *   }
 * }
 * ```
 */
export function Trace(options: {
  /** Custom span name. If not provided, defaults to ClassName.methodName() */
  spanName?: string;
  /** Additional attributes to attach to the span */
  attributes?: Record<string, any>;
} = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    // We need to delay the wrapping until the provider is instantiated
    // Store the tracing metadata for later use
    const tracingMetadata = {
      spanName: options.spanName,
      attributes: options.attributes || {}
    };

    // Mark the method for tracing
    Reflect.defineMetadata('node-lens:trace', tracingMetadata, target, propertyKey);

    // We could also apply tracing immediately if we want
    if (originalMethod && typeof originalMethod === 'function') {
      const className = target.constructor?.name || 'UnknownClass';
      const defaultSpanName = `${className}.${propertyKey}()`;

      traceMethod(target, propertyKey, {
        spanName: options.spanName || defaultSpanName,
        attributes: {
          'nestjs.decorator': 'Trace',
          'nestjs.class': className,
          'nestjs.method': propertyKey,
          ...options.attributes
        }
      });
    }

    return descriptor;
  };
}

/**
 * Check if a method has been marked with the @Trace decorator
 */
export function hasTraceMetadata(target: any, propertyKey: string): boolean {
  return Reflect.hasMetadata('node-lens:trace', target, propertyKey);
}

/**
 * Get tracing metadata for a method
 */
export function getTraceMetadata(target: any, propertyKey: string): any {
  return Reflect.getMetadata('node-lens:trace', target, propertyKey);
}
