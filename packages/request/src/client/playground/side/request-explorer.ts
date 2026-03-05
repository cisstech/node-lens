import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { RouteInfo, VersioningInfo } from '../../types';

import './request-routes';

@customElement('nl-request-explorer')
export class RequestExplorer extends LitElement {
  @property({ attribute: false }) routes: RouteInfo[] = [];
  @property({ attribute: false }) versioning?: VersioningInfo;

  @state() private filter = '';
  @state() private selectedIndex = -1;
  @state() private allExpanded = true;

  private get isNestApp(): boolean {
    // Consider Nest app only if there is a non-GraphQL route with module/controller/handler
    return this.routes.some(route => !route.isGraphql && (route.module || route.controller || route.handler));
  }

  private get flatRoutes(): RouteInfo[] {
    return this.filteredRoutes;
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    const flatRoutes = this.flatRoutes;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.selectedIndex = Math.min(this.selectedIndex + 1, flatRoutes.length - 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (this.selectedIndex >= 0 && flatRoutes[this.selectedIndex]) {
          this.selectRoute(flatRoutes[this.selectedIndex]);
        }
        break;
      case 'Escape':
        this.filter = '';
        this.selectedIndex = -1;
        break;
    }
  };

  private selectRoute(route: RouteInfo) {
    this.dispatchEvent(
      new CustomEvent<RouteInfo>('route-selected', {
        detail: route,
        bubbles: true,
        composed: true,
      })
    );
  }

  private toggleAllGroups() {
    this.allExpanded = !this.allExpanded;
    this.dispatchEvent(
      new CustomEvent('toggle-all-groups', {
        detail: { expanded: this.allExpanded },
        bubbles: true,
        composed: true,
      })
    );
  }

  override connectedCallback() {
    super.connectedCallback();
    this.addEventListener('keydown', this.handleKeyDown);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('keydown', this.handleKeyDown);
  }

  private get filteredRoutes(): RouteInfo[] {
    if (!this.filter.trim()) return this.routes;
    const query = this.filter.trim().toLowerCase();

    return this.routes.filter((route) => {
      const parts = query.split(/\s+/);
      return parts.every((part) => {
        if (part.includes(':')) {
          const [key, value] = part.split(':');
          switch (key) {
            case 'method':
              return route.method.toLowerCase() === value.toLowerCase();
            case 'module':
              return this.isNestApp && (route.module || '').toLowerCase().includes(value);
            case 'controller':
              return this.isNestApp && (route.controller || '').toLowerCase().includes(value);
            case 'handler':
              return this.isNestApp && (route.handler || '').toLowerCase().includes(value);
            default:
              return false;
          }
        }

        // Basic search terms
        const searchTargets = [
          route.method.toLowerCase(),
          route.path.toLowerCase()
        ];

        // Add NestJS-specific search targets only if it's a Nest app
        if (this.isNestApp) {
          searchTargets.push(
            (route.module || '').toLowerCase(),
            (route.controller || '').toLowerCase(),
            (route.handler || '').toLowerCase()
          );
        }

        return searchTargets.some(target => target.includes(part));
      });
    });
  }

