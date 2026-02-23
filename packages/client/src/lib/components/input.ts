import { LitElement, css, html } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';


@customElement('nl-input')
export class Input extends LitElement {
  @property({ type: String, reflect: true })
  placeholder = '';

  @property({ type: Boolean, reflect: true })
  disabled = false;

  @property({ type: String, reflect: true })
  type = 'text';

  @property({ type: String, reflect: true })
  value = '';

  /**
   * If true, a clear button will appear when the input has value.
   */
  @property({ type: Boolean, reflect: true })
  showClear = false;

  /**
   * The debounce delay in milliseconds before an 'input' event is fired.
   * If 0, the event is fired immediately.
   */
  @property({ type: Number, reflect: true, converter: (value) => (value == null ? 0 : Number(value)) })
  debounce = 0;

  @query('input')
  private _input!: HTMLInputElement;

  private _debounceTimeout?: number;

  static override styles = css`
    :host {
      display: inline-block;
      width: 100%; /* Make the host take up available width */
    }

    .wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }

    input {
      border: 1px solid var(--nl-surface-border);
      padding: var(--nl-spacing-sm) var(--nl-spacing-md);
      font-size: var(--nl-font-size-base);
      border-radius: var(--nl-border-radius);
      background-color: var(--nl-surface-control);
      color: var(--nl-text-primary);
      transition: border-color 0.2s ease-in-out;
      font-family: var(--nl-font-family-sans);
      width: 100%;
      box-sizing: border-box;
    }

    /* Add padding to the right if the clear button is shown */
    input.has-clear-button {
      padding-right: calc(var(--nl-spacing-md) * 2.5);
    }

    input:focus {
      outline: none;
      border-color: var(--nl-color-primary);
    }

    .clear-button {
      position: absolute;
      right: var(--nl-spacing-md);
      top: 50%;
      transform: translateY(-50%);
      cursor: pointer;
      color: var(--nl-text-secondary);
    }

    .clear-button:hover {
        color: var(--nl-text-primary);
    }

    :host([disabled]) .clear-button {
        display: none;
    }
  `;

  private onInput(e: Event) {
    const newValue = (e.target as HTMLInputElement).value;

    // Clear any existing debounce timer
    if (this._debounceTimeout) {
      clearTimeout(this._debounceTimeout);
    }

    // If debounce is enabled, set a new timer
    if (this.debounce > 0) {
      this._debounceTimeout = window.setTimeout(() => {
        this.value = newValue;
        this.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
      }, this.debounce);
    } else {
      // Otherwise, update the value and dispatch immediately
      this.value = newValue;
      this.dispatchEvent(new InputEvent('input', e));
    }
  }

  /**
   * Clears the input's value and re-focuses the element.
   */
  private _clearInput() {
    if (this.disabled) {
        return;
    }
    this.value = '';
    this.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    this._input.focus();
  }

  override render() {
    const clearButton =
      this.showClear && this.value && !this.disabled
        ? html`
            <span class="clear-button" @click=${this._clearInput}>
              <nl-codicon icon="close"></nl-codicon>
            </span>
          `
        : '';

    return html`
      <div class="wrapper">
        <input
          class=${this.showClear ? 'has-clear-button' : ''}
          .value=${this.value}
          ?disabled=${this.disabled}
          type=${this.type}
          @input=${this.onInput}
          placeholder=${this.placeholder}
        />
        ${clearButton}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'nl-input': Input;
  }
}
