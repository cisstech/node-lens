import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('nl-attributes')
export class Attributes extends LitElement {
  @property({ type: Object })
  data: Record<string, unknown> = {};

  @property({ type: Boolean, reflect: true })
  copiableKeys = false;

  @property({ type: Boolean, reflect: true })
  copiableValues = true;

  /**
   * Controls the display style.
   * 'default': For main layouts with on-hover actions.
   * 'compact': For popovers where width must be stable.
   */
  @property({ type: String, reflect: true })
  variant: 'default' | 'compact' = 'default';

  static override styles = css`
    :host {
      display: block;
      font-family: var(--nl-font-family-sans);
      font-size: var(--nl-font-size-base);
      color: var(--nl-text-primary);
    }
    .empty {
      color: var(--nl-text-secondary);
      font-size: 12px;
      padding: var(--nl-spacing-sm);
    }
    .text-content {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* --- Default Variant: For wide, static layouts --- */
    :host([variant='default']) .kv-list {
      border: 1px solid var(--nl-surface-border);
      border-radius: var(--nl-border-radius);
      overflow: hidden;
    }
    :host([variant='default']) .kv-row {
      display: grid;
      grid-template-columns: 30% 1fr;
      background: var(--nl-surface-popover);
    }
    :host([variant='default']) .kv-row:not(:last-child) .k,
    :host([variant='default']) .kv-row:not(:last-child) .v {
      border-bottom: 1px solid var(--nl-surface-border);
    }
    :host([variant='default']) .k,
    :host([variant='default']) .v {
      position: relative;
      padding: 6px 10px;
      min-height: 28px;
      display: flex;
      align-items: center;
      overflow: hidden;
    }
    :host([variant='default']) .k {
      font-weight: 600;
      color: var(--nl-text-secondary);
    }
    :host([variant='default']) .v {
      font-family: var(--nl-font-family-mono, monospace);
    }
    :host([variant='default']) .text-content {
      transition: padding-right 0.15s ease-in-out;
    }
    :host([variant='default']) .copy-btn {
      position: absolute;
      right: 6px;
      top: 50%;
      transform: translateY(-50%);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.15s ease-in-out;
    }
    :host([variant='default']) .kv-row:hover .copy-btn {
      opacity: 1;
      pointer-events: auto;
    }
    :host([variant='default']) .kv-row:hover .text-content {
      padding-right: 30px;
    }

    /* --- Compact Variant: For Popovers --- */
    :host([variant='compact']) {
      font-size: 12px;
      border: 1px solid var(--nl-surface-border);
      border-radius: var(--nl-border-radius);
      overflow: hidden;
    }
    :host([variant='compact']) .kv-row {
      display: grid;
      grid-template-columns: 35% 1fr;
    }
    :host([variant='compact']) .kv-row:not(:last-child) {
        border-bottom: 1px solid var(--nl-surface-border);
    }
    :host([variant='compact']) .k,
    :host([variant='compact']) .v {
      display: flex;
      align-items: center;
      padding: 4px 6px;
      background: var(--nl-surface-popover);
      gap: 4px;
      min-width: 0;
    }
    :host([variant='compact']) .k {
      font-weight: 600;
      color: var(--nl-text-secondary);
      border-right: 1px solid var(--nl-surface-border);
    }
    :host([variant='compact']) .text-content {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    :host([variant='compact']) .copy-btn {
      color: var(--nl-text-secondary);
      opacity: 0.6;
      flex-shrink: 0;
      margin-left: auto;
    }
    :host([variant='compact']) .copy-btn:hover {
      opacity: 1;
      background: var(--nl-surface-hover);
    }
  `;

  override render() {
    const entries = Object.entries(this.data || {});
    if (entries.length === 0) {
      return html`<div class="empty">No data</div>`;
    }
    return html`
      <div class="kv-list">
        ${entries.map(
          ([k, v]) => html`
            <div class="kv-row">
              <div class="k">
                <span class="text-content" title=${k}>${k}</span>
                ${this.copiableKeys
                  ? html`<nl-button class="copy-btn" variant="ghost" .copy=${k} title="Copy key"><nl-codicon icon="copy"></nl-codicon></nl-button>`
                  : nothing}
              </div>
              <div class="v">
                <span class="text-content" title=${String(v)}>${String(v)}</span>
                ${this.copiableValues
                  ? html`<nl-button class="copy-btn" variant="ghost" .copy=${String(v)} title="Copy value"><nl-codicon icon="copy"></nl-codicon></nl-button>`
                  : nothing}
              </div>
            </div>
          `
        )}
      </div>
    `;
  }
}
