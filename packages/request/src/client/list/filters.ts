import type { FilterExpr } from "@cisstech/node-lens-server";

export const filterDurations = {
  '>200': '>200ms',
  '>500': '>500ms',
  '>1000': '>1s',
  '>2000': '>2s',
  '>5000': '>5s',
  '>10000': '>10s',
} as const;

export const filterStatuses = {
  '2xx': '2xx Success',
  '3xx': '3xx Redirection',
  '4xx': '4xx Client Error',
  '5xx': '5xx Server Error',
} as const;

export const filterMethods = {
  GET: 'GET',
  POST: 'POST',
  PATCH: 'PATCH',
  PUT: 'PUT',
  DELETE: 'DELETE',
  HEAD: 'HEAD',
  OPTIONS: 'OPTIONS',
} as const;

export const sortKeys = ['method', 'path', 'duration', 'status', 'time'] as const;
export const FILTERS_STORAGE_KEY = 'nl.request.filters';
export type SortKey = typeof sortKeys[number];
export type SortDir = 'asc' | 'desc';
export type FilterStatus = keyof typeof filterStatuses;
export type FilterMethod = keyof typeof filterMethods;
export type FilterDuration = keyof typeof filterDurations;
export type RequestFilters = {
  search: string;
  methods: FilterMethod[];
  statuses: FilterStatus[];
  durations: FilterDuration[];
  sortKey: SortKey;
  sortDir: SortDir;
};

export const persistFilters = (filters: RequestFilters) => {
  try {
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
  } catch (error) {
    console.error('Error persisting filters:', error);
  }
}

export const restoreFilters = () => {
  const filters: Partial<RequestFilters> = {}
  try {
    const raw = localStorage.getItem(FILTERS_STORAGE_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw) as Partial<RequestFilters>;
    if (typeof obj.search === 'string') filters.search = obj.search;

    // Handle arrays for multi-select
    if (Array.isArray(obj.methods)) filters.methods = obj.methods.filter((m: string) => m in filterMethods);
    if (Array.isArray(obj.statuses)) filters.statuses = obj.statuses.filter((s: string) => s in filterStatuses);
    if (Array.isArray(obj.durations)) filters.durations = obj.durations.filter((d: string) => d in filterDurations);

    if (obj.sortKey && sortKeys.includes(obj.sortKey)) filters.sortKey = obj.sortKey;
    if (obj.sortDir && ['asc', 'desc'].includes(obj.sortDir)) filters.sortDir = obj.sortDir;
  } catch (error) {
    console.error('Error restoring filters:', error);
  }

  return filters;
}

export const emptyFilters = (): RequestFilters => ({
  search: '',
  methods: [],
  statuses: [],
  durations: [],
  sortKey: 'time',
  sortDir: 'desc'
});

export const buildFilters = (currentFilters: RequestFilters): FilterExpr[] => {
  const filters: FilterExpr[] = [];
  const { search, methods, statuses, durations } = currentFilters;
  // Text search filter (path or method)
  if (search.trim()) {
    filters.push({
      or: [
        { field: 'request.path', op: 'search', value: search },
        { field: 'request.method', op: 'search', value: search }
      ]
    });
  }

  // Method filter
  if (methods.length > 0) {
    filters.push({
      field: 'request.method',
      op: 'in',
      value: methods
    });
  }

  // Status filter
  if (statuses.length > 0) {
    const statusConditions = statuses.map<FilterExpr | null>(status => {
      switch (status) {
        case '2xx':
          return {
            and: [
              { field: 'response.statusCode', op: 'gte', value: 200 },
              { field: 'response.statusCode', op: 'lt', value: 300 }
            ]
          };
        case '3xx':
          return {
            and: [
              { field: 'response.statusCode', op: 'gte', value: 300 },
              { field: 'response.statusCode', op: 'lt', value: 400 }
            ]
          };
        case '4xx':
          return {
            and: [
              { field: 'response.statusCode', op: 'gte', value: 400 },
              { field: 'response.statusCode', op: 'lt', value: 500 }
            ]
          };
        case '5xx':
          return {
            field: 'response.statusCode',
            op: 'gte' as const,
            value: 500
          };
        default:
          return null;
      }
    }).filter(Boolean) as FilterExpr[];

    if (statusConditions.length === 1) {
      filters.push(statusConditions[0]);
    } else if (statusConditions.length > 1) {
      filters.push({ or: statusConditions });
    }
  }

  // Duration filter
  if (durations.length > 0) {
    const durationConditions = durations.map<FilterExpr>(duration => {
      const durationValue = parseInt(duration.replace('>', ''), 10);
      return { field: 'response.duration', op: 'gt', value: durationValue };
    });

    if (durationConditions.length === 1) {
      filters.push(durationConditions[0]);
    } else {
      filters.push({ or: durationConditions });
    }
  }
  return filters;
}
