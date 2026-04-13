/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NodeLensClient } from '@cisstech/node-lens-client';
import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ListRoutesResult, NestModuleInfo, NestProviderInfo, PLUGIN_COMMANDS, PLUGIN_NAME, RouteInfo } from '../server/types';

@customElement('nl-introspection')
export class IntrospectionPlugin extends LitElement {
  @property({ attribute: false }) client!: NodeLensClient;

  @state() private modules: NestModuleInfo[] = [];
  @state() private providers: NestProviderInfo[] = [];
  @state() private routes: RouteInfo[] = [];
  @state() private connected = false;
  @state() private errorMessage: string | null = null;
  @state() private activeTab: 'modules' | 'providers' | 'routes' = 'modules';
  @state() private filter = '';
  @state() private loading = false;

  override connectedCallback() {
    super.connectedCallback();
    this.loadData();
  }

  private async loadData() {
    this.loading = true;
    this.errorMessage = null;

    try {
      await Promise.all([
        this.loadModules(),
        this.loadProviders(),
        this.loadRoutes()
      ]);
      this.connected = true;
    } catch (err: any) {
      this.errorMessage = err.message ?? String(err);
      console.error('[IntrospectionPlugin] Failed to load data:', err);
    } finally {
      this.loading = false;
    }
  }

  private async loadModules() {
    try {
      this.modules = await this.client.commands.execute<NestModuleInfo[]>(
        PLUGIN_NAME,
        PLUGIN_COMMANDS.LIST_MODULES
      ) || [];
    } catch (err) {
      console.error('[IntrospectionPlugin] Failed to load modules:', err);
      this.modules = [];
    }
  }

  private async loadProviders() {
    try {
      this.providers = await this.client.commands.execute<NestProviderInfo[]>(
        PLUGIN_NAME,
        PLUGIN_COMMANDS.LIST_PROVIDERS,
        { filter: this.filter }
      ) || [];
    } catch (err) {
      console.error('[IntrospectionPlugin] Failed to load providers:', err);
      this.providers = [];
    }
  }

  private async loadRoutes() {
    try {
      const result = await this.client.commands.execute<ListRoutesResult>(
        PLUGIN_NAME,
        PLUGIN_COMMANDS.LIST_ROUTES,
        { filter: this.filter }
      );
      this.routes = result.routes || [];
    } catch (err) {
      console.error('[IntrospectionPlugin] Failed to load routes:', err);
      this.routes = [];
    }
  }

  private async refreshData() {
    await this.loadData();
  }

  private async onFilterChange(e: InputEvent) {
    this.filter = (e.target as HTMLInputElement).value;
    // Reload providers and routes with new filter
    await Promise.all([
      this.loadProviders(),
      this.loadRoutes()
    ]);
  }

  private renderModules() {
    if (this.modules.length === 0) {
      return html`<div class="empty">No modules found</div>`;
    }

    return html`
      <div class="list">
        ${this.modules.map((m) => html`
          <details>
            <summary><span class="module">${m.name}</span> ${m.isGlobal ? html`<span class="tag">Global</span>` : nothing}</summary>
            <div class="section"><strong>Imports:</strong> ${m.imports.map((i) => i.name).join(', ') || '—'}</div>
            <div class="section"><strong>Providers:</strong> ${m.providers.map((p) => p.name).join(', ') || '—'}</div>
            <div class="section"><strong>Controllers:</strong> ${m.controllers.join(', ') || '—'}</div>
            <div class="section"><strong>Exports:</strong> ${m.exports.map((e: any) => e.name || e).join(', ') || '—'}</div>
          </details>
        `)}
      </div>
    `;
  }

  private providerTypeColor(type: NestProviderInfo['type']) {
    switch (type) {
      case 'guard': return 'var(--nl-color-warning, #f59e0b)';
      case 'interceptor': return 'var(--nl-color-primary, #3b82f6)';
      case 'pipe': return 'var(--nl-color-success, #22c55e)';
      case 'middleware': return 'var(--nl-color-error, #ef4444)';
      case 'service': return 'var(--nl-text-primary)';
      default: return 'var(--nl-text-secondary)';
    }
  }

  private renderProviders() {
    if (this.providers.length === 0) {
      return html`<div class="empty">No providers found</div>`;
    }

    return html`
      <div class="list">
        ${this.providers.map((p) => html`
          <details>
            <summary>
              <span class="provider" style="color:${this.providerTypeColor(p.type)}">${p.name}</span>
              <span class="tag">${p.type}</span>
            </summary>
            <div class="methods">
              ${p.methods.length
        ? p.methods.map((m) => html`<div class="method">${m}()</div>`)
        : html`<div class="empty">No methods</div>`}
            </div>
          </details>
        `)}
      </div>
    `;
  }

