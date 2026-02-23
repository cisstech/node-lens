import { LitElement, css, html } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('nl-spinner')
export class Spinner extends LitElement {
  override render() {
    return html`<div class="spinner"></div>`;
  }

  static override styles = css`
    .spinner {
      border: 2px solid var(--nl-surface-border, #444);
      border-top: 2px solid var(--nl-color-primary, #f97316);
      border-radius: 50%;
      width: 16px;
      height: 16px;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
}
