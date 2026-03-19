import { LitElement, css, html } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { nothing } from 'lit'

import type { DatabaseTrace, DatabaseQuerySpan } from '../../server/types.js'
import type { ActionService } from '../services/action-service.js'
import type { ActionResult } from '../types.js'
import { formatDuration, calculateTimelinePosition } from '../utils/format-utils.js'
import { DatabaseSystemRegistry } from '../utils/database-utils.js'
import { QueryFormatter } from '../utils/query-utils.js'

@customElement('nl-database-trace-item')
export class DatabaseTraceItem extends LitElement {
  @property({ type: Object }) trace!: DatabaseTrace
  @property({ type: Boolean }) hasIssues = false
  @property({ type: Object }) actionService!: ActionService

  @state() private actionResults = new Map<string, ActionResult>()
  private boundHandleActionResult = this.handleActionResult.bind(this)

  override connectedCallback() {
    super.connectedCallback()
    this.actionService.addEventListener('action-result', this.boundHandleActionResult)
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this.actionService.removeEventListener('action-result', this.boundHandleActionResult)
  }

  private handleActionResult(event: Event) {
    const customEvent = event as CustomEvent<ActionResult>
    const result = customEvent.detail
    // Only handle results for queries in this trace
    if (this.trace.queries.some(q => q.spanId === result.queryId)) {
      this.actionResults.set(result.queryId, result)
      this.requestUpdate()
    }
  }

  private renderTimeline() {
    const start = this.trace.startTimeMs
    const pins = this.trace.queries.map(q => {
      const position = calculateTimelinePosition(
        q.startTimeMs,
        q.startTimeMs + q.durationMs,
        start,
        this.trace.endTimeMs
      )
      return html`
        <div
          class="timeline-pin"
          style="left:${position.left}%"
          title="${q.operation} - ${formatDuration(q.durationMs)}"
        ></div>
      `
    })

    const burstStart = Math.min(...this.trace.queries.map(q => q.startTimeMs - start))
    const burstEnd = Math.max(...this.trace.queries.map(q => q.startTimeMs - start + q.durationMs))

    return html`
      <div class="timeline-section">
        <div class="section-title">Timeline in request</div>
        <div class="timeline-strip">${pins}</div>
        <div class="timeline-desc">
          DB burst between +${formatDuration(burstStart)} and +${formatDuration(burstEnd)} in ${this.trace.context} flow
        </div>
      </div>
    `
  }

  private renderQueries() {
    return html`
      <div class="section">
        <div class="section-title">
          <nl-codicon icon="database"></nl-codicon>
          Queries (${this.trace.queries.length})
        </div>
        <div class="query-accordion">
          ${this.trace.queries.map(q => this.renderQuery(q))}
        </div>
      </div>
    `
  }

