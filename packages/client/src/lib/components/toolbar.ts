import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('nl-toolbar')
export class NlToolbar extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      align-items: center;
      padding: var(--nl-spacing-sm);
      background-color: var(--nl-surface-app);
      border-bottom: 1px solid var(--nl-color-border);
    }

    ::slotted(*) {
      margin-right: var(--nl-spacing-sm);
    }

    ::slotted(*:last-child) {
      margin-right: 0;
    }
  `;

  override render() {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'nl-toolbar': NlToolbar;
  }
}
