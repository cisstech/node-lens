import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('nl-toggle')
export class NlToggle extends LitElement {
  @property({ type: Boolean, reflect: true })
  checked = false;

  static override styles = css`
    :host {
      display: inline-block;
      cursor: pointer;
    }

    .switch {
      position: relative;
      display: inline-block;
      width: 40px;
      height: 24px;
    }

    .slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: var(--nl-surface-raised);
      transition: 0.2s;
      border-radius: 24px;
      border: 1px solid var(--nl-color-border);
    }

    .slider:before {
      position: absolute;
      content: '';
      height: 16px;
      width: 16px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      transition: 0.2s;
      border-radius: 50%;
      box-shadow: var(--nl-shadow-sm);
    }

    :host([checked]) .slider {
      background-color: var(--nl-color-primary);
      border-color: var(--nl-color-primary);
    }

    :host([checked]) .slider:before {
      transform: translateX(16px);
    }
  `;

  override render() {
    return html`
      <div class="switch" @click=${this._toggle}>
        <span class="slider"></span>
      </div>
    `;
  }

  private _toggle() {
    this.checked = !this.checked;
    this.dispatchEvent(
      new CustomEvent('nl-change', {
        detail: { checked: this.checked },
        bubbles: true,
        composed: true,
      })
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'nl-toggle': NlToggle;
  }
}
