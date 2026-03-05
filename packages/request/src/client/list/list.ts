import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { type RequestEvent } from '../../server/types';
import { calculateOperationsTimeFrame } from '../details/utils';
import { httpMethodStyles } from '../styles';
import { formatMs, formatTime } from '../utils';
import {
  FilterDuration,
  FilterMethod,
  FilterStatus,
  RequestFilters,
  SortDir,
  SortKey,
  filterDurations,
  filterMethods,
  filterStatuses,
  persistFilters
} from './filters';

@customElement('nl-request-list')
export class RequestList extends LitElement {
  @property({ attribute: false, type: Array }) requests: RequestEvent[] = [];
  @property({ attribute: false, reflect: true }) totalCount = 0;
  @property({ attribute: false }) initialFilters?: RequestFilters;

  @state() private expandedRequestId: string | null = null;
  @state() private filterText = '';
  @state() private filterMethods: FilterMethod[] = [];
  @state() private filterStatuses: FilterStatus[] = [];
  @state() private filterDurations: FilterDuration[] = [];
  @state() private sortKey: SortKey = 'time';
  @state() private sortDir: SortDir = 'desc';

  override connectedCallback() {
    super.connectedCallback();
    this.restoreFilters();
  }

  override render() {
    return html`
      <div class="container">
        ${this.renderFilters()}
        ${this.renderTitle()}
        <div class="grid">
          ${this.renderHeader()}
          ${this.requests.map((request) => this.renderRequestRow(request))}
        </div>
        ${this.requests.length === 0
          ? html`<div class="empty">No requests yet. Trigger some API calls.</div>`
          : nothing}
      </div>
    `;
  }

  private handleClear() {
    this.dispatchEvent(new CustomEvent('clear-requests', {
      bubbles: true,
      composed: true,
    }));
  }

  private renderTitle() {
    return html`
      <div class="title-bar">
        <h3 class="title">Requests (${this.totalCount})</h3>
        <nl-button variant="ghost" @click=${this.handleClear} title="Clear all requests">
          <nl-codicon icon="clear-all"></nl-codicon>
          Clear
        </nl-button>
      </div>
    `;
  }

  private renderHeader() {
    const renderSortArrow = (key: string) =>
      this.sortKey === key
        ? html`<nl-codicon icon="arrow-${this.sortDir === 'asc' ? 'up' : 'down'}"></nl-codicon>`
        : '';

    return html`
      <div class="header">
        ${['method', 'path', 'duration', 'status', 'time'].map(
          (key) => html`
            <nl-button variant="ghost" @click=${() => this.updateSort(key as SortKey)}>
              ${key.charAt(0).toUpperCase() + key.slice(1)}
              <span>${renderSortArrow(key)}</span>
            </nl-button>
          `
        )}
        <div class="placeholder">-</div>
      </div>
    `;
  }

  private renderRequestRow(request: RequestEvent) {
    const { total: traceTotal } = calculateOperationsTimeFrame(request.operations);
    const responseDuration = request.response?.duration ?? 0;
    const { pathname } = new URL(request.request.path || request.request.url, window.location.origin);

    return html`
      <div class="request-row">
        <div class="${this.getRowClass(request)}" @click=${() => this.toggleRequestDetails(request.id)}>
          <div class="cell">
            <span class="method ${request.request.method.toLowerCase()}">${request.request.method.toUpperCase()}</span>
          </div>
          <div class="cell path" title=${request.request.url || request.request.path}>
            ${pathname || '—'}
          </div>
          <div class="cell">${formatMs(traceTotal || responseDuration)}</div>
          <div class="cell no-hidden" style="color:${this.getStatusColor(request.response?.statusCode)}">
            ${request.response?.statusCode ?? '—'}
            ${this.renderStatusPill(request)}
          </div>
          <div class="cell">${formatTime(request.timestamp)}</div>
          <div class="cell action">
            <nl-button variant="ghost">
              <nl-codicon icon="chevron-${this.expandedRequestId === request.id ? 'down' : 'right'}"></nl-codicon>
            </nl-button>
          </div>
        </div>
        ${this.expandedRequestId === request.id
          ? html`<nl-request-details style="grid-column: 1 / -1;" .event=${request}></nl-request-details>`
          : nothing}
      </div>
    `;
  }

