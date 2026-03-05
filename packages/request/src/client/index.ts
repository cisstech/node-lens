/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NodeLensClient } from '@cisstech/node-lens-client';
import type { HistoryResult } from '@cisstech/node-lens-server';
import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { CollectionsEvent, PLUGIN_EVENTS, PLUGIN_NAME, VariablesEvent, type RequestEvent } from '../server/types';
import { buildFilters, emptyFilters, RequestFilters, restoreFilters } from './list/filters';

import './details/request-details';
import './details/request-timeline';
import './list/list';
import './playground/playground';

const PAGE_SIZE = 10;
const requestTabs = ['list', 'playground'] as const;
type RequestTabs = typeof requestTabs[number];

@customElement('nl-request')
export class RequestPlugin extends LitElement {
  @property({ attribute: false }) client!: NodeLensClient;

  @state() private error?: string;
  @state() private connected = false;

  @state() private requests: RequestEvent[] = [];
  @state() private variables: VariablesEvent = { variables: [] };
  @state() private collections: CollectionsEvent = { collections: [] };

  @state() private totalCount = 0;
  @state() private isLoadingMore = false;
  @state() private activeTab: RequestTabs = 'list';
  @state() private currentFilters = emptyFilters();

  private readonly abortController = new AbortController()

  override connectedCallback() {
    super.connectedCallback();
    this.restoreFilters();
    this.fetchEvents();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.abortController.abort();
  }

  override render() {
    if (this.error) return html`<div class="error">Error: ${this.error}</div>`;
    if (!this.connected) return html`<div class="loading">Connecting to request events...</div>`;

    return html`
      <div class="root">
        <nl-tabs id="request-tabs" .activeKey=${this.activeTab} @tab-click=${this.setActiveTab.bind(this)} stickyTabs>
          <nl-tab key="list" slot="tabs">Live Requests</nl-tab>
          <nl-tab key="playground" slot="tabs">Playground</nl-tab>
          <nl-tab-panel key="list" slot="panels">
            <nl-request-list
              .requests=${this.requests}
              .totalCount=${this.totalCount}
              .initialFilters=${this.currentFilters}
              @filters-change=${this.applyFilters.bind(this)}
              @request-replay=${this.replayRequest.bind(this)}
              @clear-requests=${this.clearRequests.bind(this)}
            ></nl-request-list>
            <nl-viewport-intersection @intersect=${this.fetchMoreRequests}></nl-viewport-intersection>
          </nl-tab-panel>
          <nl-tab-panel key="playground" slot="panels">
            <nl-request-playground
              .client=${this.client}
              .requests=${this.requests}
              .variables=${this.variables.variables}
              .collections=${this.collections.collections}
            </nl-request-playground>
          </nl-tab-panel>
        </nl-tabs>
      </div>
    `;
  }

  private restoreFilters(): void {
    Object.assign(this.currentFilters, restoreFilters());
  }

  private buildSort(): string[] {
    const { sortKey, sortDir } = this.currentFilters;
    let field = '';

    switch (sortKey) {
      case 'method':
        field = 'request.method';
        break;
      case 'path':
        field = 'request.path';
        break;
      case 'duration':
        field = 'response.duration';
        break;
      case 'status':
        field = 'response.statusCode';
        break;
      case 'time':
        field = 'timestamp';
        break;
    }

    return field ? [`${field}:${sortDir}`] : [];
  }

  private applyFilters(event: CustomEvent<RequestFilters>): void {
    this.currentFilters = { ...event.detail };
    // Reset the list and refetch with new filters
    this.requests = [];
    this.totalCount = 0;
    this.fetchRequests().catch((err) => {
      if (err.name !== 'AbortError') {
        console.error('[RequestPlugin] Filter fetch failed', err);
      }
    });
  }

  private replayRequest(event: CustomEvent<RequestEvent>): void {
    event.preventDefault();
    event.stopPropagation();
    this.activeTab = 'playground';
    setTimeout(() => {
      this.client.dispatchEvent(new CustomEvent('request-replay', { detail: event.detail, bubbles: true, composed: true }));
    }, 300);
  }

