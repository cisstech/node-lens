import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('nl-row')
export class Row extends LitElement {
  @property({ type: Array })
  gutter: number | [number, number] = 0;

  static override styles = css`
    :host {
      display: flex;
      flex-wrap: wrap;
    }
  `;

  override connectedCallback() {
    super.connectedCallback();
    const [horizontalGutter, verticalGutter] = Array.isArray(this.gutter)
      ? this.gutter
      : [this.gutter, 0];

    this.style.marginLeft = `-${horizontalGutter / 2}px`;
    this.style.marginRight = `-${horizontalGutter / 2}px`;
    if (verticalGutter > 0) {
      this.style.rowGap = `${verticalGutter}px`;
    }
  }

  override render() {
    return html`<slot></slot>`;
  }
}

@customElement('nl-col')
export class Col extends LitElement {
  @property({ type: Number, reflect: true })
  span = 24;

  private _horizontalGutter = 0;

  static override styles = css`
    :host {
      display: block;
      box-sizing: border-box;
    }
  `;

  override connectedCallback() {
    super.connectedCallback();
    const parentRow = this.closest('nl-row');
    if (parentRow) {
      const [horizontalGutter] = Array.isArray(parentRow.gutter)
        ? parentRow.gutter
        : [parentRow.gutter, 0];
      this._horizontalGutter = horizontalGutter;
    }
    const width = (this.span / 24) * 100;
    this.style.flex = `0 0 ${width}%`;
    this.style.maxWidth = `${width}%`;
    this.style.paddingLeft = `${this._horizontalGutter / 2}px`;
    this.style.paddingRight = `${this._horizontalGutter / 2}px`;
  }

  override render() {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'nl-row': Row;
    'nl-col': Col;
  }
}
