import { LitElement, html, css } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';

@customElement('nl-viewport-intersection')
export class ViewportIntersection extends LitElement {
  @property({ attribute: false })
  scrollContainer?: Element;

  @property({ type: Number })
  threshold?: number | number[];

  @property({ type: String })
  rootMargin?: string;

  @property({ type: Boolean })
  debug = false;

  @query('#intersection-element')
  private _intersectionElement!: HTMLDivElement;

  private _intersectionObserver?: IntersectionObserver;

  static override styles = css`
    :host {
      display: block;
      height: 64px;
    }
  `;

  override connectedCallback() {
    super.connectedCallback();
    this._setupIntersectionObserver();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this._teardownIntersectionObserver();
  }

  override updated(changedProperties: Map<string | number | symbol, unknown>) {
    super.updated(changedProperties);

    if (
      changedProperties.has('scrollContainer') ||
      changedProperties.has('threshold') ||
      changedProperties.has('rootMargin') ||
      changedProperties.has('debug')
    ) {
      this._teardownIntersectionObserver();
      this._setupIntersectionObserver();
    }
  }

  private _setupIntersectionObserver() {
    if (!this._intersectionElement) {
      return;
    }

    this._intersectionObserver = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          this.dispatchEvent(new CustomEvent('intersect'));
        }

        if (this.debug) {
          this._intersectionElement.style.border = '2px solid red';
        } else {
          this._intersectionElement.style.border = 'none';
        }
      },
      {
        root: this.scrollContainer || null,
        rootMargin: this.rootMargin,
        threshold: this.threshold,
      }
    );

    this._intersectionObserver.observe(this._intersectionElement);
  }

  private _teardownIntersectionObserver() {
    if (this._intersectionObserver) {
      this._intersectionObserver.disconnect();
      this._intersectionObserver = undefined;
    }
  }

  override render() {
    return html`<div id="intersection-element"></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'viewport-intersection': ViewportIntersection;
  }
}
