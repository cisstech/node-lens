/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fsp from 'fs/promises';
import { join } from 'path';
import { FileEventStoreOptions, FilterExpr, HistoryQuery, HistoryResult, EventStore, FilterOp, SSEEvent } from './store';

interface ScopeCache {
  events: SSEEvent[];
  sequence: number;
  countsByEvent: Map<string, number>;
  dirty: boolean;
}

/**
 * File-backed event store with an in-memory authoritative buffer.
 *
 * Reads and writes are served from memory on the hot path; the ndjson file on
 * disk is a debounced projection of that buffer, so an append touches only
 * memory and trimming to the per-event-type cap happens in memory. The store is
 * single-process by design (one `nls monitor` run), so no cross-process locking
 * is needed.
 */
export class FileEventStore implements EventStore {
  private baseDir: string;
  private maxEventsDefault: number;
  private maxOverrides: Record<string, number>; // key = "scope:event"
  private flushIntervalMs: number;

  private caches = new Map<string, ScopeCache>();
  private loadPromises = new Map<string, Promise<void>>();
  private flushTimers = new Map<string, NodeJS.Timeout>();
  private flushChain = new Map<string, Promise<void>>();

  constructor(opts: FileEventStoreOptions & { flushIntervalMs?: number }) {
    this.baseDir = opts.baseDir;
    this.maxEventsDefault = opts.maxEventsPerScope ?? 100;
    this.maxOverrides = opts.maxEventsOverrides ?? {};
    this.flushIntervalMs = opts.flushIntervalMs ?? 500;
  }

  private scopeFile(scope: string): string {
    return join(this.baseDir, `${scope.replace(/\//g, '-')}.ndjson`);
  }

  private key(scope: string, event: string): string {
    return `${scope}:${event}`;
  }

