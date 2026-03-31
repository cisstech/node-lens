import * as util from 'util';

/**
 * Format console-style logs with %s/%d/%j interpolation.
 */
export function formatConsoleArgs(args: unknown[]): { message: string; attributes: Record<string, unknown> } {
  let message: string;
  try {
    message = util.format(...args);
  } catch {
    message = args.map(safeToString).join(' ');
  }
  return { message, attributes: { rawArgs: args } };
}

/**
 * Format NestJS logger calls.
 * First arg is usually message, extra args may be context or metadata.
 */
export function formatNestLogger(method: string, message: unknown, args: unknown[]): { message: string; attributes: Record<string, unknown> } {
  const formatted = util.format(message, ...args);
  return {
    message: formatted,
    attributes: { logger: 'nestjs', method, rawArgs: [message, ...args] }
  };
}

/**
 * Format Pino logger calls.
 * Pino often takes an object as first arg (context), then a message string.
 */
export function formatPinoArgs(args: unknown[]): { message: string; attributes: Record<string, unknown> } {
  if (!args.length) return { message: '', attributes: {} };

  let ctx: Record<string, unknown> = {};
  let msg = '';

  if (typeof args[0] === 'object' && !Array.isArray(args[0])) {
    ctx = args[0] as Record<string, unknown>;
    if (typeof args[1] === 'string') {
      msg = util.format(args[1], ...args.slice(2));
    }
  } else if (typeof args[0] === 'string') {
    msg = util.format(args[0], ...args.slice(1));
  } else {
    msg = args.map(safeToString).join(' ');
  }

  return { message: msg, attributes: { ...ctx, rawArgs: args } };
}

/**
 * Safe stringify for fallback cases.
 */
function safeToString(val: unknown): string {
  try {
    return typeof val === 'string' ? val : JSON.stringify(val);
  } catch {
    return String(val);
  }
}