  private renderRoutes() {
    if (this.routes.length === 0) {
      return html`<div class="empty">No routes found</div>`;
    }

    return html`
      <div class="routes">
        ${this.routes.map((r) => html`
          <div class="route">
            <span class="method-tag">${r.method}</span>
            <span class="path">${r.path}</span>
            <span class="ctrl">${r.controller}.${r.handler}()</span>
            <span class="muted">${r.module}</span>
          </div>
        `)}
      </div>
    `;
  }

  override render() {
    if (this.errorMessage) {
      return html`
        <div class="error">
          Error: ${this.errorMessage}
          <button @click=${this.refreshData}>Retry</button>
        </div>
      `;
    }

    if (this.loading) {
      return html`<div class="loading">Loading introspection data…</div>`;
    }

    if (!this.connected) {
      return html`<div class="loading">Connecting to introspection plugin…</div>`;
    }

    return html`
      <div class="root">
        <div class="header">
          <h3 class="title">Application Introspection</h3>
          <div class="controls">
            <nl-input
              type="text"
              placeholder="Filter providers and routes…"
              .value=${this.filter}
              @input=${this.onFilterChange}
            ></nl-input>
            <button @click=${this.refreshData} ?disabled=${this.loading}>
              ${this.loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        <nl-tabs .activeKey=${this.activeTab} @change=${(e: CustomEvent) => (this.activeTab = e.detail.key)}>
          <nl-tab slot="tabs" key="modules">Modules</nl-tab>
          <nl-tab slot="tabs" key="providers">Providers</nl-tab>
          <nl-tab slot="tabs" key="routes">Routes</nl-tab>

          <nl-tab-panel slot="panels" key="modules">${this.renderModules()}</nl-tab-panel>
          <nl-tab-panel slot="panels" key="providers">${this.renderProviders()}</nl-tab-panel>
          <nl-tab-panel slot="panels" key="routes">${this.renderRoutes()}</nl-tab-panel>
        </nl-tabs>
      </div>
    `;
  }

  static override styles = css`
    :host {
      display: block;
      overflow-y: auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      gap: 16px;
    }
    .title {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
    }
    .controls {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .controls button {
      padding: 4px 8px;
      font-size: 12px;
      border: 1px solid var(--nl-surface-border);
      background: var(--nl-surface-control);
      border-radius: var(--nl-border-radius);
      cursor: pointer;
    }
    .controls button:hover {
      background: var(--nl-surface-hover);
    }
    .controls button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .empty {
      text-align: center;
      padding: var(--nl-spacing-lg);
      color: var(--nl-text-secondary);
      font-style: italic;
    }
    .list {
      display: grid;
      gap: 8px;
    }
    summary {
      cursor: pointer;
      font-weight: 600;
    }
    .module {
      color: var(--nl-color-primary, #3b82f6);
    }
    .provider {
      font-family: ui-monospace, monospace;
    }
    .tag {
      font-size: 11px;
      background: var(--nl-surface-control);
      border: 1px solid var(--nl-surface-border);
      border-radius: 999px;
      padding: 1px 6px;
      margin-left: 6px;
    }
    .methods {
      margin-top: 4px;
      padding-left: 12px;
    }
    .method {
      font-size: 12px;
      font-family: ui-monospace, monospace;
      color: var(--nl-text-secondary);
    }
    .routes {
      display: grid;
      gap: 4px;
      font-size: 12px;
    }
    .route {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .method-tag {
      font-weight: 700;
      padding: 2px 6px;
      border-radius: var(--nl-border-radius);
      font-size: 11px;
      background: var(--nl-surface-control);
      color: var(--nl-color-primary, #3b82f6);
    }
    .path {
      font-family: ui-monospace, monospace;
      flex: 1;
    }
    .ctrl {
      font-family: ui-monospace, monospace;
    }
    .muted {
      color: var(--nl-text-secondary);
    }
    .loading,
    .error {
      text-align: center;
      padding: var(--nl-spacing-lg);
      font-size: 13px;
      color: var(--nl-text-secondary);
    }
    .error {
      color: #b91c1c;
    }
    .error button {
      margin-left: 8px;
      padding: 4px 8px;
      font-size: 12px;
      border: 1px solid currentColor;
      background: transparent;
      border-radius: var(--nl-border-radius);
      cursor: pointer;
    }
  `;
}
