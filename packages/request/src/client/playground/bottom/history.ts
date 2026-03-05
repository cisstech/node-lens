import { LitElement, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { HistoryEntry } from '../types';

const HISTORY_LIMIT = 50;
const HISTORY_STORAGE_KEY = 'nl.request.history';

@customElement('nl-request-history')
export class RequestHistory extends LitElement {
  @state() private history: HistoryEntry[] = [];

  override connectedCallback() {
    super.connectedCallback();
    this.load();
  }

  override render() {
    return html`
      <div class="history">
        <div class="actions">
          <nl-button variant="ghost" @click=${this.clear}>Clear</nl-button>
        </div>
        ${this.history.length === 0
        ? html`<div class="muted">No history yet.</div>`
        : this.history.map(h => html`
              <div class="history-row">
                <span class="method">${h.method}</span>
                <span class="url">${h.url}</span>
                <span class="time">${new Date(h.ts).toLocaleString()}</span>
                <nl-button variant="ghost" @click=${() => this.applyEntry(h)}>
                  Apply
                </nl-button>
              </div>
            `)}
      </div>
    `;
  }

  add(entry: HistoryEntry) {
    this.history = [entry, ...this.history].slice(0, HISTORY_LIMIT);
    this.save();
  }

  private load() {
    try {
      const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
      this.history = raw ? JSON.parse(raw) : [];
    } catch {
      this.history = [];
    }
  }

  private save() {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(this.history));
  }

  private clear() {
    this.history = [];
    this.save();
  }

  private applyEntry(entry: HistoryEntry) {
    this.dispatchEvent(new CustomEvent<HistoryEntry>('apply-history', {
      detail: entry,
      bubbles: true,
      composed: true,
    }));
  }

  static override styles = css`
    :host {
      font-family: var(--nl-font-family-sans);
      font-size: var(--nl-font-size-base);
      color: var(--nl-text-primary);
    }
    .history {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .history-row {
      display: grid;
      grid-template-columns: 60px 1fr auto auto;
      gap: 8px;
      align-items: center;
      font-size: 13px;
    }

    .method {
      font-weight: 600;
    }

    .url {
      font-family: ui-monospace, monospace;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .time {
      color: var(--nl-text-secondary);
      font-size: 11px;
    }

    .actions {
      margin-bottom: 6px;
    }

    .muted {
      color: var(--nl-text-secondary);
      font-style: italic;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'nl-request-history': RequestHistory;
  }
}
