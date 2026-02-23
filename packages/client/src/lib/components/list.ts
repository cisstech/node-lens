import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/**
 * A list container.
 * @slot - This element has a slot for nl-list-item elements.
 */
@customElement('nl-list')
export class List extends LitElement {
  static override styles = css`
    :host {
      display: block;
      background-color: var(--nl-surface-control);
      border: 1px solid var(--nl-surface-border);
      border-radius: var(--nl-border-radius);
      overflow: hidden;
    }
    ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }
  `;

  override render() {
    return html`
      <ul>
        <slot></slot>
      </ul>
    `;
  }
}

/**
 * An item for use with nl-list.
 * @slot - This element has a slot for content.
 * @fires selection-change - Dispatched when the item is clicked and selectable.
 */
@customElement('nl-list-item')
export class ListItem extends LitElement {
  /**
   * Whether the item can be selected.
   */
  @property({ type: Boolean, reflect: true })
  selectable = false;

  /**
   * The selected state of the item.
   */
  @property({ type: Boolean, reflect: true })
  selected = false;

  static override styles = css`
    :host {
      display: block;
      padding: var(--nl-spacing-sm) var(--nl-spacing-md);
      border-bottom: 1px solid var(--nl-surface-border);
      cursor: default;
      user-select: none;
    }
    :host(:last-child) {
      border-bottom: none;
    }
    :host([selectable]:hover) {
      background-color: var(--nl-surface-hover);
      cursor: pointer;
    }
    :host([selectable][selected]) {
      background-color: var(--nl-color-primary);
      color: var(--nl-text-on-primary);
    }
  `;

  constructor() {
    super();
    this.addEventListener('click', this._handleClick);
  }

  private _handleClick() {
    if (this.selectable) {
      this.dispatchEvent(
        new CustomEvent('selection-change', {
          detail: {
            value: this.textContent,
          },
          bubbles: true,
          composed: true,
        })
      );
    }
  }

  override render() {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'nl-list': List;
    'nl-list-item': ListItem;
  }
}
