import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('nl-divider')
export class Divider extends LitElement {
  @property({ type: String, reflect: true })
  orientation: 'horizontal' | 'vertical' = 'horizontal';

  private hasSlotContent = false;

  constructor() {
    super();
    this.handleSlotChange = this.handleSlotChange.bind(this);
  }

  private handleSlotChange(e: Event) {
    const slot = e.target as HTMLSlotElement;
    this.hasSlotContent = slot.assignedNodes().length > 0;
    this.requestUpdate();
  }

  static override styles = css`
    :host {
      display: block;
      border: 0;
    }

    /* Horizontal */
    :host([orientation='horizontal']) {
      display: flex;
      align-items: center;
      margin: var(--nl-spacing-md) 0;
      border-top: 1px solid var(--nl-surface-border);
    }

    :host([orientation='horizontal'][has-slotted-content]) {
      border-top: none;
    }

    :host([orientation='horizontal'][has-slotted-content])::before {
      content: '';
      flex: 1;
      border-top: 1px solid var(--nl-surface-border);
      margin-right: var(--nl-spacing-sm);
    }

    :host([orientation='horizontal'][has-slotted-content])::after {
      content: '';
      flex: 1;
      border-top: 1px solid var(--nl-surface-border);
      margin-left: var(--nl-spacing-sm);
    }

    /* Vertical */
    :host([orientation='vertical']) {
      display: inline-block;
      height: 1em; /* Or set a specific height */
      vertical-align: middle;
      margin: 0 var(--nl-spacing-md);
      border-left: 1px solid var(--nl-surface-border);
    }

    ::slotted(*) {
      color: var(--nl-text-secondary);
      font-size: 12px;
    }
  `;

  override render() {
    if (this.hasSlotContent) {
      this.setAttribute('has-slotted-content', '');
    } else {
      this.removeAttribute('has-slotted-content');
    }

    return html`<slot @slotchange=${this.handleSlotChange}></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'nl-divider': Divider;
  }
}
