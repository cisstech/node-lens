import type { NodeLensClient } from '@cisstech/node-lens-client';
import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { PLUGIN_NAME, type DatabaseConnection, type ListConnectionsResult } from '../../server/types.js';
import type { PlaygroundState, QueryResult } from '../types.js';
import { getDatabaseSystemContext, getQueryTemplates, type DatabaseSystemContext, type QueryTemplate } from '../utils/database-systems.js';

const HISTORY_KEY = 'nl.database.playground.history';

@customElement('nl-database-playground')
export class DatabasePlayground extends LitElement {
  @property({ type: Object }) client!: NodeLensClient;

  @state() private playgroundState: PlaygroundState = {
    currentQuery: '',
    isExecuting: false,
    result: null,
    error: null,
  };
  @state() private connectionState = {
    loading: false,
    error: null as string | null,
    connections: [] as DatabaseConnection[],
    selectedConnectionId: ''
  }
  @state() private systemContext: DatabaseSystemContext | null = null;
  @state() private queryTemplates: QueryTemplate[] = [];
  @state() private showHistory = true;
  @state() private destructiveWarning = false;
  @state() private history: { query: string; timestamp: number }[] = [];

  @query('.query-input') private queryInput!: HTMLTextAreaElement;

  override connectedCallback(): void {
    super.connectedCallback();
    this.loadConnections();
    this.loadHistory();
    window.addEventListener('keydown', this.handleGlobalShortcuts);
  }

  private async loadConnections() {
    this.connectionState = { ...this.connectionState, loading: true, error: null }

    try {
      const result = await this.client.commands.execute<ListConnectionsResult>(
        PLUGIN_NAME,
        'list-connections'
      )
      this.connectionState = {
        loading: false,
        error: null,
        connections: result.connections || [],
        selectedConnectionId: result.connections?.[0]?.id || ''
      }
      this.updateSystemContext()
    } catch (error) {
      this.connectionState = {
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load connections',
        connections: [],
        selectedConnectionId: ''
      }
    }
  }