  private resolveMax(scope: string, event: string): number {
    return this.maxOverrides[this.key(scope, event)] ?? this.maxEventsDefault;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private getCache(scope: string): ScopeCache {
    let cache = this.caches.get(scope);
    if (!cache) {
      cache = { events: [], sequence: 0, countsByEvent: new Map(), dirty: false };
      this.caches.set(scope, cache);
    }
    return cache;
  }

  /**
   * Loads a scope's persisted events into memory once. Concurrent callers await
   * the same promise so appends never race ahead of the initial load.
   */
  private ensureLoaded(scope: string): Promise<void> {
    let p = this.loadPromises.get(scope);
    if (!p) {
      p = this.doLoad(scope);
      this.loadPromises.set(scope, p);
    }
    return p;
  }

  private async doLoad(scope: string): Promise<void> {
    const cache = this.getCache(scope);
    try {
      const raw = await fsp.readFile(this.scopeFile(scope), 'utf8');
      for (const line of raw.split('\n')) {
        if (!line.trim()) continue;
        try {
          const e = JSON.parse(line) as SSEEvent;
          cache.events.push(e);
          cache.sequence = Math.max(cache.sequence, e.sequence ?? 0);
          cache.countsByEvent.set(e.event, (cache.countsByEvent.get(e.event) || 0) + 1);
        } catch {
          // ignore invalid lines
        }
      }
    } catch (err: any) {
      if (err.code !== 'ENOENT') throw err;
      // No file yet: the scope starts empty.
    }
  }

  private trimInMemory(cache: ScopeCache, event: string, max: number): void {
    let excess = (cache.countsByEvent.get(event) || 0) - max;
    if (excess <= 0) return;
    const kept: SSEEvent[] = [];
    for (const e of cache.events) {
      if (e.event === event && excess > 0) {
        excess--;
        continue; // drop the oldest events of this type
      }
      kept.push(e);
    }
    cache.events = kept;
    cache.countsByEvent.set(event, max);
  }

  private scheduleFlush(scope: string): void {
    this.getCache(scope).dirty = true;
    if (this.flushTimers.has(scope)) return;
    const timer = setTimeout(() => {
      this.flushTimers.delete(scope);
      void this.flush(scope);
    }, this.flushIntervalMs);
    timer.unref?.();
    this.flushTimers.set(scope, timer);
  }

  /** Writes a scope's in-memory buffer to disk, serialized per scope. */
  private flush(scope: string): Promise<void> {
    const prev = this.flushChain.get(scope) ?? Promise.resolve();
    const next = prev
      .then(async () => {
        const cache = this.getCache(scope);
        if (!cache.dirty) return;
        cache.dirty = false;
        const content = cache.events.length
          ? cache.events.map((e) => JSON.stringify(e)).join('\n') + '\n'
          : '';
        await fsp.mkdir(this.baseDir, { recursive: true });
        await fsp.writeFile(this.scopeFile(scope), content, 'utf8');
      })
      .catch((err) => {
        console.error('[NodeLens] event store flush error:', err);
      });
    this.flushChain.set(scope, next);
    return next;
  }

  /** Force any pending writes to disk (useful on shutdown). */
  async flushNow(): Promise<void> {
    for (const timer of this.flushTimers.values()) clearTimeout(timer);
    this.flushTimers.clear();
    await Promise.all([...this.caches.keys()].map((scope) => this.flush(scope)));
  }

  /**
   * Starts a fresh session: drops the in-memory buffers and deletes persisted
   * scope files so the dashboard's live view never mixes in prior runs.
   */
  async reset(): Promise<void> {
    for (const timer of this.flushTimers.values()) clearTimeout(timer);
    this.flushTimers.clear();
    this.caches.clear();
    this.loadPromises.clear();
    this.flushChain.clear();
    try {
      const files = await fsp.readdir(this.baseDir);
      await Promise.all(
        files
          .filter((f) => f.endsWith('.ndjson'))
          .map((f) => fsp.rm(join(this.baseDir, f), { force: true }))
      );
    } catch (err: any) {
      if (err.code !== 'ENOENT') throw err;
    }
  }

  private matchFilter(event: SSEEvent, filters?: FilterExpr[]): boolean {
    if (!filters) return true
    return filters.every(expr => this.evalExpr(event, expr))
  }

  private evalExpr(event: SSEEvent, expr: FilterExpr): boolean {
    if ('field' in expr) {
      const val = this.getFieldValue(event.data, expr.field)
      return this.compare(val, expr.op, expr.value)
    }
    if ('and' in expr) {
      return expr.and.every(e => this.evalExpr(event, e))
    }
    if ('or' in expr) {
      return expr.or.some(e => this.evalExpr(event, e))
    }
    return true
  }

  private compare(val: any, op: FilterOp, cmp: any): boolean {
    switch (op) {
      case 'eq': return val === cmp
      case 'ne': return val !== cmp
      case 'lt': return val < cmp
      case 'lte': return val <= cmp
      case 'gt': return val > cmp
      case 'gte': return val >= cmp
      case 'contains':
        return typeof val === 'string' ? val.includes(cmp)
          : Array.isArray(val) ? val.includes(cmp)
            : false
      case 'search': {
        if (typeof val !== 'string' || typeof cmp !== 'string') return false;
        const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
        return norm(val).includes(norm(cmp));
      }
      case 'in': return Array.isArray(cmp) && cmp.includes(val)
      case 'notIn': return Array.isArray(cmp) && !cmp.includes(val)
      default: return false
    }
  }

  /**
   * Get nested field value from event (supports "data.foo.bar")
   */
  private getFieldValue(obj: any, path: string): any {
    return path.split('.').reduce((acc, key) => acc?.[key], obj);
  }

  async append<T = any>(scope: string, event: string, data: T): Promise<SSEEvent<T>> {
    await this.ensureLoaded(scope);
    const cache = this.getCache(scope);

    const stored: SSEEvent<T> = {
      id: this.generateId(),
      scope,
      event,
      data,
      timestamp: Date.now(),
      sequence: ++cache.sequence,
    };

    cache.events.push(stored);
    cache.countsByEvent.set(event, (cache.countsByEvent.get(event) || 0) + 1);

    const max = this.resolveMax(scope, event);
    if ((cache.countsByEvent.get(event) || 0) > max) {
      this.trimInMemory(cache, event, max);
    }

    this.scheduleFlush(scope);
    return stored;
  }

  async list<T = any>(scope: string, query: HistoryQuery = {}): Promise<HistoryResult<T>> {
    await this.ensureLoaded(scope);
    const cache = this.getCache(scope);

    const limit = query.limit ?? 100;
    const offset = query.offset ?? 0;
    const eventType = query.eventType;

    const all: SSEEvent<T>[] = [];
    for (const e of cache.events as SSEEvent<T>[]) {
      if ((!eventType || e.event === eventType) && this.matchFilter(e, query.filters)) {
        all.push(e);
      }
    }

    // Sort if requested
    if (query.sort?.length) {
      // Build a single comparator from the sort definitions (primary -> secondary -> ...)
      const sortDefs = query.sort.map(def => {
        const [rawField, rawOrder] = def.split(':');
        const field = rawField.trim();
        const order = (rawOrder?.trim().toLowerCase() === 'desc') ? -1 : 1;
        const getter = (e: SSEEvent<T>) => {
          // allow sorting on top-level stored-event props or nested data fields
          if (field === 'sequence' || field === 'timestamp' || field === 'event' || field === 'id' || field === 'scope') {
            return (e as any)[field];
          }
          return this.getFieldValue(e.data, field);
        };
        return { field, order, getter };
      });

      all.sort((a, b) => {
        for (const sd of sortDefs) {
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

    const events = all.slice(offset, offset + limit);
    const totalCount = all.length;

    return { events, totalCount };
  }

  async clear(scope: string, eventType?: string): Promise<void> {
    await this.ensureLoaded(scope);
    const cache = this.getCache(scope);

    if (!eventType) {
      cache.events = [];
      cache.countsByEvent.clear();
    } else {
      cache.events = cache.events.filter((e) => e.event !== eventType);
      cache.countsByEvent.delete(eventType);
    }

    this.scheduleFlush(scope);
  }
}
