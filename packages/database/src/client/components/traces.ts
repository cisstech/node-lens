import type { NodeLensClient } from '@cisstech/node-lens-client'
import { LitElement, css, html, nothing } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

import type { DatabaseQuerySpan, DatabaseTrace } from '../../server/types.js'
import { PLUGIN_EVENTS, PLUGIN_NAME } from '../../server/types.js'
import type { FilterState, TraceViewState } from '../types.js'
import { ActionService } from '../services/action-service.js'
import { FilterService } from '../utils/filter-utils.js'
import { TraceService } from '../services/trace-service.js'

const DEFAULT_FILTER_STATE: FilterState = {
  search: '',
  filter: 'all',
  dbEngine: 'all',
  durationFilter: 'all',
  resourceFilter: '',
  queryTypeFilter: 'all',
  timeRangeFilter: 'all'
}

@customElement('nl-database-traces')
export class DatabaseTraces extends LitElement {
  @property({ type: Object }) client!: NodeLensClient

  @state() private traceState: TraceViewState = {
    traces: [],
    view: [],
    totalCount: 0,
    loading: true,
    error: null,
    isLoadingMore: false
  }
  @state() private filterState: FilterState = { ...DEFAULT_FILTER_STATE }
  @state() private showAdvancedFilters = false

  private traceService!: TraceService
  private actionService!: ActionService
  private filterService!: FilterService

  override connectedCallback() {
    super.connectedCallback()
    this.initializeServices()
    this.loadInitialData()
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this.traceService?.destroy()
  }

  private initializeServices() {
    this.traceService = new TraceService(this.client, {
      pluginName: PLUGIN_NAME,
      eventType: PLUGIN_EVENTS.QUERY,
      pageSize: 10
    })

    this.actionService = new ActionService(this.client)
    this.filterService = new FilterService({
      slowThreshold: 80,
      duplicateBurstThreshold: 5
    })
  }

  private async loadInitialData() {
    try {
      this.traceState = await this.traceService.initialize()
      this.setupTraceSubscription()
      this.applyFilters()
    } catch (error) {
      console.error('[DatabaseTraces] Failed to load initial data:', error)
      this.traceState = {
        ...this.traceState,
        loading: false,
        error: 'Failed to load traces'
      }
    }
  }

  private setupTraceSubscription() {
    this.traceService.subscribeToTraces((newTrace: DatabaseTrace) => {
      this.traceState = {
        ...this.traceState,
        traces: [newTrace, ...this.traceState.traces],
        totalCount: this.traceState.totalCount + 1
      }
      this.applyFilters()
    })
  }

  private applyFilters() {
    const filteredTraces = this.filterService.applyFilters(
      this.traceState.traces,
      this.filterState
    )

    this.traceState = {
      ...this.traceState,
      view: filteredTraces
    }
  }

  private async loadMoreTraces() {
    if (!this.traceService.canLoadMore(this.traceState.traces.length, this.traceState.totalCount) ||
      this.traceState.isLoadingMore) {
      return
    }

    this.traceState = { ...this.traceState, isLoadingMore: true }

    try {
      const result = await this.traceService.loadMore(this.traceState.traces)
      this.traceState = {
        ...this.traceState,
        traces: result.traces,
        totalCount: result.totalCount,
        isLoadingMore: false
      }
      this.applyFilters()
    } catch (error) {
      console.error('[DatabaseTraces] Failed to load more traces:', error)
      this.traceState = { ...this.traceState, isLoadingMore: false }
    }
  }

  // Filter event handlers
  private onSearchChange(e: CustomEvent) {
    this.filterState = {
      ...this.filterState,
      search: (e.target as HTMLInputElement).value || ''
    }
    this.applyFilters()
  }

  private setFilter(filter: FilterState['filter']) {
    this.filterState = { ...this.filterState, filter }
    this.applyFilters()
  }

  private setDbEngine(dbEngine: string) {
    this.filterState = { ...this.filterState, dbEngine }
    this.applyFilters()
  }

  private setDurationFilter(durationFilter: FilterState['durationFilter']) {
    this.filterState = { ...this.filterState, durationFilter }
    this.applyFilters()
  }

  private setQueryTypeFilter(queryTypeFilter: string) {
    this.filterState = { ...this.filterState, queryTypeFilter }
    this.applyFilters()
  }

  private setTimeRangeFilter(timeRangeFilter: FilterState['timeRangeFilter']) {
    this.filterState = { ...this.filterState, timeRangeFilter }
    this.applyFilters()
  }

  private onResourceFilterChange(e: CustomEvent) {
    this.filterState = {
      ...this.filterState,
      resourceFilter: (e.target as HTMLInputElement).value || ''
    }
    this.applyFilters()
  }

  private toggleAdvancedFilters() {
    this.showAdvancedFilters = !this.showAdvancedFilters
  }

  private resetAllFilters() {
    this.filterState = { ...DEFAULT_FILTER_STATE }
    this.applyFilters()
  }

