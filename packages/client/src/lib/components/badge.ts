import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export const BADGE_VARIANTS = ['neutral', 'info', 'success', 'warning', 'danger'] as const;
export type BadgeVariant = (typeof BADGE_VARIANTS)[number];

@customElement('nl-badge')
export class Badge extends LitElement {
  @property({ type: String })
  variant: BadgeVariant = 'neutral';

  static override styles = css`
    :host {
      /* Badge component specific variables */
      --_badge-neutral-bg: #6c757d;
      --_badge-neutral-text: #ffffff;
      --_badge-info-bg: #007bff;
      --_badge-info-text: #ffffff;
      --_badge-success-bg: #28a745;
      --_badge-success-text: #ffffff;
      --_badge-warning-bg: #ffc107;
      --_badge-warning-text: #212529;
      --_badge-danger-bg: #dc3545;
      --_badge-danger-text: #ffffff;

      display: inline-flex;
      align-items: center;
      padding: var(--nl-spacing-xs) var(--nl-spacing-sm);
      font-size: 12px;
      font-weight: 600;
      line-height: 1;
      text-align: center;
      white-space: nowrap;
      vertical-align: baseline;
      border-radius: var(--nl-border-radius);
    }

    @media (prefers-color-scheme: dark) {
      :host {
        --_badge-neutral-bg: #4a4a4a;
        --_badge-neutral-text: #d4d4d4;
        --_badge-info-bg: #005a9e;
        --_badge-info-text: #d4d4d4;
        --_badge-success-bg: #1e7e34;
        --_badge-success-text: #d4d4d4;
        --_badge-warning-bg: #997404;
        --_badge-warning-text: #d4d4d4;
        --_badge-danger-bg: #a52a2a;
        --_badge-danger-text: #d4d4d4;
      }
    }

    :host([variant='neutral']) {
      background-color: var(--_badge-neutral-bg);
      color: var(--_badge-neutral-text);
    }
    :host([variant='info']) {
      background-color: var(--_badge-info-bg);
      color: var(--_badge-info-text);
    }
    :host([variant='success']) {
      background-color: var(--_badge-success-bg);
      color: var(--_badge-success-text);
    }
    :host([variant='warning']) {
      background-color: var(--_badge-warning-bg);
      color: var(--_badge-warning-text);
    }
    :host([variant='danger']) {
      background-color: var(--_badge-danger-bg);
      color: var(--_badge-danger-text);
    }
  `;

  override render() {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'nl-badge': Badge;
  }
}
