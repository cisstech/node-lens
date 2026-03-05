import type { RequestEvent, RequestOperation } from '../../server/types';

// Operation type definitions
export type OperationType = 'error' | 'graphql' | 'cache' | 'db' | 'http' | 'middleware' | 'default';

// Color mapping for operation types
export const OPERATION_COLORS: Record<OperationType, string> = {
  error: 'var(--nl-request-op-color-error)',
  graphql: 'var(--nl-request-op-color-graphql)',
  cache: 'var(--nl-request-op-color-cache)',
  db: 'var(--nl-request-op-color-db)',
  http: 'var(--nl-request-op-color-http)',
  middleware: 'var(--nl-request-op-color-middleware)',
  default: 'var(--nl-request-op-color-default)',
};

/**
 * Calculates the actual duration of an operation in milliseconds.
 */
export const getOperationDuration = (op: RequestOperation): number => {
  return Math.max(0, op.durationMs ?? (op.endTimeMs - op.startTimeMs));
};

/**
 * Generates a unique key for an operation based on its properties.
 */
export const getOperationKey = (op: RequestOperation): string => {
  return `${op.name}-${op.startTimeMs}-${op.endTimeMs}`;
};

/**
 * Determines the type category of an operation based on its attributes.
 */
export const getOperationType = (op: RequestOperation): OperationType => {
  if (op.isError) return 'error';
  if (op.attributes?.['graphql.field.name'] ||
      op.attributes?.['graphql.field.path'] ||
      op.attributes?.['graphql.field.type'] ||
      op.attributes?.['graphql.source']) return 'graphql';
  if (op.attributes?.['db.system'] === 'redis' ||
      op.attributes?.['db.system'] === 'memcached' ||
      op.attributes?.['db.system'] === 'elasticsearch') return 'cache';
  if (op.attributes?.['db.system']) return 'db';
  if (op.attributes?.['http.method']) return 'http';
  if (op.name?.toLowerCase().includes('middleware')) return 'middleware';
  return 'default';
};

/**
 * Gets the visual color for an operation based on its type.
 */
export const getOperationColor = (op: RequestOperation): string => {
  return OPERATION_COLORS[getOperationType(op)];
};

/**
 * Checks if an operation is considered "long" based on duration threshold.
 */
export const isLongOperation = (op: RequestOperation, thresholdMs = 100): boolean => {
  return getOperationDuration(op) > thresholdMs;
};

/**
 * Clamps a number between 0 and 1 for percentage calculations.
 */
export const clamp01 = (n: number): number => {
  return Math.max(0, Math.min(1, n));
};

/**
 * Recursively finds an operation by its key in a tree.
 */
export const findOperationByKey = (operations: RequestOperation[], key: string): RequestOperation | null => {
  for (const op of operations) {
    if (getOperationKey(op) === key) return op;
    if (op.children) {
      const found = findOperationByKey(op.children, key);
      if (found) return found;
    }
  }
  return null;
};

/**
 * Filters operations by minimum duration threshold, preserving tree structure.
 */
export const filterOperationsByDuration = (operations: RequestOperation[], minDurationMs: number): RequestOperation[] => {
  return operations.filter(op => {
    return getOperationDuration(op) >= minDurationMs;
  }).map(op => ({
    ...op,
    children: op.children ? filterOperationsByDuration(op.children, minDurationMs) : undefined
  }));
};

/**
 * Filters operations by search query (matches operation names), preserving tree structure.
 */
export const filterOperationsBySearch = (operations: RequestOperation[], query: string): RequestOperation[] => {
  const lowerQuery = query.toLowerCase();
  return operations.filter(op => {
    const matchesName = op.name.toLowerCase().includes(lowerQuery);
    const hasMatchingChildren = op.children && filterOperationsBySearch(op.children, query).length > 0;
    return matchesName || hasMatchingChildren;
  }).map(op => ({
    ...op,
    children: op.children ? filterOperationsBySearch(op.children, query) : undefined
  }));
};

/**
 * Filters operations by their categorized type, preserving tree structure.
 */
export const filterOperationsByType = (operations: RequestOperation[], hiddenTypes: Set<string>): RequestOperation[] => {
  return operations.filter(op => {
    const opType = getOperationType(op);
    const isVisible = !hiddenTypes.has(opType);
    const hasVisibleChildren = op.children && filterOperationsByType(op.children, hiddenTypes).length > 0;
    return isVisible || hasVisibleChildren;
  }).map(op => ({
    ...op,
    children: op.children ? filterOperationsByType(op.children, hiddenTypes) : undefined
  }));
};

/**
 * Counts operations by type in the entire operation tree.
 */
export const countOperationsByType = (operations: RequestOperation[]): Record<OperationType, number> => {
  const counts: Record<OperationType, number> = {
    error: 0,
    graphql: 0,
    cache: 0,
    db: 0,
    http: 0,
    middleware: 0,
    default: 0
  };

  const walk = (ops: RequestOperation[]) => {
    ops.forEach(op => {
      counts[getOperationType(op)]++;
      if (op.children) {
        walk(op.children);
      }
    });
  };

  walk(operations);
  return counts;
};

/**
 * Build a cURL command for a given request
 */
export const buildCurl = (req: RequestEvent): string => {
  const parts: string[] = ['curl'];

  // Method
  const method = req.request.method.toUpperCase();
  parts.push(`-X ${method}`);

  // Headers
  for (const [k, v] of Object.entries(req.request.headers || {})) {
    parts.push(`-H "${k}: ${v}"`);
  }

  // Body
  if (req.request.body !== undefined && req.request.body !== null) {
    let bodyStr = '';
    try {
      bodyStr = typeof req.request.body === 'string'
        ? req.request.body
        : JSON.stringify(req.request.body);
    } catch {
      bodyStr = String(req.request.body);
    }
    parts.push(`--data '${bodyStr.replace(/'/g, "'\\''")}'`);
  }

  // URL
  parts.push(`"${req.request.url}"`);

  return parts.join(' ');
}

/**
 * Export a request event as JSON (request only, or full event)
 */
export const exportRequest = (req: RequestEvent, full = true) => {
  const data = full ? req : req.request;
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `request-${req.id}.json`;
  a.click();

  URL.revokeObjectURL(url);
}


export const calculateOperationsTimeFrame = (operations?: RequestOperation[]) => {
  if (!operations || operations.length === 0) return { baseStart: 0, total: 0 };
  let minStart = Number.POSITIVE_INFINITY;
  let maxEnd = 0;
  const walk = (o: RequestOperation) => {
    if (typeof o.startTimeMs === 'number') minStart = Math.min(minStart, o.startTimeMs);
    if (typeof o.endTimeMs === 'number') maxEnd = Math.max(maxEnd, o.endTimeMs);
    o.children?.forEach(walk);
  };
  operations.forEach(walk);
  if (!isFinite(minStart) || maxEnd <= minStart) return { baseStart: 0, total: 0 };
  return { baseStart: minStart, total: Math.max(1, maxEnd - minStart) };
}