  private async clearTraces() {
    try {
      // Clear events from the server
      await this.traceService.clearTraces()

      // Clear local state
      this.traceState = {
        ...this.traceState,
        traces: [],
        view: [],
        totalCount: 0
      }
    } catch (error) {
      console.error('[DatabaseTraces] Failed to clear traces:', error)
    }
  }

  override render() {
    if (this.traceState.loading) {
      return html`
        <div class="state">
          <nl-codicon icon="loading"></nl-codicon>
          <div>Loading...</div>
        </div>
      `
    }

    return html`
      ${this.renderHeader()}
      <div class="content-area">
        ${this.renderTraceList()}
        <nl-viewport-intersection @intersect=${this.loadMoreTraces}></nl-viewport-intersection>
      </div>
    `
  }

  private renderHeader() {
    return html`
      <header>
        <div class="toolbar">
          <div class="filters">
            ${(['all', 'errors', 'slow', 'n1', 'http', 'background'] as const).map(f => html`
              <nl-button
                variant=${this.filterState.filter === f ? 'primary' : 'secondary'}
                @click=${() => this.setFilter(f)}
              >
                <nl-codicon icon=${this.getFilterIcon(f)}></nl-codicon>
                ${this.getFilterLabel(f)}
              </nl-button>
            `)}
          </div>

          <div class="search-container">
            <nl-input
              placeholder="Search routes, methods, queries, resources..."
              .value=${this.filterState.search}
              @input=${this.onSearchChange}
              debounceTime="300"
            >
              <nl-codicon slot="prefix" icon="search"></nl-codicon>
            </nl-input>
          </div>

          <div class="filter-actions">
            <nl-button
              variant="ghost"
              @click=${this.toggleAdvancedFilters}
              title="Toggle advanced filters"
            >
              <nl-codicon icon="settings-gear"></nl-codicon>
              ${this.showAdvancedFilters ? 'Hide' : 'Show'} Advanced
            </nl-button>
            <nl-button
              variant="ghost"
              @click=${this.resetAllFilters}
              title="Reset all filters"
            >
              <nl-codicon icon="clear-all"></nl-codicon>
              Reset filters
            </nl-button>
            <nl-button
              variant="ghost"
              @click=${this.clearTraces}
              title="Clear all traces"
            >
              <nl-codicon icon="trash"></nl-codicon>
              Clear traces
            </nl-button>
          </div>
        </div>

        ${this.showAdvancedFilters ? this.renderAdvancedFilters() : nothing}
      </header>
    `
  }

  private renderAdvancedFilters() {
    return html`
      <div class="advanced-filters">
        <div class="filter-group">
          <label class="filter-label">Database:</label>
          <nl-select
            .options=${this.filterService.getDatabaseEngineOptions(this.traceState.traces)}
            .value=${this.filterState.dbEngine}
            @change=${(e: CustomEvent) => this.setDbEngine(e.detail.value)}
          >
            <nl-codicon slot="icon" icon="database"></nl-codicon>
          </nl-select>
        </div>

        <div class="filter-group">
          <label class="filter-label">Duration:</label>
          <nl-select
            .options=${FilterService.getDurationFilterOptions()}
            .value=${this.filterState.durationFilter}
            @change=${(e: CustomEvent) => this.setDurationFilter(e.detail.value)}
          >
            <nl-codicon slot="icon" icon="watch"></nl-codicon>
          </nl-select>
        </div>

        <div class="filter-group">
          <label class="filter-label">Query Type:</label>
          <nl-select
            .options=${this.filterService.getQueryTypeOptions(this.traceState.traces)}
            .value=${this.filterState.queryTypeFilter}
            @change=${(e: CustomEvent) => this.setQueryTypeFilter(e.detail.value)}
          >
            <nl-codicon slot="icon" icon="code"></nl-codicon>
          </nl-select>
        </div>

        <div class="filter-group">
          <label class="filter-label">Time Range:</label>
          <nl-select
            .options=${FilterService.getTimeRangeFilterOptions()}
            .value=${this.filterState.timeRangeFilter}
            @change=${(e: CustomEvent) => this.setTimeRangeFilter(e.detail.value)}
          >
            <nl-codicon slot="icon" icon="clock"></nl-codicon>
          </nl-select>
        </div>

        <div class="filter-group">
          <label class="filter-label">Resource:</label>
          <nl-input
            placeholder="Filter by table/collection..."
            .value=${this.filterState.resourceFilter}
            @input=${this.onResourceFilterChange}
            showClear
          >
            <nl-codicon slot="prefix" icon="bookmark"></nl-codicon>
          </nl-input>
        </div>

        <div class="filter-stats">
          <span class="filter-count">
            <nl-codicon icon="filter"></nl-codicon>
            ${this.traceState.view.length} of ${this.traceState.traces.length} traces
          </span>
        </div>
      </div>
    `
  }

  private renderTraceList() {
    if (this.traceState.view.length === 0) {
      return html`
        <div class="empty">
          <div class="empty-icon">
            <nl-codicon icon="database"></nl-codicon>
          </div>
          <div class="empty-message">No traces</div>
        </div>
      `
    }

    return html`
      <div class="trace-list">
        ${this.traceState.view.map((trace: DatabaseTrace) => this.renderTraceItem(trace))}
      </div>
    `
  }

