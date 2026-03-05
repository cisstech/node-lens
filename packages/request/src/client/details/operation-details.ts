import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { RequestOperation } from '../../server/types';
import { formatMs } from '../utils';


@customElement('nl-operation-details')
export class OperationDetails extends LitElement {
  @property({ type: Object })
  operation?: RequestOperation;

  /** The start time of the entire trace for calculating relative timings. */
  @property({ type: Number, reflect: true })
  baseStart = 0;

  @property({ type: Boolean, reflect: true })
  isPinned = false;

  @property({ type: Boolean, reflect: true })
  isFocused = false;

  override render() {
    if (!this.operation) {
      return nothing;
    }

    const op = this.operation;
    const exceptionEvent = op.events?.find(ev => ev.name === 'exception');
    const otherEvents = op.events?.filter(ev => ev.name !== 'exception') || [];

    return html`
      <div class="popover-head">
        <span>Details</span>
        <div class="popover-actions">
          <nl-button variant="ghost" @click=${this.isFocused ? this.onFocusReset : this.onFocusFrom}>
            <nl-codicon icon="${this.isFocused ? 'discard' : 'search'}"></nl-codicon>
            ${this.isFocused ? 'Unfocus' : 'Focus'}
          </nl-button>
          <nl-button variant="ghost" @click=${this.onPinToggle}>
            <nl-codicon icon=${this.isPinned ? 'close' : 'pin'}></nl-codicon>
            ${this.isPinned ? 'Close' : 'Pin'}
          </nl-button>
        </div>
      </div>
      <div class="popover-body">
        <div class="popover-op-name">${op.name}</div>

        ${exceptionEvent ? html`
          <div class="exception-details">
            <div class="exception-title"><nl-codicon icon="bug"></nl-codicon> Exception Recorded</div>
            ${exceptionEvent.attributes?.['exception.message'] ? html`<div class="exception-message">${exceptionEvent.attributes['exception.message']}</div>` : nothing}
            ${exceptionEvent.attributes?.['exception.stacktrace'] ? html`<pre class="exception-stacktrace">${exceptionEvent.attributes['exception.stacktrace']}</pre>` : nothing}
          </div>
        ` : nothing}

        <h4 class="popover-h4">Timing</h4>
        <ul class="popover-ul">
          <li><strong>Start:</strong> ${formatMs(op.startTimeMs - this.baseStart)}</li>
          <li><strong>End:</strong> ${formatMs(op.endTimeMs - this.baseStart)}</li>
          <li><strong>Duration:</strong> ${formatMs(op.durationMs)}</li>
        </ul>

        <h4 class="popover-h4">Attributes</h4>
        <nl-attributes .data=${op.attributes || {}} variant="compact" copiableValues></nl-attributes>

        ${otherEvents.length > 0 ? html`
          <h4 class="popover-h4">Events</h4>
          <ul class="popover-ul">
            ${otherEvents.map(ev => html`
              <li>
                <strong>${ev.name}</strong> <span class="muted">(${formatMs(ev.time - op.startTimeMs)})</span>
                <nl-attributes .data=${ev.attributes || {}} variant="compact" copiableValues></nl-attributes>
              </li>
            `)}
          </ul>
        ` : nothing}

        ${this.isPinned ? html`
          <div class="popover-footer">
            <small class="muted">Tips: ↑/↓ navigate • C collapse • Esc close • Shift+C collapse all • H compact view • F duration filter</small>
          </div>
        ` : nothing}
      </div>
    `;
  }

  private onPinToggle() {
    this.dispatchEvent(new CustomEvent('pin-toggle', { bubbles: true, composed: true }));
  }

  private onFocusFrom() {
    this.dispatchEvent(new CustomEvent('focus-from', { bubbles: true, composed: true }));
  }

  private onFocusReset() {
    this.dispatchEvent(new CustomEvent('focus-reset', { bubbles: true, composed: true }));
  }

  static override styles = css`
    :host {
      display: block;
      font-family: var(--nl-font-family-sans);
      font-size: var(--nl-font-size-base);
      color: var(--nl-text-primary);
    }
    .popover-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 600;
      margin-bottom: 6px;
    }
    .popover-actions {
      margin-left: 8px;
    }
    .popover-body {
      font-size: 12px;
    }
    .popover-op-name {
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .popover-h4 {
      margin: 12px 0 4px;
      font-size: 12px;
      font-weight: 600;
    }
    .popover-ul {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .popover-ul li {
      padding: 2px 0;
    }
    .popover-ul li > strong {
      color: var(--nl-text-primary);
    }
    .popover-footer {
      margin-top: 8px;
      font-size: 11px;
    }
    .exception-details {
      overflow: hidden;
      border: 1px solid var(--nl-color-error);
      border-radius: var(--nl-border-radius);
      margin-top: 8px;
      background: color-mix(in oklab, var(--nl-color-error) 10%, transparent);
    }
    .exception-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
      font-size: 12px;
      padding: 6px 8px;
      background: color-mix(in oklab, var(--nl-color-error) 15%, transparent);
      color: var(--nl-color-error);
    }
    .exception-message {
      padding: 6px 8px;
      font-family: var(--nl-font-family-mono, monospace);
      border-bottom: 1px solid var(--nl-surface-border);
    }
    .exception-stacktrace {
      margin: 0;
      padding: 8px;
      font-size: 11px;
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 200px;
      overflow-y: auto;
      background: var(--nl-surface-control);
    }
    .muted {
      color: var(--nl-text-secondary);
    }
  `;
}
