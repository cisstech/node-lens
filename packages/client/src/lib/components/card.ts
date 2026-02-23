import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('nl-card')
export class NlCard extends LitElement {
  @property({ type: String })
  override title = '';

  static override styles = css`
    :host {
      display: block;
      background-color: var(--nl-surface-raised);
      border-radius: var(--nl-border-radius);
      box-shadow: var(--nl-shadow-md);
      transition: box-shadow 0.2s;
    }

    :host(:hover) {
      box-shadow: var(--nl-shadow-lg);
    }

    .header {
      padding: var(--nl-spacing-md);
      border-bottom: 1px solid var(--nl-color-border);
      font-weight: 600;
    }

    .content {
      padding: var(--nl-spacing-md);
    }
  `;

  override render() {
    return html`
      ${this.title
        ? html`<div class="header"><slot name="title">${this.title}</slot></div>`
        : ''}
      <div class="content">
        <slot></slot>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'nl-card': NlCard;
  }
}
