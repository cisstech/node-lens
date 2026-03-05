import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { RequestEvent } from '../../server/types';
import { formatMs, formatTime, prettyJSON } from '../utils';
import { buildCurl, exportRequest } from './utils';

@customElement('nl-request-details')
export class RequestDetails extends LitElement {
  @property({ attribute: false }) event!: RequestEvent;

  override render() {
    const req = this.event;
    if (!req) return nothing;

    const responseDur = req.response?.duration ?? 0;

    return html`
      <div class="details">
        <div class="meta">
          <div class="meta-row">
            <span class="meta-label">URL</span>
            <code class="meta-url">${req.request.url}</code>
            <nl-button variant="ghost" title="Copy URL" .copy=${req.request.url}>
              <nl-codicon icon="copy"></nl-codicon>
            </nl-button>
          </div>
          <div class="meta-row">
            <span class="meta-label">Trace</span>
            <span class="pill">${req.traceId}</span>
            <nl-button variant="ghost" title="Copy Trace ID" .copy=${req.traceId}>
              <nl-codicon icon="copy"></nl-codicon>
            </nl-button>
          </div>
          <div class="meta-row">
            <span class="meta-label">Response</span>
            <span class="pill">${formatMs(responseDur)}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Req Size</span>
            <span>${req.request.size ?? '—'}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Res Size</span>
            <span>${req.response?.size ?? '—'}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Time</span>
            <span>${formatTime(req.timestamp)}</span>
          </div>
        </div>

        <div class="actions">
          <nl-button
            variant="ghost"
            @click=${() => this.dispatchEvent(new CustomEvent('request-replay', { detail: req, bubbles: true, composed: true }))}
            title="Replay request"
          >
            <nl-codicon icon="debug-restart"></nl-codicon>
          </nl-button>
          <nl-button variant="ghost" .copy=${buildCurl(req)} title="Copy as cURL">
            <nl-codicon icon="terminal"></nl-codicon>
          </nl-button>
          <nl-button variant="ghost" @click=${() => exportRequest(req, true)} title="Export trace as JSON">
            <nl-codicon icon="json"></nl-codicon>
          </nl-button>
        </div>

        <nl-tabs activeKey="timeline" variant="pills">
          <nl-tab slot="tabs" key="timeline">Timeline</nl-tab>
          <nl-tab slot="tabs" key="headers">Headers</nl-tab>
          <nl-tab slot="tabs" key="query">Query</nl-tab>
          <nl-tab slot="tabs" key="body">Body</nl-tab>

          <nl-tab-panel slot="panels" key="timeline">
            <div class="timeline">
              <nl-request-timeline .operations=${req.operations || []}></nl-request-timeline>
            </div>
          </nl-tab-panel>

          <nl-tab-panel slot="panels" key="headers">
            <div class="split">
              <div class="box">
                <div class="box-title">Request Headers</div>
                <nl-attributes .data=${req.request.headers} copiableKeys></nl-attributes>
              </div>
              <div class="box">
                <div class="box-title">Response Headers</div>
                <nl-attributes .data=${req.response?.headers || {}} copiableKeys></nl-attributes>
              </div>
            </div>
          </nl-tab-panel>

          <nl-tab-panel slot="panels" key="query">
            <div class="box">
              <div class="box-title">Query Parameters</div>
              <nl-attributes .data=${req.request.query || {}} copiableKeys></nl-attributes>
            </div>
          </nl-tab-panel>

          <nl-tab-panel slot="panels" key="body">
            <div class="split">
              ${req.request.body
                ? html`
                    <div class="box">
                      <div class="box-title">Request Body</div>
                      <pre>${prettyJSON(req.request.body)}</pre>
                    </div>
                  `
                : nothing}
              ${req.response?.body
                ? html`
                    <div class="box">
                      <div class="box-title">Response Body</div>
                      <pre>${prettyJSON(req.response.body)}</pre>
                    </div>
                  `
                : nothing}
            </div>
          </nl-tab-panel>
        </nl-tabs>
      </div>
    `;
  }

  static override styles = css`
    .details {
      padding: var(--nl-spacing-md);
      background: var(--nl-surface-app);
      border-top: 1px solid var(--nl-surface-border);
      display: flex;
      flex-direction: column;
      gap: var(--nl-spacing-md);
    }
    .meta {
      display: grid;
      gap: var(--nl-spacing-sm);
    }
    .meta-row {
      display: flex;
      align-items: center;
      gap: var(--nl-spacing-sm);
    }
    .meta-label {
      font-weight: 600;
      color: var(--nl-text-secondary);
      min-width: 80px;
    }
    .meta-url {
      font-family: ui-monospace, monospace;
      background: var(--nl-surface-control);
      padding: 2px 6px;
      border-radius: var(--nl-border-radius);
    }
    .pill {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 999px;
      font-size: 11px;
      margin-left: 6px;
      font-weight: 600;
    }
    .actions {
      display: flex;
      gap: var(--nl-spacing-sm);
      margin-top: var(--nl-spacing-sm);
    }
    .box {
      border: 1px solid var(--nl-surface-border);
      border-radius: var(--nl-border-radius);
      overflow: hidden;
    }
    .box-title {
      padding: 6px 8px;
      border-bottom: 1px solid var(--nl-surface-border);
      background: var(--nl-surface-popover);
      font-weight: 600;
    }
    pre {
      margin: 0;
      padding: 8px;
      background: var(--nl-surface-app);
      font-size: 12px;
      overflow: auto;
    }
    .split {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--nl-spacing-md);
    }
  `;
}
