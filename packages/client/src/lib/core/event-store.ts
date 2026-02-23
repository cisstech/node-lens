/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FilterExpr, HistoryQuery, SSEEvent, HistoryResult } from "@cisstech/node-lens-server";
import { isEventMatchingFilters } from './utils';
type Consumer<T = any> = ((event: SSEEvent<T>) => void) | { callback: (event: SSEEvent<T>) => void; filters?: () => FilterExpr[] | undefined }
type Subscriber = { subscription: Consumer; signal?: AbortSignal }

export interface EventStore {
  dispatch(event: SSEEvent): void
  list<T = any>(scope: string, opts?: HistoryQuery, signal?: AbortSignal): Promise<HistoryResult<T>>
  subscribe<T = any>(scope: string, consumer: Consumer<T>, signal?: AbortSignal): void
  clear(scope: string, eventType?: string): Promise<void>
}

export class HttpEventStore implements EventStore {
  private subs = new Map<string, Set<Subscriber>>()

  constructor(
    private readonly getOrigin: () => string,
    private readonly basePath = '/node-lens',
    private readonly getToken: () => string | undefined = () => undefined,
  ) { }

  async dispatch(event: SSEEvent): Promise<void> {
    const sets = [this.subs.get(event.scope), this.subs.get('*')]
    sets.forEach(set => {
      set?.forEach(s => {
        if (!s.signal || !s.signal.aborted) {
          const callback = typeof s.subscription === 'function' ? s.subscription : s.subscription.callback
          const filters = typeof s.subscription === 'function' ? undefined : s.subscription.filters?.()
          if (!filters || isEventMatchingFilters(event, filters))
            callback(event)
        }
      })
    })
  }

  async list<T = any>(scope: string, opts: HistoryQuery = {}, signal?: AbortSignal): Promise<HistoryResult<T>> {
    const url = new URL(`${this.basePath}/history`, this.getOrigin())
    const query = new URLSearchParams({
      scope,
      ...(opts.eventType ? { eventType: opts.eventType } : {}),
      ...(opts.limit && { limit: String(opts.limit) }),
      ...(opts.offset && { offset: String(opts.offset) }),
      ...(opts.sort && { sort: JSON.stringify(opts.sort) }),
      ...(opts.filters && { filters: JSON.stringify(opts.filters) }),
      ...(this.getToken() ? { token: this.getToken() as string } : {}),
    })
    url.search = query.toString()
    const res = await fetch(url.toString(), {
      signal,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
    })
    if (!res.ok) throw new Error(`History request failed: ${res.statusText}`)
    return res.json()
  }

  subscribe<T = any>(scope: string, consumer: Consumer<T>, signal?: AbortSignal): void {
    if (!this.subs.has(scope)) {
      this.subs.set(scope, new Set())
    }

    const entry: Subscriber = { subscription: consumer, signal }
    const set = this.subs.get(scope)
    if (!set) {
      throw new Error('Unreachable')
    }

    set.add(entry)
    if (signal) {
      const cleanup = () => { set.delete(entry); if (set.size === 0) this.subs.delete(scope) }
      if (signal.aborted) {
        cleanup()
      } else {
        signal.addEventListener('abort', cleanup, { once: true })
      }
    }
  }

  async clear(scope: string, eventType?: string): Promise<void> {
    const url = new URL(`${this.basePath}/history`, this.getOrigin())
    url.searchParams.set('scope', scope)
    if (eventType) {
      url.searchParams.set('eventType', eventType)
    }
    const token = this.getToken()
    if (token) {
      url.searchParams.set('token', token)
    }
    const res = await fetch(url.toString(), { method: 'DELETE' })
    if (!res.ok && res.status !== 204) {
      throw new Error(`Clear failed: ${res.statusText}`)
    }
  }
}