  private renderQuery(query: DatabaseQuerySpan) {
    const isSlow = QueryFormatter.isSlowQuery(query)
    const hasError = QueryFormatter.hasError(query)
    const systemInfo = DatabaseSystemRegistry.getSystemInfo(query.dbSystem)

    return html`
      <details class="query ${hasError ? 'error' : ''}">
        <summary class="query-head">
          <div class="query-title">
            <div class="query-operation">
              <span class="db-system-badge" style="background-color: ${systemInfo.color};">
                <nl-codicon icon="${systemInfo.icon}"></nl-codicon>
                ${query.dbSystem?.toUpperCase() || 'UNKNOWN'}
              </span>
              <span class="operation-text">${query.operation || 'Query'}</span>
              ${query.resource ? html`
                <span class="resource-text">${query.resource}</span>
              ` : nothing}
            </div>
            <span class="query-duration ${isSlow ? 'slow' : ''}">
              ${formatDuration(query.durationMs)}
            </span>
          </div>
          <div class="query-meta">
            <div class="query-meta-item">
              <nl-codicon icon="symbol-numeric"></nl-codicon>
              1 call
            </div>
            ${query.resource ? html`
              <div class="query-meta-item">
                <nl-codicon icon="bookmark"></nl-codicon>
                ${systemInfo.resourceType} ${query.resource}
              </div>
            ` : nothing}
            ${query.metadata?.database ? html`
              <div class="query-meta-item">
                <nl-codicon icon="database"></nl-codicon>
                db ${query.metadata.database}
              </div>
            ` : nothing}
            ${hasError ? html`
              <div class="query-meta-item error">
                <nl-codicon icon="error"></nl-codicon>
                error
              </div>
            ` : nothing}
            ${isSlow ? html`
              <div class="query-meta-item warn">
                <nl-codicon icon="watch"></nl-codicon>
                slow
              </div>
            ` : nothing}
          </div>
        </summary>
        <div class="query-body">
          ${this.renderQueryTimeline(query)}
          ${this.renderQueryStatement(query)}
          ${this.renderQueryMetadata(query)}
          ${this.renderQueryError(query)}
          ${this.renderQueryCallStack(query)}
          ${this.renderActionResult(query)}
          ${this.renderQueryActions(query)}
        </div>
      </details>
    `
  }

  private renderQueryTimeline(query: DatabaseQuerySpan) {
    const position = calculateTimelinePosition(
      query.startTimeMs,
      query.startTimeMs + query.durationMs,
      this.trace.startTimeMs,
      this.trace.endTimeMs
    )

    return html`
      <div class="section">
        <div class="section-title">
          <nl-codicon icon="pulse"></nl-codicon>
          Timeline offset
        </div>
        <div class="timeline-strip">
          <span class="timeline-pin" style="left:${position.left}%"></span>
        </div>
        <div class="timeline-desc">
          start +${formatDuration(query.startTimeMs - this.trace.startTimeMs)} ·
          duration ${formatDuration(query.durationMs)}
        </div>
      </div>
    `
  }

  private renderQueryStatement(query: DatabaseQuerySpan) {
    if (!query.statement) return nothing

    const formatted = QueryFormatter.formatQuery(query)
    const paramsText = query.parameters ?
      `\n-- params: ${JSON.stringify(query.parameters)}` : ''

    return html`
      <div class="section">
        <div class="section-title">
          <nl-codicon icon="code"></nl-codicon>
          Statement & params
        </div>
        <pre class="code-block">${formatted}${paramsText}</pre>
      </div>
    `
  }

  private renderQueryMetadata(query: DatabaseQuerySpan) {
    if (!query.metadata || Object.keys(query.metadata).length === 0) {
      return nothing
    }

    return html`
      <div class="section">
        <div class="section-title">
          <nl-codicon icon="info"></nl-codicon>
          Connection info
        </div>
        <div class="metadata-grid">
          ${Object.entries(query.metadata).map(([key, value]) => {
            if (key === 'statement' || value === undefined || value === null) {
              return nothing
            }
            return html`
              <div class="metadata-item">
                <span class="metadata-key">${key}:</span>
                <span class="metadata-value">${this.formatMetadataValue(value)}</span>
              </div>
            `
          })}
        </div>
      </div>
    `
  }

  private renderQueryError(query: DatabaseQuerySpan) {
    if (!query.error) return nothing

    return html`
      <div class="callout error">
        <strong>
          <nl-codicon icon="error"></nl-codicon>
          Error:
        </strong>
        ${query.error.message || query.error}
      </div>
      ${query.error.stacktrace ? html`
        <div class="section">
          <div class="section-title">
            <nl-codicon icon="call-hierarchy"></nl-codicon>
            Error stacktrace
          </div>
          <pre class="code-block">${query.error.stacktrace}</pre>
        </div>
      ` : nothing}
    `
  }

