import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('nl-tree')
export class NlTree extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }
  `;

  override render() {
    return html`<slot></slot>`;
  }
}

@customElement('nl-tree-node')
export class NlTreeNode extends LitElement {
  @property({ type: Boolean, reflect: true })
  expanded = false;

  static override styles = css`
    :host {
      display: block;
    }

    .node-content {
      display: flex;
      align-items: center;
      cursor: pointer;
    }

    .toggle-icon {
      width: 1em;
      height: 1em;
      margin-right: var(--nl-spacing-xs);
      transition: transform 0.2s;
    }

    :host([expanded]) .toggle-icon {
      transform: rotate(90deg);
    }

    .children {
      display: none;
      padding-left: 1.5em;
    }

    :host([expanded]) .children {
      display: block;
    }

    .toggle-icon svg {
      width: 100%;
      height: 100%;
    }
  `;

  private get hasChildren(): boolean {
    return this.querySelector('nl-tree-node') !== null;
  }

  override render() {
    return html`
      <div class="node-content" @click=${this._toggle}>
        ${this.hasChildren
          ? html`
              <span class="toggle-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 5l7 7-7 7"
                  ></path>
                </svg>
              </span>
            `
          : ''}
        <slot name="content"></slot>
      </div>
      <div class="children">
        <slot></slot>
      </div>
    `;
  }

  private _toggle() {
    if (this.hasChildren) {
      this.expanded = !this.expanded;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'nl-tree': NlTree;
    'nl-tree-node': NlTreeNode;
  }
}
