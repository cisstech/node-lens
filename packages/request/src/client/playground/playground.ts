import type { NodeLensClient } from '@cisstech/node-lens-client';
import type { ListRoutesResult } from '@cisstech/node-lens-introspection';
import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { CollectionGroup, RequestEvent, Variable } from '../../server/types';
import type { RouteInfo, VersioningInfo } from '../types';

import './main/request-editor';
import './side/request-explorer';

@customElement('nl-request-playground')
export class RequestPlayground extends LitElement {
  @property({ attribute: false }) client!: NodeLensClient;
  @property({ attribute: false }) requests: RequestEvent[] = [];
  @property({ attribute: false }) variables: Variable[] = [];
  @property({ attribute: false }) collections: CollectionGroup[] = [];

  @state() private routes: RouteInfo[] = [];
  @state() private versioning?: VersioningInfo;
  @state() private selectedRoute?: RouteInfo;

  private readonly abortController = new AbortController()

  override connectedCallback(): void {
    super.connectedCallback();
    this.loadRoutes();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.abortController.abort();
  }

  override render() {
    return html`
      <nl-split direction="horizontal">
        <div slot="start" class="pane left-pane">
          <h3>Routes Explorer</h3>
          <nl-request-explorer
            .routes=${this.routes}
            .versioning=${this.versioning}
            @route-selected=${(e: CustomEvent<RouteInfo>) => this.selectRoute(e.detail)}>
          </nl-request-explorer>
        </div>
        <div slot="end" class="pane right-pane">
          <nl-request-editor
            .client=${this.client}
            .route=${this.selectedRoute}
            .versioning=${this.versioning}
            .requests=${this.requests}
            .variables=${this.variables}
            .collections=${this.collections}
          ></nl-request-editor>
        </div>
      </nl-split>
    `;
  }

  private selectRoute(route: RouteInfo): void {
    this.selectedRoute = route;
  }

  private async loadRoutes() {
    try {
      const result = await this.client.commands.execute<ListRoutesResult>(
        '@cisstech/node-lens-introspection',
        'list-routes',
      );
      const baseRoutes = result.routes || [];
      this.versioning = result.versioning;
      this.routes = baseRoutes;

      // Client-side GraphQL operation discovery (log on error, no fallback routes)
      const endpoints = result.graphqlEndpoints || [];
      if (endpoints.length > 0) {
        const gqlRoutes = await this.generateGraphqlRoutes(endpoints);
        this.routes = this.mergeAndDedupeRoutes(baseRoutes, gqlRoutes);
      }
    } catch (err) {
      console.error('[IntrospectionPlugin] Failed to load routes:', err);
      this.routes = [];
    }
  }

  private async generateGraphqlRoutes(endpoints: string[]): Promise<RouteInfo[]> {
    const origin = this.client?.state?.appInfo?.origin ?? '';
    const toAbs = (endpoint: string) => endpoint.startsWith('http')
      ? endpoint
      : `${origin.replace(/\/$/, '')}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    const results = await Promise.all(endpoints.map(async (endpoint) => {
      const url = toAbs(endpoint);
      try {
        const { queries, mutations } = await this.fetchGraphqlOperations(url);
        const routes: RouteInfo[] = [];
        const mod = 'GraphQL';
        const ctrl = endpoint; // group by endpoint
        for (const q of queries) {
          routes.push({ method: 'query', path: endpoint, module: mod, controller: ctrl, handler: q, isGraphql: true });
        }
        for (const m of mutations) {
          routes.push({ method: 'mutation', path: endpoint, module: mod, controller: ctrl, handler: m, isGraphql: true });
        }
        return routes;
      } catch (e) {
        console.error(`[RequestPlayground] GraphQL introspection failed for ${url}:`, e);
        return [];
      }
    }));

    return results.flat();
  }

  private async fetchGraphqlOperations(url: string): Promise<{ queries: string[]; mutations: string[] }> {
    const introspectionQuery = `query IntrospectionQuery {\n  __schema {\n    queryType { fields { name } }\n    mutationType { fields { name } }\n  }\n}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: introspectionQuery })
    });
    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText}`);
    }
    type IntrospectionOp = { name?: string };
    type IntrospectionData = {
      data?: {
        __schema?: {
          queryType?: { fields?: IntrospectionOp[] };
          mutationType?: { fields?: IntrospectionOp[] };
        }
      }
    };
    const data: IntrospectionData = await res.json();
    const queries = (data?.data?.__schema?.queryType?.fields ?? []).map(f => f?.name).filter((n): n is string => !!n);
    const mutations = (data?.data?.__schema?.mutationType?.fields ?? []).map(f => f?.name).filter((n): n is string => !!n);
    return { queries, mutations };
  }

  private mergeAndDedupeRoutes(base: RouteInfo[], extra: RouteInfo[]): RouteInfo[] {
    const key = (r: RouteInfo) => `${r.method}::${r.path}::${r.handler ?? ''}`;
    const seen = new Set<string>(base.map(key));
    const merged = base.slice();
    for (const r of extra) {
      const k = key(r);
      if (!seen.has(k)) {
        seen.add(k);
        merged.push(r);
      }
    }
    return merged;
  }

  static override styles = css`
    :host {
      display: block;
      height: 100%;
      font-family: var(--nl-font-family-sans);
      font-size: var(--nl-font-size-base);
      color: var(--nl-text-primary);
    }
    nl-split {
      height: 100%;
    }

    .pane {
      height: 100%;
      overflow-y: auto;
      box-sizing: border-box;
    }

    .left-pane {
      padding-right: var(--nl-spacing-md);
    }

    .right-pane {
      padding: 0 var(--nl-spacing-md);
    }

    h3 {
      margin-top: 0;
      margin-bottom: var(--nl-spacing-md);
    }
  `;
}