  private renderQueryCallStack(query: DatabaseQuerySpan) {
    const callStack = this.trace.callStacks[query.spanId]
    if (!callStack) return nothing

    return html`
      <div class="section">
        <div class="section-title">
          <nl-codicon icon="call-hierarchy"></nl-codicon>
          Call stack
        </div>
        <pre class="code-block">${callStack.join('\n↳ ')}</pre>
      </div>
    `
  }

  private renderQueryActions(query: DatabaseQuerySpan) {
    const actions = this.actionService.getQueryActions(query)

    return html`
      <div class="actions">
        ${actions.map(action => html`
          <nl-button
            variant=${action.primary ? 'primary' : 'ghost'}
            .copy=${action.copy}
            @click=${action.handler}
            title="${action.label}"
          >
            <nl-codicon icon="${action.icon}"></nl-codicon>
            ${action.label}
          </nl-button>
        `)}
      </div>
    `
  }

  private renderActionResult(query: DatabaseQuerySpan) {
    const result = this.actionResults.get(query.spanId)
    if (!result) return nothing

    return html`
      <div class="action-result ${result.type}">
        <div class="action-result-header">
          <nl-codicon icon="${this.getResultIcon(result.type)}"></nl-codicon>
          <span class="action-result-title">${result.title}</span>
          <nl-button
            variant="ghost"
            size="sm"
            @click=${() => this.dismissResult(query.spanId)}
            title="Dismiss"
          >
            <nl-codicon icon="close"></nl-codicon>
          </nl-button>
        </div>
        <div class="action-result-content">
          <pre class="code-block">${result.content}</pre>
          ${result.metadata ? this.renderResultMetadata(result.metadata) : nothing}
        </div>
      </div>
    `
  }

  private renderResultMetadata(metadata: Record<string, unknown>) {
    const relevantEntries = Object.entries(metadata).filter(
      ([, value]) => value !== undefined && value !== null
    )

    if (relevantEntries.length === 0) return nothing

    return html`
      <div class="result-metadata">
        <div class="section-title">
          <nl-codicon icon="info"></nl-codicon>
          Additional Information
        </div>
        <div class="metadata-grid">
          ${relevantEntries.map(([key, value]) => html`
            <div class="metadata-item">
              <span class="metadata-key">${key}:</span>
              <span class="metadata-value">${this.formatMetadataValue(value)}</span>
            </div>
          `)}
        </div>
      </div>
    `
  }

  private getResultIcon(type: ActionResult['type']): string {
    const icons = {
      explain: 'info',
      error: 'error',
      info: 'info'
    }
    return icons[type] || 'info'
  }

  private dismissResult(queryId: string) {
    this.actionResults.delete(queryId)
    this.requestUpdate()
  }

  private renderWarnings() {
    if (this.trace.warnings.length === 0) return nothing

    return html`
      <div class="section">
        <div class="section-title">
          <nl-codicon icon="warning"></nl-codicon>
          Warnings (${this.trace.warnings.length})
        </div>
        ${this.trace.warnings.map(warning => html`
          <div class="callout warn">
            <strong>
              <nl-codicon icon="warning"></nl-codicon>
              Warning:
            </strong>
            ${warning}
          </div>
        `)}
      </div>
    `
  }