  private renderFilters() {
    return html`
      <div class="filters">
        ${this.renderFilterSelect('symbol-method', 'Methods', this.filterMethods, filterMethods)}
        ${this.renderFilterSelect('check-all', 'Status', this.filterStatuses, filterStatuses)}
        ${this.renderFilterSelect('dashboard', 'Duration', this.filterDurations, filterDurations)}
        <nl-input
          type="text"
          placeholder="Search path or method…"
          .value=${this.filterText}
          @input=${this.handleSearchInput}
          debounceTime="300"
          showClear
        ></nl-input>
      </div>
    `;
  }

  private renderFilterSelect<T extends string>(
    icon: string,
    label: string,
    values: T[],
    options: Record<T, string>
  ) {
    const selectOptions = Object.entries(options)
      .map(([key, label]) => ({ value: key, label }));

    return html`
      <div class="filter-group">
        <label class="filter-label">${label}:</label>
        <nl-select
          .multi=${true}
          .values=${values}
          .options=${selectOptions}
          placeholder="Select ${label.toLowerCase()}..."
          @change=${(e: CustomEvent) => {
            this.updateFilterValues(label.toLowerCase(), e.detail.values || []);
            this.persistFilters();
            this.notifyFiltersChange();
          }}
        >
          <nl-codicon slot="icon" icon="${icon.toLowerCase()}"></nl-codicon>
        </nl-select>
      </div>
    `;
  }

  private updateFilterValues(filterType: string, values: string[]) {
    switch (filterType) {
      case 'methods':
        this.filterMethods = values as FilterMethod[];
        break;
      case 'status':
        this.filterStatuses = values as FilterStatus[];
        break;
      case 'duration':
        this.filterDurations = values as FilterDuration[];
        break;
    }
  }

  private renderStatusPill(request: RequestEvent) {
    const status = request.response?.statusCode ?? 0;
    const duration = request.response?.duration ?? 0;

    if (status >= 500) return html`<span class="pill error">ERR</span>`;
    if (status >= 400) return html`<span class="pill warning">WARN</span>`;
    if (duration > 500) return html`<span class="pill slow">SLOW</span>`;
    return nothing;
  }

  private getRowClass(request: RequestEvent) {
    const status = request.response?.statusCode ?? 0;
    const duration = request.response?.duration ?? 0;

    if (status >= 500) return 'row error';
    if (status >= 400) return 'row warning';
    if (duration > 500) return 'row slow';
    return 'row';
  }

  private getStatusColor(status?: number) {
    if (status === undefined) return 'var(--nl-text-secondary)';
    if (status >= 500) return 'var(--nl-color-error)';
    if (status >= 400) return 'var(--nl-color-warning)';
    if (status >= 300) return 'var(--nl-text-secondary)';
    return 'var(--nl-color-success)';
  }

  private toggleRequestDetails(id: string) {
    this.expandedRequestId = this.expandedRequestId === id ? null : id;
  }