  override render() {
    const groups = this.groupRoutes(this.filteredRoutes);

    return html`
      <div class="explorer">
        <div class="filter-bar">
          <div class="search-row">
            <nl-input
              placeholder="${this.isNestApp
                ? 'Search… (ex: GET /users, module:Auth, controller:User, handler:findAll)'
                : 'Search… (ex: GET /users, method:POST)'}"
              .value=${this.filter}
              @input=${(e: InputEvent) =>
                (this.filter = (e.target as HTMLInputElement).value)}
            ></nl-input>
            <button
              class="collapse-button"
              @click=${this.toggleAllGroups}
              title=${this.allExpanded ? 'Collapse All' : 'Expand All'}
            >
              ${this.allExpanded ? '⊟' : '⊞'}
            </button>
          </div>
        </div>

        <div class="groups">
          ${Object.entries(groups).map(
            ([module, controllers]) => html`
              ${Object.entries(controllers).map(
                ([controller, routes]) => html`
                  <nl-request-routes
                    .module=${module}
                    .controller=${controller}
                    .routes=${routes}
                    .selectedRoute=${this.selectedIndex >= 0 ? this.flatRoutes[this.selectedIndex] : null}
                    .isNestApp=${this.isNestApp}
                    .initialExpanded=${this.allExpanded}
                    @toggle-all-groups=${() => this.toggleAllGroups()}
                  ></nl-request-routes>
                `,
              )}
            `,
          )}
          ${this.routes.length === 0
            ? html`<div class="empty">
                <div class="empty-icon"><nl-codicon icon="search"></nl-codicon></div>
                <div class="empty-title">No routes available</div>
                <div class="empty-subtitle">Make sure your app is running and routes are available</div>
              </div>`
            : null}
          ${this.routes.length > 0 && this.filteredRoutes.length === 0
            ? html`<div class="empty">
                <div class="empty-icon"><nl-codicon icon="search"></nl-codicon></div>
                <div class="empty-title">No routes match your search</div>
                <div class="empty-subtitle">Try searching for: method, path${this.isNestApp ? ', controller, or handler name' : ''}</div>
              </div>`
            : null}
        </div>
      </div>
    `;
  }

  private groupRoutes(filtered: RouteInfo[]) {
    const groups: Record<string, Record<string, RouteInfo[]>> = {};

    if (this.isNestApp) {
      // NestJS grouping: module → controller → routes
      for (const r of filtered) {
        const module = r.module || 'Unknown Module';
        const controller = r.controller || 'Unknown Controller';
        if (!groups[module]) groups[module] = {};
        if (!groups[module][controller]) groups[module][controller] = [];
        groups[module][controller].push(r);
      }
    } else {
      // Express/Fastify grouping: group by path prefix
      for (const r of filtered) {
        const pathParts = r.path.split('/').filter(Boolean);
        const group = pathParts.length > 0 ? `/${pathParts[0]}` : '/';
        const controller = 'Routes';
        if (!groups[group]) groups[group] = {};
        if (!groups[group][controller]) groups[group][controller] = [];
        groups[group][controller].push(r);
      }
    }

    return groups;
  }

  static override styles = css`
    :host {
      display: block;
      height: 100%;
      font-family: var(--nl-font-family-sans);
      font-size: var(--nl-font-size-base);
      color: var(--nl-text-primary);
    }
    .explorer {
      display: flex;
      flex-direction: column;
      height: 100%;
    }


    .filter-bar {
      flex-shrink: 0;
      padding: 0;
      position: sticky;
      top: 0;
      z-index: 1;
    }

    .search-row {
      display: flex;
      gap: var(--nl-spacing-xs);
      align-items: center;
    }

    .collapse-button {
      flex-shrink: 0;
      background: var(--nl-surface-control);
      border: 1px solid var(--nl-surface-border);
      border-radius: var(--nl-border-radius);
      padding: 6px 8px;
      cursor: pointer;
      font-size: 12px;
      transition: background 0.2s;
      color: var(--nl-text-primary);
    }

    .collapse-button:hover {
      background: var(--nl-surface-hover);
    }

    nl-input {
      flex: 1;
    }

    .groups {
      flex: 1;
      overflow-y: auto;
      padding: var(--nl-spacing-sm);
      display: flex;
      flex-direction: column;
      gap: var(--nl-spacing-sm);
    }



    .empty {
      padding: var(--nl-spacing-lg);
      text-align: center;
      color: var(--nl-text-secondary);
    }

    .empty-icon {
      font-size: 32px;
      margin-bottom: var(--nl-spacing-sm);
    }

    .empty-title {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: var(--nl-spacing-xs);
    }

    .empty-subtitle {
      font-size: 12px;
      opacity: 0.8;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'nl-request-explorer': RequestExplorer;
  }
}
