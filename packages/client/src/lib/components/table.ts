import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('nl-table-wrapper')
export class TableWrapper extends LitElement {
  static override styles = css`
    :host {
      display: block;
      width: 100%;
      border: 1px solid var(--nl-surface-border);
      border-radius: var(--nl-border-radius);
      overflow-x: auto;
    }
  `;

  override render() {
    return html`<slot></slot>`;
  }
}

@customElement('nl-table')
export class Table extends LitElement {
  static override styles = css`
    :host {
      display: table;
      width: 100%;
      border-collapse: collapse;
      border-spacing: 0;
    }
  `;

  override render() {
    return html`<slot></slot>`;
  }
}

@customElement('nl-thead')
export class TableHead extends LitElement {
  static override styles = css`
    :host {
      display: table-header-group;
      background-color: var(--nl-surface-control);
    }
  `;
  override render() {
    return html`<slot></slot>`;
  }
}

@customElement('nl-tbody')
export class TableBody extends LitElement {
  static override styles = css`
    :host {
      display: table-row-group;
    }
  `;
  override render() {
    return html`<slot></slot>`;
  }
}

@customElement('nl-tr')
export class TableRow extends LitElement {
  static override styles = css`
    :host {
      display: table-row;
    }
    :host(:not(:last-child)) {
      border-bottom: 1px solid var(--nl-surface-border);
    }
  `;
  override render() {
    return html`<slot></slot>`;
  }
}

@customElement('nl-th')
export class TableHeader extends LitElement {
  static override styles = css`
    :host {
      display: table-cell;
      padding: var(--nl-spacing-sm) var(--nl-spacing-md);
      font-weight: 600;
      text-align: left;
    }
  `;
  override render() {
    return html`<th><slot></slot></th>`;
  }
}

@customElement('nl-td')
export class TableData extends LitElement {
  static override styles = css`
    :host {
      display: table-cell;
      padding: var(--nl-spacing-sm) var(--nl-spacing-md);
      vertical-align: middle;
    }
  `;
  override render() {
    return html`<td><slot></slot></td>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'nl-table-wrapper': TableWrapper;
    'nl-table': Table;
    'nl-thead': TableHead;
    'nl-tbody': TableBody;
    'nl-tr': TableRow;
    'nl-th': TableHeader;
    'nl-td': TableData;
  }
}
