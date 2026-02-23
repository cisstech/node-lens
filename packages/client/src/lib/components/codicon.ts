import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

// Define the CDN URL for Codicons
const CODICON_CDN_URL = 'https://cdn.jsdelivr.net/npm/@vscode/codicons@0.0.40/dist/codicon.min.css';

// An ID for the global <link> tag to prevent adding it more than once
const GLOBAL_STYLESHEET_ID = 'codicon-global-font-stylesheet';

@customElement('nl-codicon')
export class Codicon extends LitElement {
  @property({ type: String })
  icon = '';

  /**
   * 1. GLOBAL INJECTION (for @font-face)
   * This static method injects the Codicon stylesheet into the main document's <head>.
   * This is critical for the @font-face rule to be registered globally, allowing the
   * browser to download the codicon.ttf font file.
   * It checks for an ID to ensure this only happens once per page load.
   */
  private static injectGlobalFontStyles() {
    if (document.getElementById(GLOBAL_STYLESHEET_ID)) {
      return; // Already injected
    }
    const link = document.createElement('link');
    link.id = GLOBAL_STYLESHEET_ID;
    link.rel = 'stylesheet';
    link.href = CODICON_CDN_URL;
    document.head.appendChild(link);
  }

  constructor() {
    super();
    // Ensure the global font styles are in the document when the component is created.
    Codicon.injectGlobalFontStyles();
  }

  /**
   * 2. LOCAL INJECTION (for styling within Shadow DOM)
   * This method injects the same Codicon stylesheet directly into this component's
   * shadowRoot. This makes all the .codicon-* classes available to style the <i> element.
   */
  private injectLocalStyles() {
    // Check if the link tag already exists in this component's shadow root
    if (this.shadowRoot?.querySelector(`link[href="${CODICON_CDN_URL}"]`)) {
      return;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = CODICON_CDN_URL;
    this.shadowRoot?.appendChild(link);
  }

  override firstUpdated() {
    this.injectLocalStyles();
  }

  override render() {
    return html`<i class="codicon codicon-${this.icon}"></i>`;
  }

  static override styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .codicon {
      font-size: 16px;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'nl-codicon': Codicon;
  }
}