  override firstUpdated(changedProperties: Map<string, unknown>): void {
    super.firstUpdated(changedProperties);
    this.queryInput?.focus();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.handleGlobalShortcuts);
  }

  override updated(changed: Map<string, unknown>) {
    super.updated(changed);
    if (changed.has('selectedConnectionId')) {
      this.updateSystemContext();
    }
  }

  private updateSystemContext() {
    const conn = this.connectionState.connections.find((c) => c.id === this.connectionState.selectedConnectionId);
    if (conn) {
      this.systemContext = getDatabaseSystemContext(conn.dbSystem) || null;
      this.queryTemplates = getQueryTemplates(conn.dbSystem);
    } else {
      this.systemContext = null;
      this.queryTemplates = [];
    }
  }

  private handleGlobalShortcuts = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      const select = this.shadowRoot?.querySelector('nl-select') as HTMLElement | null;
      select?.focus();
    }
  };

  private handleConnectionChange(e: CustomEvent) {
    this.connectionState = {
      ...this.connectionState,
      selectedConnectionId: e.detail.value
    }
    this.updateSystemContext()
  }

  private handleQueryChange(e: CustomEvent<{ value: string }>) {
    const query = e.detail.value || '';
    this.playgroundState = { ...this.playgroundState, currentQuery: query };
    this.destructiveWarning = /(drop|delete|truncate)/i.test(query);
  }

  private async handleExecuteQuery() {
    if (!this.playgroundState.currentQuery.trim()) return;

    this.playgroundState = {
      ...this.playgroundState,
      isExecuting: true,
      error: null
    }

    try {
      const connection = this.connectionState.connections.find(c => c.id === this.connectionState.selectedConnectionId)
      if (!connection) throw new Error('Connection not found')

      const result = await this.client.commands.execute(
        PLUGIN_NAME,
        'execute-query',
        {
          query: this.playgroundState.currentQuery,
          dbSystem: connection.dbSystem,
          database: connection.database,
        }
      )

      this.playgroundState = {
        ...this.playgroundState,
        isExecuting: false,
        result: result as QueryResult | null,
      }

      // Add to history
      const historyItem = {
        query: this.playgroundState.currentQuery,
        timestamp: Date.now()
      }
      this.history = [historyItem, ...this.history.filter((h) => h.query !== this.playgroundState.currentQuery)].slice(0, 10)
      this.saveHistory()

    } catch (error) {
      this.playgroundState = {
        ...this.playgroundState,
        isExecuting: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  private applyTemplate(query: string) {
    this.playgroundState = { ...this.playgroundState, currentQuery: query }
    this.queryInput?.focus();
  }

  private restoreFromHistory(query: string) {
    this.playgroundState = { ...this.playgroundState, currentQuery: query }
    this.queryInput?.focus();
  }

  private loadHistory() {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      if (saved) {
        this.history = JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load history', e);
    }
  }

  private saveHistory() {
    try {
      const history = [
        { query: this.playgroundState.currentQuery, timestamp: Date.now() },
        ...this.history.filter((h) => h.query !== this.playgroundState.currentQuery),
      ].slice(0, 10);

      this.history = history;
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
      console.warn('Failed to save history', e);
    }
  }

  private clearHistory() {
    this.history = [];
    localStorage.removeItem(HISTORY_KEY);
  }

  private downloadFile(filename: string, content: string, type = 'text/plain') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  private exportAsCSV() {
    if (!this.playgroundState.result) return;
    const { columns, rows } = this.playgroundState.result;
    const csv = [columns.join(','), ...rows.map((r: Record<string, unknown>) => columns.map((c: string) => JSON.stringify(r[c] ?? '')).join(','))].join('\n');
    this.downloadFile('results.csv', csv, 'text/csv');
  }

  private exportAsJSON() {
    if (!this.playgroundState.result) return;
    const json = JSON.stringify(this.playgroundState.result.rows, null, 2);
    this.downloadFile('results.json', json, 'application/json');
  }

  private renderConnectionSelector() {
    return html`
      <nl-select
        .options=${this.connectionState.connections.map((c: DatabaseConnection) => ({ value: c.id, label: `${c.name} (${c.dbSystem})` }))}
        .value=${this.connectionState.selectedConnectionId}
        placeholder="Select connection..."
        @change=${this.handleConnectionChange}
      >
        <nl-codicon slot="icon" icon="database"></nl-codicon>
      </nl-select>
    `;
  }

  private renderQueryEditor() {
    return html`
      <div class="query-editor">
        <nl-codemirror-editor
          .language=${this.getQueryLanguage()}
          .value=${this.playgroundState.currentQuery}
          placeholder=${this.getQueryPlaceholder()}
          ?readOnly=${this.playgroundState.isExecuting}
          style="height:340px;"
          @change=${this.handleQueryChange.bind(this)}
          @execute=${this.handleExecuteQuery.bind(this)}
        ></nl-codemirror-editor>

        ${this.destructiveWarning
        ? html`<div class="warning"><nl-codicon icon="warning"></nl-codicon> Destructive query detected (DROP/DELETE/TRUNCATE)</div>`
        : nothing}
        <div class="editor-actions">
          <nl-button
            variant="primary"
            ?loading=${this.playgroundState.isExecuting}
            ?disabled=${!this.connectionState.selectedConnectionId || !this.playgroundState.currentQuery.trim()}
            @click=${this.handleExecuteQuery}
          >
            Run
          </nl-button>
          <small class="hint">${navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl'}+Enter to execute</small>
        </div>
      </div>
    `;
  }

  private getQueryLanguage() {
    return this.systemContext?.type === 'nosql' ? 'json' : 'sql';
  }

  private getQueryPlaceholder(): string {
    if (!this.systemContext) return 'Enter query...';
    switch (this.systemContext.type) {
      case 'sql': return 'SELECT * FROM table LIMIT 10;';
      case 'nosql': return this.systemContext.system === 'mongodb' ? 'db.collection.find({})' : 'Enter query...';
      case 'keyvalue': return this.systemContext.system === 'redis' ? 'GET key' : 'Enter command...';
      default: return 'Enter query...';
    }
  }

  private renderResults() {
    if (this.playgroundState.error) {
      return html`<div class="result-error"><nl-codicon icon="error"></nl-codicon> ${this.playgroundState.error}</div>`;
    }
    if (!this.playgroundState.result) {
      return html`<div class="empty-state">No results yet. Run a query to see results.</div>`;
    }

    return html`
      <div class="results fade-in">
        <div class="results-header">
          <span>${this.playgroundState.result.rowCount} rows • ${this.playgroundState.result.executionTime} ms</span>
          <div class="actions">
            <nl-button variant="ghost" @click=${this.exportAsCSV}><nl-codicon icon="table"></nl-codicon>CSV</nl-button>
            <nl-button variant="ghost" @click=${this.exportAsJSON}><nl-codicon icon="code"></nl-codicon>JSON</nl-button>
          </div>
        </div>
        <div class="results-table">
          <table>
            <thead><tr>${this.playgroundState.result.columns.map((c: string) => html`<th>${c}</th>`)}</tr></thead>
            <tbody>
              ${this.playgroundState.result.rows.map((r: Record<string, unknown>) => html`
                <tr>${this.playgroundState.result?.columns?.map((c: string) => html`<td>${r[c]}</td>`)}</tr>
              `)}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  private renderHistory() {
    if (!this.history.length) return nothing;
    return html`
      <div class="history">
        <div class="history-header">
          <h4>History (${this.history.length})</h4>
          <div class="actions">
            <nl-button variant="ghost" @click=${() => (this.showHistory = !this.showHistory)}>
              <nl-codicon icon=${this.showHistory ? 'chevron-down' : 'chevron-right'}></nl-codicon>
            </nl-button>
            <nl-button variant="ghost" @click=${this.clearHistory}>
              <nl-codicon icon="trash"></nl-codicon>
            </nl-button>
          </div>
        </div>
        ${this.showHistory
        ? html`<ul>
              ${this.history.map((h) => html`
                <li @click=${() => this.restoreFromHistory(h.query)}>
                  <code>${h.query}</code>
                  <small>${new Date(h.timestamp).toLocaleTimeString()}</small>
                </li>
              `)}
            </ul>`
        : nothing}
      </div>
    `;
  }

  private renderTemplates() {
    if (!this.queryTemplates.length) return nothing;
    return html`
      <div class="templates">
        <h4>Templates</h4>
        <div class="grid">
          ${this.queryTemplates.map((t) => html`
            <div class="template-card" @click=${() => this.applyTemplate(t.query)}>
              <h5>${t.name}</h5>
              <p>${t.description}</p>
            </div>
          `)}
        </div>
      </div>
    `;
  }

  override render() {
    if (!this.connectionState.connections.length) {
      return html`
        <div class="empty-state">
          <nl-codicon icon="plug"></nl-codicon>
          <p>No database connections configured.</p>
          <small>Go to plugin settings to add one.</small>
        </div>
      `;
    }

    return html`
      <div class="playground">
        ${this.renderConnectionSelector()}
        ${this.renderQueryEditor()}
        ${this.renderResults()}
        ${this.renderHistory()}
        ${this.renderTemplates()}
      </div>
    `;
  }

  static override styles = css`
    .playground {
      display: flex;
      flex-direction: column;
      gap: var(--nl-spacing-md);
      font-family: var(--nl-font-family-sans);
      font-size: var(--nl-font-size-base);
      line-height: var(--nl-line-height-base);
      color: var(--nl-text-primary);
    }

    .query-editor {
      display: flex;
      flex-direction: column;
      gap: var(--nl-spacing-sm);
    }

    .query-input {
      font-family: monospace;
      padding: var(--nl-spacing-sm);
      border: 1px solid var(--nl-surface-border);
      border-radius: var(--nl-border-radius);
      min-height: 120px;
      background: var(--nl-surface-control);
      color: var(--nl-text-primary);
    }

    .query-input:focus {
      outline: 1px solid var(--nl-color-primary);
    }

    .warning {
      color: var(--nl-color-warning);
      font-size: 0.85rem;
    }

    .editor-actions {
      display: flex;
      align-items: center;
      gap: var(--nl-spacing-md);
    }

    .hint {
      color: var(--nl-text-secondary);
      font-size: 0.8em;
    }

    .results-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .results-table {
      max-height: 300px;
      overflow: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th,
    td {
      border: 1px solid var(--nl-surface-border);
      padding: var(--nl-spacing-xs) var(--nl-spacing-sm);
      font-size: 12px;
    }

    th {
      background: var(--nl-surface-hover);
    }

    .history-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .history ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .history li {
      cursor: pointer;
      padding: var(--nl-spacing-xs) 0;
      display: flex;
      justify-content: space-between;
    }

    .history li:hover {
      background: var(--nl-surface-hover);
    }

    .templates .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: var(--nl-spacing-sm);
    }

    .template-card {
      border: 1px solid var(--nl-surface-border);
      border-radius: var(--nl-border-radius);
      padding: var(--nl-spacing-sm);
      cursor: pointer;
    }

    .template-card:hover {
      background: var(--nl-surface-hover);
    }

    .empty-state {
      text-align: center;
      color: var(--nl-text-secondary);
      padding: var(--nl-spacing-lg);
    }

    .fade-in {
      animation: fadeIn 0.3s ease-in;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(4px);
      }

      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'nl-database-playground': DatabasePlayground;
  }
}
