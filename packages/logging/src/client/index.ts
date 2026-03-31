import { NodeLensClient } from '@cisstech/node-lens-client';
import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { LogEvent } from 'src/server/types';
import { LoggingService } from '../client/services/logging-service';

@customElement('nl-logging')
export class LoggingViewer extends LitElement {
  @property({ type: Object }) client!: NodeLensClient;
  @state() private logs: LogEvent[] = [];
  @state() private viewMode: 'table' | 'timeline' = 'table';
  @state() private loading = true;
  @state() private severityFilter = '';
  @state() private loggerFilter = '';
  @state() private search = '';

  private service!: LoggingService;

  get filteredLogs() {
    return this.logs.filter((log) => {
      const sev = (log.severity || '').toUpperCase();
      const matchSeverity = this.severityFilter ? sev === this.severityFilter.toUpperCase() : true;
      const matchLogger = this.loggerFilter ? log.attributes?.['logger'] === this.loggerFilter : true;
      const matchSearch = this.search
        ? JSON.stringify(log).toLowerCase().includes(this.search.toLowerCase())
        : true;
      return matchSeverity && matchLogger && matchSearch;
    });
  }

  override connectedCallback() {
    super.connectedCallback();
    this.service = new LoggingService(this.client);
    this.initLogs();
  }

  private hasDistinctArgs(log: LogEvent): boolean {
    if (!log.attributes?.rawArgs) return false;
    const argsStr = JSON.stringify(log.attributes.rawArgs);
    return !argsStr.includes(log.message);
  }

  async initLogs() {
    this.loading = true;
    const state = await this.service.initialize();
    this.logs = state.logs;
    this.loading = false;
    this.service.subscribeToLogs((log) => {
      this.logs = [log, ...this.logs];
    });
  }

  switchView(mode: 'table' | 'timeline') {
    this.viewMode = mode;
  }

  renderTable() {
    return html`
      <div style="flex:1; overflow:auto">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Severity</th>
              <th>Message</th>
              <th>Logger</th>
            </tr>
          </thead>
          <tbody>
            ${this.filteredLogs.map(
              (log) => html`
                <tr>
                  <td>${new Date(log.timestamp).toLocaleTimeString()}</td>
                  <td><span class="sev ${log.severity}">${log.severity}</span></td>
                  <td>${log.message}</td>
                  <td>${log.attributes?.['logger']}</td>
                </tr>
                ${this.hasDistinctArgs(log)
                  ? html`<tr><td colspan="4"><details><summary>Args</summary><pre>${JSON.stringify(log.attributes?.rawArgs, null, 2)}</pre></details></td></tr>`
                  : ''}
              `
            )}
          </tbody>
        </table>
      </div>
    `;
  }

  renderTimeline() {
    return html`
      <div class="timeline">
        ${this.filteredLogs.map(
          (log) => html`
            <div class="t-row ${log.severity}">
              <span class="t-dot"></span>
              <div class="t-meta">
                <span class="sev ${log.severity}">${log.severity}</span>
                <span>${new Date(log.timestamp).toLocaleTimeString()}</span>
                <span>${log.attributes?.['logger']}</span>
              </div>
              <div>${log.message}</div>
              ${this.hasDistinctArgs(log)
                ? html`<details><summary>Args</summary><pre>${JSON.stringify(log.attributes?.rawArgs, null, 2)}</pre></details>`
                : ''}
            </div>`
        )}
      </div>
    `;
  }

  override render() {
    const severities = [
      { value: '', label: 'All severities' },
      { value: 'debug', label: 'Debug' },
      { value: 'info', label: 'Info' },
      { value: 'warn', label: 'Warn' },
      { value: 'error', label: 'Error' },
      { value: 'fatal', label: 'Fatal' },
      { value: 'log', label: 'Log' },
    ];

    const loggers = Array.from(new Set(this.logs.map((l) => l.attributes?.['logger']).filter(Boolean)));
    const loggerOptions = [{ value: '', label: 'All loggers' }, ...loggers.map((l) => ({ value: l, label: l }))];

    return html`
      <header>
        <div class="header-top">
          <h1>Logs</h1>
          <div class="seg">
            <button class=${this.viewMode === 'table' ? 'active' : ''} @click=${() => this.switchView('table')}>Table</button>
            <button class=${this.viewMode === 'timeline' ? 'active' : ''} @click=${() => this.switchView('timeline')}>Timeline</button>
          </div>
        </div>
        <div class="filters">
          <div class="filter-group">
            <label class="filter-label">Severity:</label>
            <nl-select
              .options=${severities}
              .value=${this.severityFilter}
              @change=${(e: CustomEvent<{ value: string }>) => (this.severityFilter = e.detail.value)}
            >
            <nl-codicon slot="icon" icon="warning"></nl-codicon>
            </nl-select>
          </div>
          <div class="filter-group">
            <label class="filter-label">Logger:</label>
            <nl-select
              .options=${loggerOptions}
              .value=${this.loggerFilter}
              @change=${(e: CustomEvent<{ value: string }>) => (this.loggerFilter = e.detail.value)}
            >
            <nl-codicon slot="icon" icon="server-environment"></nl-codicon>
            </nl-select>
          </div>
        </div>
        <div class="search-bar">
          <nl-input
            type="text"
            placeholder="Search logs…"
            .value=${this.search}
            @input=${(e: CustomEvent<{ value: string }>) => (this.search = e.detail.value)}
            showClear
          ></nl-input>
          <nl-button
            variant="ghost"
            title="Clear filters"
            @click=${() => { this.severityFilter = ''; this.loggerFilter = ''; this.search = ''; }}>
            <nl-codicon icon="clear-all"></nl-codicon>
            Clear logs
          </nl-button>
        </div>
      </header>

      ${this.loading
        ? html`<p>Loading logs…</p>`
        : this.filteredLogs.length === 0
        ? html`<div class="empty">
            <nl-codicon icon="output"></nl-codicon>
            <div>${this.logs.length === 0
              ? 'No logs yet. Trigger some activity in your app.'
              : 'No logs match your filters.'}</div>
          </div>`
        : this.viewMode === 'table'
        ? this.renderTable()
        : this.renderTimeline()}
    `;
  }