  private updateSort(key: SortKey) {
    if (this.sortKey === key) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDir = 'asc';
    }
    this.persistFilters();
    this.notifyFiltersChange();
  }

  private handleSearchInput(e: InputEvent) {
    this.filterText = (e.target as HTMLInputElement).value;
    this.persistFilters();
    this.notifyFiltersChange();
  }

  private notifyFiltersChange() {
    this.dispatchEvent(
      new CustomEvent('filters-change', {
        detail: {
          search: this.filterText,
          methods: this.filterMethods,
          statuses: this.filterStatuses,
          durations: this.filterDurations,
          sortKey: this.sortKey,
          sortDir: this.sortDir,
        } satisfies RequestFilters,
        bubbles: true,
        composed: true,
      })
    );
  }

  private persistFilters() {
    persistFilters({
      search: this.filterText,
      methods: this.filterMethods,
      statuses: this.filterStatuses,
      durations: this.filterDurations,
      sortKey: this.sortKey,
      sortDir: this.sortDir,
    });
  }

  private restoreFilters() {
    this.filterText = this.initialFilters?.search || '';
    this.filterMethods = this.initialFilters?.methods || [];
    this.filterStatuses = this.initialFilters?.statuses || [];
    this.filterDurations = this.initialFilters?.durations || [];
    this.sortKey = this.initialFilters?.sortKey || 'time';
    this.sortDir = this.initialFilters?.sortDir || 'desc';
  }

  static override styles = css`
    :host {
      display: block;
      font-family: var(--nl-font-family-sans);
      font-size: var(--nl-font-size-base);
      color: var(--nl-text-primary);
      container-type: inline-size;
    }

    .container {
      display: flex;
      flex-direction: column;
      gap: var(--nl-spacing-md);
      padding: var(--nl-spacing-md);
    }

    /* Title Bar */
    .title-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .title {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
    }

    /* Filter */
    .filters {
      display: flex;
      gap: var(--nl-spacing-md);
      align-items: center;
      flex-wrap: wrap;
    }

    .filters nl-input {
      flex: 2;
      min-width: 100%;
    }

    .filter-group {
      display: flex;
      flex-direction: column;
      gap: var(--nl-spacing-xs);
      min-width: 220px;
      max-width: 280px;
      flex: 1;
    }

    .filter-label {
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--nl-text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.025em;
    }

    /* Grid Styles */
    .grid {
      border: 1px solid var(--nl-surface-border);
      border-radius: var(--nl-border-radius);
      overflow: hidden;
    }

    .header,
    .row {
      display: grid;
      grid-template-columns: 110px 1fr 120px 90px 120px 48px;
      align-items: center;
    }

    .request-row:not(:last-child) .row {
      border-bottom: 1px solid var(--nl-surface-border);
    }

    .header {
      border-bottom: 1px solid var(--nl-surface-border);
    }

    .header nl-button {
      background: none;
      border: 0;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      height: 40px;
      padding: var(--nl-spacing-sm) var(--nl-spacing-md);
      text-align: left;
      width: 100%;
    }

    .row {
      cursor: pointer;
    }

    .cell {
      display: flex;
      align-items: center;
      gap: var(--nl-spacing-sm);
      height: 40px;
      padding: var(--nl-spacing-sm) var(--nl-spacing-md);
      overflow: hidden;
    }

    .cell.no-hidden {
      overflow: visible;
    }

    .cell.path {
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    .pill {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 999px;
      font-size: 11px;
      margin-left: 6px;
      font-weight: 600;
      flex-shrink: 0;
    }

    .pill.error {
      background: rgba(239, 68, 68, 0.15);
      color: var(--nl-color-error);
      border: 1px solid var(--nl-color-error);
    }

    .pill.warning {
      background: rgba(245, 158, 11, 0.15);
      color: var(--nl-color-warning);
      border: 1px solid var(--nl-color-warning);
    }

    .pill.slow {
      background: rgba(249, 115, 22, 0.15);
      color: var(--nl-color-primary);
      border: 1px solid var(--nl-color-primary);
    }

    .cell.action {
      justify-content: center;
    }

    .row.error > .cell:first-child {
      border-left: 4px solid var(--nl-color-error);
    }
    .row.warning > .cell:first-child {
      border-left: 4px solid var(--nl-color-warning);
    }
    .row.slow > .cell:first-child {
      border-left: 4px solid var(--nl-color-primary);
    }

    .empty {
      text-align: center;
      padding: var(--nl-spacing-lg);
      font-size: 13px;
      color: var(--nl-text-secondary);
    }

    @container (max-width: 600px) {
      .filters {
        flex-direction: column;
        align-items: stretch;
        gap: var(--nl-spacing-sm);
      }

      .filters nl-input,
      .filter-group {
        width: 100%;
        max-width: none;
        min-width: 0;
      }

      .header,
      .row {
        grid-template-columns: 80px 1fr 90px 48px;
      }

      .header > :nth-child(3),
      .header > :nth-child(5),
      .row > .cell:nth-child(3),
      .row > .cell:nth-child(5) {
        display: none;
      }
    }

    ${httpMethodStyles}
  `;
}
