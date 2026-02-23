/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FilterExpr, FilterOp, SSEEvent } from '@cisstech/node-lens-server';

/**
 * Checks if an event matches the provided filter expressions
 * @param event The event to check against filters
 * @param filters Array of filter expressions to evaluate
 * @returns true if the event matches all filters, false otherwise
 */
export function isEventMatchingFilters(event: SSEEvent, filters?: FilterExpr[]): boolean {
  if (!filters) return true;
  return filters.every(expr => evaluateFilterExpression(event, expr));
}

/**
 * Evaluates a single filter expression against an event
 * @param event The event to evaluate
 * @param expr The filter expression to check
 * @returns true if the expression matches, false otherwise
 */
export function evaluateFilterExpression(event: SSEEvent, expr: FilterExpr): boolean {
  if ('field' in expr) {
    const val = extractNestedFieldValue(event.data, expr.field);
    return compareValues(val, expr.op, expr.value);
  }
  if ('and' in expr) {
    return expr.and.every(e => evaluateFilterExpression(event, e));
  }
  if ('or' in expr) {
    return expr.or.some(e => evaluateFilterExpression(event, e));
  }
  return true;
}

/**
 * Compares a value against another value using the specified operator
 * @param val The value to compare
 * @param op The comparison operator
 * @param cmp The value to compare against
 * @returns true if the comparison is true, false otherwise
 */
export function compareValues(val: any, op: FilterOp, cmp: any): boolean {
  switch (op) {
    case 'eq': return val === cmp;
    case 'ne': return val !== cmp;
    case 'lt': return val < cmp;
    case 'lte': return val <= cmp;
    case 'gt': return val > cmp;
    case 'gte': return val >= cmp;
    case 'contains':
      return typeof val === 'string' ? val.includes(cmp)
        : Array.isArray(val) ? val.includes(cmp)
          : false;
    case 'search': {
      if (typeof val !== 'string' || typeof cmp !== 'string') return false;
      const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
      return norm(val).includes(norm(cmp));
    }
    case 'in': return Array.isArray(cmp) && cmp.includes(val);
    case 'notIn': return Array.isArray(cmp) && !cmp.includes(val);
    default: return false;
  }
}

/**
 * Get nested field value from event data (supports "data.foo.bar")
 * @param obj The object to extract the value from
 * @param path The dot-separated path to the field
 * @returns The value at the specified path, or undefined if not found
 */
export function extractNestedFieldValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

/**
 * Filters an array of events based on the provided filter expressions
 * @param events Array of events to filter
 * @param filters Array of filter expressions to apply
 * @returns Filtered array of events
 */
export function applyFiltersToEvents<T = any>(events: SSEEvent<T>[], filters?: FilterExpr[]): SSEEvent<T>[] {
  if (!filters || filters.length === 0) return events;
  return events.filter(event => isEventMatchingFilters(event, filters));
}

/**
 * Sorts an array of events based on the provided sort definitions
 * @param events Array of events to sort
 * @param sortDefs Array of sort definitions in format "field:order" (e.g., ["timestamp:desc", "data.name:asc"])
 * @returns Sorted array of events
 */
export function applySortingToEvents<T = any>(events: SSEEvent<T>[], sortDefs?: string[]): SSEEvent<T>[] {
  if (!sortDefs || sortDefs.length === 0) return events;

  // Build a single comparator from the sort definitions (primary -> secondary -> ...)
  const parsedSorts = sortDefs.map(def => {
    const [rawField, rawOrder] = def.split(':');
    const field = rawField.trim();
    const order = (rawOrder?.trim().toLowerCase() === 'desc') ? -1 : 1;
    const getter = (e: SSEEvent<T>) => {
      // allow sorting on top-level stored-event props or nested data fields
      if (field === 'sequence' || field === 'timestamp' || field === 'event' || field === 'id' || field === 'scope') {
        return (e as any)[field];
      }
      return extractNestedFieldValue(e.data, field);
    };
    return { field, order, getter };
  });

  return [...events].sort((a, b) => {
    for (const sd of parsedSorts) {
      const aVal = sd.getter(a);
      const bVal = sd.getter(b);

      if (aVal === bVal) continue;

      // treat null/undefined as lesser
      if (aVal == null && bVal != null) return -1 * sd.order;
      if (bVal == null && aVal != null) return 1 * sd.order;
      if (aVal == null && bVal == null) continue;

      // string comparison
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const cmp = aVal.localeCompare(bVal);
        if (cmp !== 0) return cmp * sd.order;
        continue;
      }

      // numeric comparison
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        if (aVal < bVal) return -1 * sd.order;
        if (aVal > bVal) return 1 * sd.order;
        continue;
      }

      // try numeric coercion (dates or numeric strings)
      const aNum = Number(aVal);
      const bNum = Number(bVal);
      if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
        if (aNum < bNum) return -1 * sd.order;
        if (aNum > bNum) return 1 * sd.order;
        continue;
      }

      // fallback to string compare
      const cmp = String(aVal).localeCompare(String(bVal));
      if (cmp !== 0) return cmp * sd.order;
    }
    return 0;
  });
}