  static override styles = css`
    .empty {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 3rem 1rem;
      color: var(--nl-text-secondary);
    }
    .empty nl-codicon {
      font-size: 1.75rem;
      opacity: 0.6;
    }
    :host {
      display: flex;
      flex-direction: column;
      background: var(--nl-surface-app);
      color: var(--nl-text-primary);
      font-family: var(--nl-font-family-sans);
      font-size: var(--nl-font-size-base);
      line-height: var(--nl-line-height-base);
      overflow: hidden;
      container-type: inline-size;
    }

    header {
      display: flex;
      flex-direction: column;
      gap: var(--nl-spacing-sm);
      padding: var(--nl-spacing-md);
      border-bottom: 1px solid var(--nl-surface-border);
    }

    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    h1 {
      font-size: 14px;
      font-weight: 600;
      margin: 0;
    }

    .seg {
      display: inline-flex;
      border: 1px solid var(--nl-surface-border);
      border-radius: var(--nl-border-radius);
      overflow: hidden;
    }

    .seg button {
      padding: var(--nl-spacing-xs) var(--nl-spacing-md);
      background: transparent;
      border: none;
      cursor: pointer;
      color: var(--nl-text-primary);
    }

    .seg button.active {
      background: var(--nl-color-primary);
      color: var(--nl-text-on-primary);
    }

    .filters {
      display: flex;
      gap: var(--nl-spacing-md);
      align-items: center;
      flex-wrap: wrap;
    }

    .search-bar {
      display: flex;
      gap: var(--nl-spacing-md);
      align-items: center;
      flex-wrap: wrap;
    }

    .search-bar nl-input {
      flex: 1;
      min-width: 200px;
    }

    .filter-group {
      display: flex;
      flex-direction: column;
      gap: var(--nl-spacing-xs);
      min-width: 180px;
      width: 180px;
      flex-shrink: 0;
    }

    .filter-label {
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--nl-text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.025em;
    }

    @container (max-width: 600px) {
      .filters {
        flex-direction: column;
        align-items: stretch;
        gap: var(--nl-spacing-sm);
      }

      .search-bar {
        flex-direction: column;
        align-items: stretch;
        gap: var(--nl-spacing-sm);
      }

      .search-bar nl-input,
      .filter-group {
        width: 100%;
      }
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-family: ui-monospace, monospace;
    }

    th, td {
      border-bottom: 1px solid var(--nl-surface-border);
      padding: var(--nl-spacing-xs) var(--nl-spacing-sm);
      text-align: left;
      vertical-align: top;
    }

    th {
      font-size: 12px;
      color: var(--nl-text-secondary);
      font-weight: 600;
    }

    .sev {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-weight: 600;
    }

    .sev::before {
      content: '';
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
    }

    .sev.trace { color: var(--nl-text-secondary); }
    .sev.trace::before { background: var(--nl-text-secondary); }

    .sev.debug { color: var(--nl-color-info); }
    .sev.debug::before { background: var(--nl-color-info); }

    .sev.info, .sev.INFO, .sev.LOG { color: var(--nl-color-success); }
    .sev.info::before, .sev.INFO::before, .sev.LOG::before { background: var(--nl-color-success); }

    .sev.warn, .sev.WARN { color: var(--nl-color-warning); }
    .sev.warn::before, .sev.WARN::before { background: var(--nl-color-warning); }

    .sev.error, .sev.ERROR { color: var(--nl-color-error); }
    .sev.error::before, .sev.ERROR::before { background: var(--nl-color-error); }

    .sev.fatal { color: var(--nl-color-error-hover); }
    .sev.fatal::before { background: var(--nl-color-error-hover); }

    .timeline {
      position: relative;
      padding: var(--nl-spacing-md);
      overflow-y: auto;
      flex: 1;
    }

    .timeline::before {
      content: '';
      position: absolute;
      left: 18px;
      top: 0;
      bottom: 0;
      width: 2px;
      background: var(--nl-surface-border);
    }

    .t-row {
      position: relative;
      margin-bottom: var(--nl-spacing-md);
      padding-left: 44px;
    }

    .t-dot {
      position: absolute;
      left: 12px;
      top: 4px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      border: 2px solid var(--nl-surface-app);
    }

    .t-meta {
      display: flex;
      gap: var(--nl-spacing-sm);
      align-items: center;
      color: var(--nl-text-secondary);
      font-size: 12px;
    }

    details {
      margin-top: var(--nl-spacing-xs);
      font-size: 12px;
      color: var(--nl-text-secondary);
      white-space: pre-wrap;
      word-break: break-word;
      max-height: 200px;
      overflow: auto;
    }

    pre {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
    }

    td[colspan] {
      background: none;
      padding: 0 var(--nl-spacing-sm) var(--nl-spacing-sm);
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'nl-logging': LoggingViewer;
  }
}