  private setActiveTab(e: CustomEvent<{ key: RequestTabs }>) {
    const { key } = e.detail;
    if (!(requestTabs).includes(key)) {
      return;
    }
    this.activeTab = e.detail.key;
  }

  private clearRequests(): void {
    this.requests = [];
    this.totalCount = 0;
    this.client.events.clear(PLUGIN_NAME, PLUGIN_EVENTS.REQUEST).catch((err) => {
      console.error('[RequestPlugin] Clear requests failed', err);
    });
  }

  private watchRequests(): void {
    this.client.events.subscribe<RequestEvent>(
      PLUGIN_NAME,
      {
        callback: (e) => {
          this.requests = [e.data, ...this.requests];
          this.totalCount += 1;
        },
        filters: () => buildFilters(this.currentFilters),
      },
      this.abortController!.signal,
    );
  }

  private fetchMoreRequests(): void {
    if (this.requests.length >= this.totalCount || this.isLoadingMore) {
      return;
    }
    this.isLoadingMore = true;

    this.client.events.list(
      PLUGIN_NAME,
      {
        signal: this.abortController?.signal,
        eventType: PLUGIN_EVENTS.REQUEST,
        limit: PAGE_SIZE,
        offset: this.requests.length,
        filters: buildFilters(this.currentFilters),
        sort: this.buildSort(),
      }
    ).then((res: HistoryResult<RequestEvent>) => {
      this.requests = [...this.requests, ...res.events.map((e) => e.data)];
      this.totalCount = res.totalCount;
    }).catch((err) => {
      if (err.name !== 'AbortError') {
        console.error('[RequestPlugin] Load more failed', err);
      }
    }).finally(() => {
      this.isLoadingMore = false;
    });
  }

  private async fetchRequests(): Promise<void> {
    const requests = await this.client.events.list(
      PLUGIN_NAME,
      {
        signal: this.abortController?.signal,
        eventType: PLUGIN_EVENTS.REQUEST,
        limit: PAGE_SIZE,
        filters: buildFilters(this.currentFilters),
        sort: this.buildSort(),
      }
    ) as HistoryResult<RequestEvent>;
    this.requests = requests.events.map((e) => e.data)
    this.totalCount = requests.totalCount;
  }

  private async fetchVariables(): Promise<void> {
    const variables = await this.client.events.list<VariablesEvent>(
      PLUGIN_NAME,
      {
        signal: this.abortController?.signal,
        eventType: PLUGIN_EVENTS.VARIABLES,
        limit: 1,
      }
    )
    this.variables = variables.events.length ? variables.events[0].data as VariablesEvent : { variables: [] };
  }

  private async fetchCollections(): Promise<void> {
    const collections = await this.client.events.list<CollectionsEvent>(
      PLUGIN_NAME,
      {
        signal: this.abortController?.signal,
        eventType: PLUGIN_EVENTS.COLLECTIONS,
        limit: 1,
      }
    )
    this.collections = collections.events.length ? collections.events[0].data as CollectionsEvent : { collections: [] };
  }

  private async fetchEvents(): Promise<void> {
    try {
      await Promise.allSettled([
        this.fetchRequests(),
        this.fetchVariables(),
        this.fetchCollections(),
      ])
      this.watchRequests();
      this.connected = true;
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        this.error = err.message ?? String(err);
        console.error('[RequestPlugin] Subscription failed', err);
      }
    }
  }

  static override styles = css`
    :host {
      display: block;
      height: 100%;
      font-family: var(--nl-font-family-sans);
      font-size: var(--nl-font-size-base);
      color: var(--nl-text-primary);
      background: var(--nl-surface-app);
    }
    .root {
      display: flex;
      flex-direction: column;
      gap: var(--nl-spacing-md);
      height: 100%;
    }

    .loading,
    .error {
      text-align: center;
      padding: var(--nl-spacing-lg);
      font-size: 13px;
      color: var(--nl-text-secondary);
    }
    .error {
      color: var(--nl-color-error);
    }
  `;
}
