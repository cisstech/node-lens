import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

@customElement('nl-button')
export class Button extends LitElement {
  @property({ type: String, reflect: true }) variant: ButtonVariant = 'primary';
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property({ type: Boolean, reflect: true }) loading = false;

  @property({ type: String }) copy?: string;

  @state() private _isCopied = false;

  static override styles = css`
    :host {
      display: inline-flex;
    }

    button {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: var(--nl-spacing-xs);
      border: 1px solid transparent;
      padding: var(--nl-spacing-sm) var(--nl-spacing-md);
      font-size: var(--nl-font-size-base);
      border-radius: var(--nl-border-radius);
      cursor: pointer;
      transition: background-color 0.2s ease-in-out, color 0.2s ease-in-out;
      font-family: var(--nl-font-family-sans);
      position: relative;
    }

    /* --- Variants --- */
    :host([variant='primary']) button {
      background-color: var(--nl-color-primary);
      color: var(--nl-text-on-primary);
      border-color: var(--nl-color-primary);
    }
    :host([variant='primary']) button:hover {
      background-color: var(--nl-color-primary-hover);
    }

    :host([variant='secondary']) button {
      background-color: var(--nl-surface-control);
      color: var(--nl-text-primary);
      border-color: var(--nl-surface-border);
    }
    :host([variant='secondary']) button:hover {
      background-color: var(--nl-surface-hover);
    }

    :host([variant='ghost']) button {
      border: none;
      background: transparent;
      color: var(--nl-text-primary);
      padding: 2px 6px;
    }
    :host([variant='ghost']) button:hover {
      background: var(--nl-surface-hover);
    }

    :host([disabled]) button,
    :host([loading]) button {
      cursor: not-allowed;
      opacity: 0.6;
    }

    /* Copy feedback */
    .copy-feedback {
      display: inline-flex;
      align-items: center;
      color: var(--nl-color-success, #22c55e);
      animation: pop-in 0.3s ease;
    }
    @keyframes pop-in {
      from { opacity: 0; transform: scale(0.5); }
      to { opacity: 1; transform: scale(1); }
    }

    /* Loading spinner */
    .spinner {
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;

  private async _handleCopyClick() {
    if (!this.copy || this._isCopied) return;
    try {
      await navigator.clipboard.writeText(this.copy);
      this._isCopied = true;
      setTimeout(() => (this._isCopied = false), 1500);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  }

  override render() {
    const clickHandler = this.copy ? this._handleCopyClick : undefined;

    return html`
      <button
        ?disabled=${this.disabled || this.loading}
        aria-disabled=${(this.disabled || this.loading).toString()}
        @click=${clickHandler}
      >
        ${this.loading
          ? html`<nl-codicon class="spinner" icon="loading"></nl-codicon>`
          : this._isCopied
          ? html`<span class="copy-feedback"><nl-codicon icon="check"></nl-codicon></span>`
          : html`<slot></slot>`}
      </button>
    `;
  }
}