  private renderDuplicates() {
    if (this.trace.duplicateGroups.length === 0) return nothing

    return html`
      <div class="section">
        <div class="section-title">
          <nl-codicon icon="files"></nl-codicon>
          Duplicates (${this.trace.duplicateGroups.length})
        </div>
        ${this.trace.duplicateGroups.map(group => html`
          <div class="callout warn">
            <strong>
              <nl-codicon icon="files"></nl-codicon>
              Signature:
            </strong>
            \`${group.signature}\` ·
            ${group.count} calls ·
            +${formatDuration(group.totalDurationMs)} ·
            ${group.suspectedNPlusOne ? 'suspected N+1' : 'duplicate'}
          </div>
        `)}
      </div>
    `
  }

  private formatMetadataValue(value: unknown): string {
    if (value === null || value === undefined) return ''
    if (typeof value === 'string') return value
    if (typeof value === 'number') return value.toString()
    if (typeof value === 'boolean') return value.toString()
    if (Array.isArray(value)) return value.length > 0 ? JSON.stringify(value) : '[]'
    if (typeof value === 'object') return JSON.stringify(value, null, 2)
    return String(value)
  }

  override render() {
    const contextClass = this.trace.context === 'background' ? 'context-background' : 'context-http'
    const methodClass = this.trace.method ? `method-${this.trace.method.toLowerCase()}` : ''

    return html`
      <details class="trace ${this.hasIssues ? 'has-issues' : ''} ${contextClass} ${methodClass}">
        <summary class="trace-header">
          <div class="trace-top">
            <div class="trace-route">
              <nl-codicon icon="${this.trace.context === 'background' ? 'server-process' : 'globe'}">
              </nl-codicon>
              ${this.trace.method ? html`
                <span class="trace-method method ${this.trace.method.toLowerCase()}">${this.trace.method}</span>
              ` : nothing}
              ${this.trace.route || 'Unknown'}
            </div>
          </div>
          <div class="trace-meta">
            <div class="trace-meta-item">
              <nl-codicon icon="clock"></nl-codicon>
              total ${formatDuration(this.trace.totalDurationMs)}
            </div>
            <div class="trace-meta-item">
              <nl-codicon icon="database"></nl-codicon>
              ${this.trace.queryCount} queries · ${this.trace.uniqueQueryCount} unique
            </div>
            ${this.trace.duplicateGroups.length ? html`
              <div class="status-badge warn">
                <nl-codicon icon="warning"></nl-codicon>
                duplicate
              </div>
            ` : nothing}
            ${this.trace.slowQueryCount ? html`
              <div class="status-badge info">
                <nl-codicon icon="watch"></nl-codicon>
                slow ${this.trace.slowQueryCount}
              </div>
            ` : nothing}
            ${this.trace.errorCount ? html`
              <div class="status-badge error">
                <nl-codicon icon="error"></nl-codicon>
                errors
              </div>
            ` : nothing}
          </div>
        </summary>
        <div class="trace-body">
          ${this.renderTimeline()}
          ${this.renderQueries()}
          ${this.renderWarnings()}
          ${this.renderDuplicates()}
        </div>
      </details>
    `
  }

  static override styles = css`
    :host {
      display: block;
    }

    details.trace {
      background: var(--nl-surface-raised);
      border: 1px solid var(--nl-surface-border);
      border-radius: var(--nl-border-radius);
      overflow: hidden;
      transition: all 0.2s ease;
    }

    details.trace[open] {
      box-shadow: var(--nl-shadow-md);
    }

    details.trace.has-issues {
      border-left: 3px solid var(--nl-color-error);
    }

    /* Context-based coloring */
    details.trace.context-http {
      border-left: 3px solid #2196F3; /* Blue for HTTP traces */
    }

    details.trace.context-background {
      border-left: 3px solid #9C27B0; /* Purple for background traces */
    }

    /* HTTP method colors - consistent with request plugin */
    .method {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: var(--nl-border-radius);
    }

    .method.get {
      background: #dcfce7;
      color: #166534;
    }

    .method.post {
      background: #dbeafe;
      color: #1e40af;
    }

    .method.put {
      background: #e0e7ff;
      color: #3730a3;
    }

    .method.patch {
      background: #f3e8ff;
      color: #581c87;
    }

    .method.delete {
      background: #e5e7eb;
      color: #374151;
    }

    .method.head {
      background: #cffafe;
      color: #0e7490;
    }

    .method.options {
      background: #fce7f3;
      color: #9d174d;
    }

    .method.trace {
      background: #f1f5f9;
      color: #475569;
    }

    summary.trace-header {
      padding: var(--nl-spacing-md);
      cursor: pointer;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: var(--nl-spacing-xs);
      border-bottom: 1px solid transparent;
      transition: all 0.15s ease;
    }

    summary.trace-header:hover {
      background: var(--nl-surface-hover);
    }

    summary.trace-header::-webkit-details-marker {
      display: none;
    }

    .trace-top {
      display: flex;
      justify-content: flex-start;
      align-items: center;
      font-weight: 600;
      color: var(--nl-text-primary);
    }

    .trace-route {
      display: flex;
      align-items: center;
      gap: var(--nl-spacing-xs);
      font-family: var(--nl-font-family-sans);
      flex-wrap: wrap;
    }

    .trace-method {
      border-radius: var(--nl-border-radius);
      font-size: 11px;
      font-weight: 600;
      padding: 2px 6px;
      flex-shrink: 0;
      /* Default styling for methods without specific classes */
      background: var(--nl-surface-control);
      color: var(--nl-text-secondary);
    }

    .trace-meta {
      display: flex;
      flex-wrap: wrap;
      gap: var(--nl-spacing-sm);
      font-size: 0.8rem;
      color: var(--nl-text-secondary);
      margin-top: var(--nl-spacing-xs);
    }

    .trace-meta-item {
      display: flex;
      align-items: center;
      gap: 2px;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 2px var(--nl-spacing-xs);
      border-radius: var(--nl-border-radius);
      font-size: 0.7rem;
      font-weight: 500;
      border: 1px solid;
    }

    .status-badge.warn {
      background: rgba(234, 179, 8, 0.1);
      border-color: var(--nl-color-warning);
      color: var(--nl-color-warning);
    }

    .status-badge.error {
      background: rgba(239, 68, 68, 0.1);
      border-color: var(--nl-color-error);
      color: var(--nl-color-error);
    }

    .status-badge.info {
      background: rgba(59, 130, 246, 0.1);
      border-color: var(--nl-color-info);
      color: var(--nl-color-info);
    }

    .trace-body {
      border-top: 1px solid var(--nl-surface-border);
      padding: var(--nl-spacing-lg);
      background: var(--nl-surface-app);
      display: flex;
      flex-direction: column;
      gap: var(--nl-spacing-lg);
    }

    .section {
      display: flex;
      flex-direction: column;
      gap: var(--nl-spacing-sm);
    }

    .section-title {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--nl-text-secondary);
      display: flex;
      align-items: center;
      gap: var(--nl-spacing-xs);
      margin-bottom: var(--nl-spacing-xs);
    }

    .timeline-strip {
      height: 8px;
      background: var(--nl-surface-control);
      border: 1px solid var(--nl-surface-border);
      border-radius: 4px;
      position: relative;
      margin: var(--nl-spacing-xs) 0;
    }

    .timeline-pin {
      position: absolute;
      top: -2px;
      width: 3px;
      height: 12px;
      background: var(--nl-color-warning);
      border-radius: 2px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.1);
    }

    .timeline-desc {
      font-size: 0.75rem;
      color: var(--nl-text-secondary);
      margin-top: var(--nl-spacing-xs);
    }

    .query-accordion {
      display: flex;
      flex-direction: column;
      gap: var(--nl-spacing-sm);
    }

    details.query {
      background: var(--nl-surface-control);
      border: 1px solid var(--nl-surface-border);
      border-radius: var(--nl-border-radius);
      overflow: hidden;
    }

    details.query.error {
      border-left: 3px solid var(--nl-color-error);
    }

    summary.query-head {
      padding: var(--nl-spacing-md);
      cursor: pointer;
      list-style: none;
      background: var(--nl-surface-control);
      transition: background-color 0.15s ease;
    }

    summary.query-head:hover {
      background: var(--nl-surface-hover);
    }

    summary.query-head::-webkit-details-marker {
      display: none;
    }

    .query-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 600;
      color: var(--nl-text-primary);
      margin-bottom: var(--nl-spacing-xs);
    }

    .query-duration.slow {
      color: var(--nl-color-warning);
      font-weight: 600;
    }

    .query-meta {
      display: flex;
      flex-wrap: wrap;
      gap: var(--nl-spacing-sm);
      font-size: 0.8rem;
      color: var(--nl-text-secondary);
    }

    .query-meta-item {
      display: flex;
      align-items: center;
      gap: 2px;
    }

    .query-meta-item.warn {
      color: var(--nl-color-warning);
    }

    .query-meta-item.error {
      color: var(--nl-color-error);
    }

    .query-operation {
      display: flex;
      align-items: center;
      gap: var(--nl-spacing-sm);
    }

    .db-system-badge {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 2px var(--nl-spacing-xs);
      border-radius: var(--nl-border-radius);
      font-size: 0.7rem;
      font-weight: 500;
      color: white;
      text-shadow: 0 1px 1px rgba(0,0,0,0.3);
    }

    .operation-text {
      font-weight: 600;
      color: var(--nl-text-primary);
    }

    .resource-text {
      font-weight: 400;
      color: var(--nl-text-secondary);
    }

    .metadata-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: var(--nl-spacing-xs);
    }

    .metadata-item {
      display: flex;
      font-size: 0.8rem;
      line-height: 1.4;
    }

    .metadata-key {
      font-weight: 500;
      color: var(--nl-text-secondary);
      min-width: 80px;
      margin-right: var(--nl-spacing-xs);
    }

    .metadata-value {
      color: var(--nl-text-primary);
      font-family: var(--nl-font-family-mono);
      word-break: break-all;
    }

    .query-body {
      border-top: 1px solid var(--nl-surface-border);
      padding: var(--nl-spacing-md);
      background: var(--nl-surface-app);
      display: flex;
      flex-direction: column;
      gap: var(--nl-spacing-md);
    }

    .code-block, pre {
      margin: 0;
      background: var(--nl-surface-control);
      border: 1px solid var(--nl-surface-border);
      border-radius: var(--nl-border-radius);
      padding: var(--nl-spacing-md);
      font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace;
      font-size: 0.8rem;
      line-height: 1.4;
      color: var(--nl-text-primary);
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-all;
    }

    .callout {
      padding: var(--nl-spacing-md);
      border-radius: var(--nl-border-radius);
      border: 1px solid;
      font-size: 0.85rem;
      line-height: 1.4;
    }

    .callout.warn {
      background: rgba(234, 179, 8, 0.1);
      border-color: var(--nl-color-warning);
      color: var(--nl-text-primary);
    }

    .callout.error {
      background: rgba(239, 68, 68, 0.1);
      border-color: var(--nl-color-error);
      color: var(--nl-text-primary);
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--nl-spacing-xs);
      margin-top: var(--nl-spacing-sm);
    }

    .action-result {
      margin-top: var(--nl-spacing-md);
      border: 1px solid;
      border-radius: var(--nl-border-radius);
      overflow: hidden;
    }

    .action-result.explain {
      background: rgba(59, 130, 246, 0.1);
      border-color: var(--nl-color-info);
    }

    .action-result.error {
      background: rgba(239, 68, 68, 0.1);
      border-color: var(--nl-color-error);
    }

    .action-result.info {
      background: rgba(59, 130, 246, 0.1);
      border-color: var(--nl-color-info);
    }

    .action-result-header {
      display: flex;
      align-items: center;
      gap: var(--nl-spacing-xs);
      padding: var(--nl-spacing-sm) var(--nl-spacing-md);
      background: var(--nl-surface-control);
      border-bottom: 1px solid;
      border-bottom-color: inherit;
    }

    .action-result-title {
      flex: 1;
      font-weight: 600;
      font-size: 0.85rem;
    }

    .action-result-content {
      padding: var(--nl-spacing-md);
    }

    .result-metadata {
      margin-top: var(--nl-spacing-md);
      padding-top: var(--nl-spacing-md);
      border-top: 1px solid var(--nl-surface-border);
    }
  `
}
