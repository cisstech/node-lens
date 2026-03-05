import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { httpMethodStyles } from '../../styles';
import type { RouteInfo } from '../../types';

@customElement('nl-request-routes')
export class RequestRoutes extends LitElement {
  @property({ type: String }) module = '';
  @property({ type: String }) controller = '';
  @property({ type: Array }) routes: RouteInfo[] = [];
  @property({ type: Boolean }) isNestApp = true;
  @property({ type: Boolean }) initialExpanded = true;

  @state() private open = true;

  override willUpdate(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('initialExpanded')) {
      this.open = this.initialExpanded;
    }
  }

  override render() {
    // For NestJS apps, show module info if available
    const showModuleName = this.isNestApp && this.module && this.module !== 'Unknown Module';
    const title = showModuleName ? this.controller : (this.controller || this.module);

    return html`
      <div class="group">
        <div class="group-header" @click=${this.toggle}>
          <span class="chevron ${this.open ? 'open' : ''}">▸</span>
          <div class="title-container">
            ${showModuleName ? html`
              <div class="module-name">${this.module}</div>
              <div class="controller-name">${this.controller}</div>
            ` : html`
              <div class="controller-name">${title}</div>
            `}
          </div>
          <span class="count">${this.routes.length}</span>
        </div>

        ${this.open
        ? html`
              <div class="routes">
                ${this.routes.map((route) => this.renderRoute(route))}
              </div>
            `
        : null}
      </div>
    `;
  }

  private toggle() {
    this.open = !this.open;
  }

  private selectRoute(route: RouteInfo) {
    this.dispatchEvent(
      new CustomEvent<RouteInfo>('route-selected', {
        detail: route,
        bubbles: true,
        composed: true,
      })
    );
  }

  private renderRoute(route: RouteInfo) {
    const versionText = route.versions
      ? Array.isArray(route.versions)
        ? route.versions.join(',')
        : route.versions
      : '';

    const showHandler = this.isNestApp && route.handler;

    return html`
      <div class="route" @click=${() => this.selectRoute(route)}>
        <span class="method ${route.method.toLowerCase()}">${route.method}</span>
        <span class="path">${route.isGraphql ? route.handler : route.path}</span>
        ${versionText ? html`<span class="version">v${versionText}</span>` : ''}
        ${showHandler ? html`<span class="handler">${route.handler}</span>` : ''}
      </div>
    `;
  }


  static override styles = css`
    :host {
      display: block;
      font-family: var(--nl-font-family-sans);
      font-size: var(--nl-font-size-base);
      color: var(--nl-text-primary);
      container-type: inline-size;
    }

    .group {
      border: 1px solid var(--nl-surface-border);
      border-radius: var(--nl-border-radius);
      background: var(--nl-surface-control);
      margin-bottom: var(--nl-spacing-sm);
      overflow: hidden;
    }

    .group-header {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
      padding: 6px 10px;
      cursor: pointer;
      background: var(--nl-surface-app);
      transition: background 0.2s;
      font-size: 13px;
    }

    .group-header:hover {
      background: var(--nl-surface-hover);
    }

    .title-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 1px;
      min-width: 0; /* Allow text truncation */
    }

    .module-name {
      font-size: 11px;
      color: var(--nl-text-secondary);
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .controller-name {
      font-size: 13px;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .count {
      margin-left: auto;
      font-size: 11px;
      color: var(--nl-text-secondary);
      background: var(--nl-surface-border);
      padding: 1px 4px;
      border-radius: 2px;
    }

    .chevron {
      display: inline-block;
      transition: transform 0.2s ease;
    }

    .chevron.open {
      transform: rotate(90deg);
    }

    .routes {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 6px 12px 10px 24px;
    }

    .route {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 6px;
      border-radius: var(--nl-border-radius);
      cursor: pointer;
      font-size: 12px;
      transition: background 0.2s;
      min-height: 24px;
    }

    .route:hover {
      background: var(--nl-surface-hover);
    }

    .path {
      flex: 1;
      font-family: var(--nl-font-family-mono, monospace);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
    }

    .handler {
      font-size: 10px;
      color: var(--nl-text-secondary);
      font-family: var(--nl-font-family-mono, monospace);
      background: var(--nl-surface-border);
      padding: 1px 4px;
      border-radius: 2px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 80px;
    }

    .version {
      font-size: 9px;
      font-weight: 600;
      padding: 1px 3px;
      border-radius: 2px;
      background: var(--nl-surface-border);
      color: var(--nl-text-secondary);
    }

    /* Responsive adjustments for small containers */
    @container (max-width: 300px) {
      .routes {
        padding: 4px 8px 6px 16px;
      }

      .route {
        gap: 4px;
        font-size: 11px;
      }

      .handler {
        display: none; /* Hide handler on very small screens */
      }

      .module-name {
        font-size: 10px;
      }

      .controller-name {
        font-size: 12px;
      }
    }

    ${httpMethodStyles}
  `;
}
