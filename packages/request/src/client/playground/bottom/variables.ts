import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { Variable } from '../../../server/types';

@customElement('nl-request-variables')
export class RequestVariables extends LitElement {
  @property({ attribute: false }) variables: Variable[] = [];

  override render() {
    return html`
      <div class="vars">
        ${!this.variables?.length
        ? html`<div class="empty">No variables loaded from server.</div>`
        : this.variables.map(
          (variable) => html`
            <div class="var-row">
              <div class="key">${variable.key}</div>
              <div class="type">${variable.type}</div>
              <div class="value">
                ${variable.type === 'function'
                ? html`<code class="code">${variable.value}</code>`
                : variable.value}
              </div>
            </div>
          `,
        )}
      </div>
    `;
  }

  static override styles = css`
    :host {
      display: block;
      font-family: var(--nl-font-family-sans);
      font-size: var(--nl-font-size-base);
      color: var(--nl-text-primary);
    }
    .vars {
      display: flex;
      flex-direction: column;
      gap: var(--nl-spacing-xs);
    }

    .var-row {
      display: grid;
      grid-template-columns: 160px 100px 1fr;
      gap: var(--nl-spacing-sm);
      padding: 4px 6px;
      border-bottom: 1px solid var(--nl-surface-border);
      align-items: center;
    }

    .var-row:last-child {
      border-bottom: none;
    }

    .key {
      font-weight: 600;
    }

    .type {
      font-size: 12px;
      color: var(--nl-text-secondary);
      text-transform: capitalize;
    }

    .value {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .code {
      font-family: ui-monospace, monospace;
      font-size: 12px;
      background: var(--nl-surface-control);
      padding: 2px 4px;
      border-radius: 4px;
    }

    .empty {
      font-style: italic;
      color: var(--nl-text-secondary);
      padding: var(--nl-spacing-md);
      text-align: center;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'nl-request-variables': RequestVariables;
  }
}