  private renderTraceItem(trace: DatabaseTrace) {
    const hasIssues = trace.queries.some((q: DatabaseQuerySpan) => q.error) ||
      trace.warnings.length > 0 ||
      trace.duplicateGroups.length > 0

    return html`
      <nl-database-trace-item
        .trace=${trace}
        .hasIssues=${hasIssues}
        .actionService=${this.actionService}
      ></nl-database-trace-item>
    `
  }

  private getFilterIcon(filter: string): string {
    const icons = {
      all: 'list-unordered',
      errors: 'error',
      slow: 'watch',
      n1: 'warning',
      http: 'globe',
      background: 'server-process'
    }
    return icons[filter as keyof typeof icons] || 'list-unordered'
  }

  private getFilterLabel(filter: string): string {
    const labels = {
      all: 'All',
      errors: 'Errors',
      slow: 'Slow > 80ms',
      n1: 'N+1',
      http: 'HTTP',
      background: 'Background'
    }
    return labels[filter as keyof typeof labels] || filter
  }

  static override styles = css`
    :host {
      display: block;
      overflow: auto;
      width: 100%;
      height: 100%;
      font-family: var(--nl-font-family-sans);
      font-size: var(--nl-font-size-base);
      line-height: var(--nl-line-height-base);
      color: var(--nl-text-primary);
      container-type: inline-size;
    }

    .content-area {
      flex: 1;
      padding: var(--nl-spacing-lg);
      display: flex;
      flex-direction: column;
      gap: var(--nl-spacing-lg);
    }

    header {
      border-bottom: 1px solid var(--nl-surface-border);
      padding: var(--nl-spacing-lg);
      display: flex;
      flex-direction: column;
      gap: var(--nl-spacing-md);
      flex-shrink: 0;
    }

    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--nl-spacing-md);
      flex-wrap: wrap;
    }

    .filters {
      display: flex;
      align-items: center;
      gap: var(--nl-spacing-xs);
      flex-wrap: wrap;
    }

    .search-container {
      flex: 1;
      min-width: 200px;
      max-width: 300px;
    }

    .filter-actions {
      display: flex;
      align-items: center;
      gap: var(--nl-spacing-xs);
    }

    .advanced-filters {
      display: flex;
      gap: var(--nl-spacing-md);
      align-items: center;
      flex-wrap: wrap;
      border-top: 1px solid var(--nl-surface-border);
      padding-top: var(--nl-spacing-md);
      margin-top: var(--nl-spacing-md);
    }

    .filter-group {
      display: flex;
      flex-direction: column;
      gap: var(--nl-spacing-xs);
      min-width: 180px;
      width: 180px;
      flex-shrink: 0;
    }

    .filter-group:has(nl-input) {
      flex: 1;
      min-width: 200px;
      width: auto;
    }

    .filter-label {
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--nl-text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.025em;
    }

    @container (max-width: 768px) {
      .toolbar {
        flex-direction: column;
        align-items: stretch;
        gap: var(--nl-spacing-sm);
      }

      .search-container {
        max-width: none;
        order: 3;
      }

      .filters {
        order: 1;
        justify-content: flex-start;
        gap: var(--nl-spacing-xs);
      }

      .filter-actions {
        order: 2;
        justify-content: flex-start;
        flex-wrap: wrap;
      }

      .advanced-filters {
        flex-direction: column;
        align-items: stretch;
        gap: var(--nl-spacing-sm);
      }

      .filter-group {
        width: 100%;
        min-width: auto;
      }

      .filter-group:has(nl-input) {
        min-width: auto;
      }
    }

    .filter-stats {
      display: flex;
      align-items: center;
      margin-left: auto;
    }

    .filter-count {
      display: flex;
      align-items: center;
      gap: var(--nl-spacing-xs);
      font-size: 0.8rem;
      color: var(--nl-text-secondary);
      padding: var(--nl-spacing-xs) var(--nl-spacing-sm);
      border: 1px solid var(--nl-surface-border);
      border-radius: var(--nl-border-radius);
    }

    .trace-list {
      display: flex;
      flex-direction: column;
      gap: var(--nl-spacing-md);
    }

    .state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 200px;
      color: var(--nl-text-secondary);
      gap: var(--nl-spacing-sm);
      text-align: center;
    }

    .state-error {
      color: var(--nl-color-error);
    }

    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 300px;
      color: var(--nl-text-secondary);
      gap: var(--nl-spacing-sm);
      text-align: center;
      padding: var(--nl-spacing-xl);
    }

    .empty-icon {
      opacity: 0.5;
      font-size: 2rem;
    }

    .empty-message {
      font-size: 0.9rem;
      line-height: 1.4;
    }
  `
}

declare global {
  interface HTMLElementTagNameMap {
    'nl-database-traces': DatabaseTraces
  }
}
